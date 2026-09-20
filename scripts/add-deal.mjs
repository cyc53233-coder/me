/**
 * 이슈 폼으로 들어온 딜을 data/deals.js 에 반영합니다.
 * GitHub Actions(.github/workflows/deal.yml)에서 실행되고,
 * 이슈에 남길 답글을 .deal-comment.md 로 남깁니다.
 *
 * 환경변수: MODE(add|end) ISSUE_BODY ISSUE_NUMBER SITE_URL
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, readDeals, writeDeals, loadBrowserContext, nowKST } from "./deals-file.mjs";

const MODE = process.env.MODE === "end" ? "end" : "add";
const BODY = process.env.ISSUE_BODY || "";
const SITE_URL = process.env.SITE_URL || "";
const COMMENT_PATH = path.join(ROOT, ".deal-comment.md");

/* ── 이슈 폼 파싱 ─────────────────────────────────────────── */
function parseForm(body) {
  const out = new Map();
  const parts = body.replace(/\r\n/g, "\n").split(/^### +/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const key = part.slice(0, nl).trim();
    let value = part.slice(nl + 1).trim();
    if (value === "_No response_" || value === "_없음_") value = "";
    out.set(key, value);
  }
  return out;
}

const field = (form, name) => (form.get(name) || "").trim();
const checked = (form, name, label) =>
  new RegExp(`- \\[x\\] .*${label}`, "i").test(form.get(name) || "");
const toNumber = (v) => Number(String(v).replace(/[^\d]/g, "")) || 0;
/* 등급 드롭다운은 "대박 🔥🔥🔥" 처럼 오므로 🔥 개수만 셉니다 */
const fireCount = (v) => (String(v || "").match(/🔥/g) || []).length;

/* ── 공유하기 문구 풀기 ───────────────────────────────────────
   쿠팡·토스 앱의 "공유하기"는 이런 덩어리를 클립보드에 넣습니다:

     쿠팡을 추천합니다!
      키토리지 맥세이프 차량 거치대 핸드폰거치대
      https://link.coupang.com/a/XXXXXXX

   그대로 붙여넣으면 링크와 상품명을 갈라냅니다. 링크만 넣어도 됩니다. */
const BOILERPLATE = [
  /추천합니다/,
  /파트너스 활동|쉐어링크 활동|제휴 ?활동/,
  /수수료를? (제공|지급)받/,
  /일정액의 수수료/,
  /^[\s*·\-]*$/,
];

export function parseShare(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const urls = [];
  const rest = [];
  for (const line of lines) {
    const found = line.match(/https?:\/\/[^\s<>"']+/);
    if (found) {
      urls.push(found[0].replace(/[.,)\]]+$/, ""));
      // 링크와 글이 한 줄에 같이 있으면 남은 글도 후보로 둡니다
      const without = line.replace(found[0], "").trim();
      if (without) rest.push(without);
      continue;
    }
    if (BOILERPLATE.some((re) => re.test(line))) continue;
    rest.push(line);
  }

  // 제목은 남은 줄 중 가장 긴 것 — 상품명이 보통 가장 깁니다
  const title = rest.sort((a, b) => b.length - a.length)[0] || "";
  return { url: urls[0] || "", title };
}

/* ── 링크에서 상품 정보 긁어오기 (실패해도 진행) ──────────── */
const unescapeHtml = (s) =>
  String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");

function metaFrom(html, prop) {
  const tag = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i")
  );
  if (!tag) return "";
  const content = tag[0].match(/content=["']([^"']*)["']/i);
  return content ? unescapeHtml(content[1]).trim() : "";
}

async function fetchMeta(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "accept-language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { error: `링크 응답이 ${res.status} 입니다` };
    const html = (await res.text()).slice(0, 400000);
    return {
      title: metaFrom(html, "og:title") || metaFrom(html, "twitter:title"),
      image: metaFrom(html, "og:image") || metaFrom(html, "twitter:image"),
      price: toNumber(metaFrom(html, "product:price:amount")),
    };
  } catch (e) {
    return { error: e.name === "TimeoutError" ? "링크를 여는 데 시간이 너무 걸렸습니다" : String(e.message || e) };
  }
}

/* ── 답글 ─────────────────────────────────────────────────── */
function comment(md) {
  fs.writeFileSync(COMMENT_PATH, md.trimStart() + "\n", "utf8");
}

function fail(md) {
  comment(`❌ **올리지 못했습니다.**\n\n${md}\n\n고쳐서 다시 이슈를 열어 주세요.`);
  process.exit(1);
}

/* ── 마감 처리 ────────────────────────────────────────────── */
function endDeal(form) {
  const key = field(form, "마감할 딜") || field(form, "쉐어링크 주소");
  if (!key) fail("어떤 딜을 마감할지 주소나 상품명을 적어 주세요.");

  const deals = readDeals();
  const hit = deals.find(
    (d) => (d.url && d.url === key) || (d.title || "").includes(key) || (d.url || "").includes(key)
  );
  if (!hit) fail(`\`${key}\` 에 해당하는 딜을 찾지 못했습니다.`);
  if (hit.ended) {
    comment(`ℹ️ **${hit.title}** 은(는) 이미 마감으로 표시돼 있습니다.`);
    return { changed: false };
  }
  hit.ended = true;
  writeDeals(deals);
  comment(`✅ **${hit.title}** 을(를) 마감으로 바꿨습니다. 목록에서는 "마감 포함"을 켜야 보입니다.`);
  return { changed: true, message: `딜 마감: ${hit.title}` };
}

/* ── 등록 처리 ────────────────────────────────────────────── */
async function addDeal(form) {
  const share = parseShare(field(form, "붙여넣기") || field(form, "쉐어링크 주소"));
  const url = share.url;
  if (!/^https:\/\/\S+$/i.test(url)) {
    fail(
      "붙여넣은 내용에서 `https://` 로 시작하는 링크를 찾지 못했습니다.\n\n" +
        "쿠팡·토스 앱의 **공유하기**로 복사한 내용을 그대로 붙여넣거나, 링크만 넣어 주세요."
    );
  }
  if (/example\.com/i.test(url)) fail("샘플 주소(example.com)가 들어왔습니다. 내 계정에서 만든 링크를 넣어 주세요.");

  const haveTitle = field(form, "상품명") || share.title;
  const haveImage = field(form, "이미지 주소");
  const meta = haveTitle && haveImage ? {} : await fetchMeta(url);

  const price = toNumber(field(form, "지금 가격")) || toNumber(meta.price);
  if (!price) fail("지금 가격을 숫자로 적어 주세요. (예: `19900` 또는 `19,900`)");

  const title = field(form, "상품명") || share.title || meta.title;
  if (!title) {
    fail(
      "상품명을 찾지 못했습니다. 공유하기 문구를 통째로 붙여넣거나, **상품명** 칸에 직접 적어 주세요." +
        (meta.error ? `\n\n> 링크를 여는 중: ${meta.error}` : "")
    );
  }

  const deal = {
    title,
    url,
    price,
    listPrice: toNumber(field(form, "평소 가격")) || undefined,
    image: field(form, "이미지 주소") || meta.image || undefined,
    category: field(form, "카테고리") || undefined,
    note: field(form, "한 줄 메모") || undefined,
    postedAt: nowKST(),
    grade: fireCount(field(form, "등급")) || (checked(form, "표시", "대박") ? 3 : 0) || undefined,
  };

  const deals = readDeals();
  const dupeAt = deals.findIndex((d) => d.url === url);
  if (dupeAt !== -1) deals.splice(dupeAt, 1);
  deals.unshift(deal);
  writeDeals(deals);

  const kakao = loadBrowserContext().kakaoText(deal);
  comment(`
✅ **사이트에 올렸습니다.** ${dupeAt !== -1 ? "(같은 링크가 있어 최신 정보로 바꿨습니다)" : ""}

카톡방에 붙여넣을 문구입니다 — 아래 상자 오른쪽 위 복사 버튼을 누르세요.

\`\`\`
${kakao}
\`\`\`
${meta.error ? `\n> 링크에서 상품 정보를 읽지 못해 적어 주신 내용만 썼습니다: ${meta.error}\n` : ""}
${SITE_URL ? `사이트: ${SITE_URL}` : ""}
`);
  return { changed: true, message: `딜 추가: ${title}` };
}

/* ── 실행 ─────────────────────────────────────────────────── */
const form = parseForm(BODY);
const result = MODE === "end" ? endDeal(form) : await addDeal(form);
fs.appendFileSync(
  process.env.GITHUB_OUTPUT || "/dev/null",
  `changed=${result.changed ? "true" : "false"}\n`
);
fs.writeFileSync(path.join(ROOT, ".deal-commit-message"), result.message || "딜 갱신", "utf8");
