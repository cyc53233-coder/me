/**
 * 이슈 폼으로 들어온 딜을 data/deals.js 에 반영합니다.
 * GitHub Actions(.github/workflows/deal.yml)에서 실행되고,
 * 이슈에 남길 답글을 .deal-comment.md 로 남깁니다.
 *
 * 환경변수: MODE(add|end) ISSUE_BODY ISSUE_NUMBER SITE_URL
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

/* 카테고리 드롭다운은 "🥬 신선식품" 처럼 아이콘을 달고 옵니다.
   아이콘은 화면에서 site.js 가 붙이므로 데이터에는 이름만 남깁니다. */
const categoryName = (v) =>
  String(v || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

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

/* 이슈에 사진을 끌어다 놓으면 GitHub 이 이런 줄을 끼워 넣습니다:
   ![image](https://github.com/user-attachments/assets/…)
   그 주소는 상품 링크가 아니라 사진으로 씁니다. */
const IMAGE_URL =
  /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;
const IMAGE_HOST =
  /(user-attachments|user-images\.githubusercontent|githubusercontent\.com\/assets)/i;
const isImageUrl = (u) => IMAGE_URL.test(u) || IMAGE_HOST.test(u);

export function parseShare(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const links = [];
  const images = [];
  const rest = [];
  for (const line of lines) {
    // 마크다운 이미지 문법이면 안쪽 주소만 사진으로 씁니다
    const md = line.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
    if (md) {
      images.push(md[1]);
      continue;
    }
    const found = line.match(/https?:\/\/[^\s<>"'\)]+/);
    if (found) {
      const url = found[0].replace(/[.,)\]]+$/, "");
      (isImageUrl(url) ? images : links).push(url);
      // 링크와 글이 한 줄에 같이 있으면 남은 글도 제목 후보로 둡니다
      const without = line.replace(found[0], "").trim();
      if (without && !BOILERPLATE.some((re) => re.test(without))) rest.push(without);
      continue;
    }
    if (BOILERPLATE.some((re) => re.test(line))) continue;
    rest.push(line);
  }

  // 제목은 남은 줄 중 가장 긴 것 — 상품명이 보통 가장 깁니다
  const title = rest.sort((a, b) => b.length - a.length)[0] || "";
  return { url: links[0] || "", title, image: images[0] || "" };
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

/* 쇼핑몰마다 사진을 넣어 두는 자리가 달라서 순서대로 훑습니다. */
function imageFrom(html) {
  const meta =
    metaFrom(html, "og:image:secure_url") ||
    metaFrom(html, "og:image") ||
    metaFrom(html, "twitter:image") ||
    metaFrom(html, "twitter:image:src");
  if (meta) return meta;

  const linkTag = html.match(/<link[^>]+rel=["']image_src["'][^>]*>/i);
  if (linkTag) {
    const href = linkTag[0].match(/href=["']([^"']*)["']/i);
    if (href) return unescapeHtml(href[1]).trim();
  }

  // JSON-LD 의 image 는 문자열일 수도, 배열일 수도, 객체일 수도 있습니다
  for (const block of html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []) {
    const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      continue;
    }
    const found = findImage(data);
    if (found) return found;
  }
  return "";
}

function findImage(node, depth = 0) {
  if (!node || depth > 4) return "";
  if (typeof node === "string") return /^https?:\/\//.test(node) ? node : "";
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findImage(item, depth + 1);
      if (hit) return hit;
    }
    return "";
  }
  if (typeof node !== "object") return "";
  if (node.image) {
    const hit = findImage(node.image, depth + 1);
    if (hit) return hit;
  }
  if (node.url && typeof node.url === "string" && /^https?:\/\//.test(node.url) && node["@type"] === "ImageObject") {
    return node.url;
  }
  for (const key of ["@graph", "itemListElement", "mainEntity"]) {
    if (node[key]) {
      const hit = findImage(node[key], depth + 1);
      if (hit) return hit;
    }
  }
  return "";
}

/* 짧은 링크(link.coupang.com 등)는 302 대신 "잠시 후 이동합니다" 페이지를
   돌려주기도 합니다. 그럴 때 진짜 상품 주소를 한 번 더 따라갑니다. */
export function hopFrom(html) {
  const refresh = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*>/i);
  if (refresh) {
    const url = refresh[0].match(/url=([^"'\s;>]+)/i);
    if (url && /^https?:\/\//i.test(url[1])) return unescapeHtml(url[1]);
  }
  const js = html.match(
    /location(?:\.href|\.replace)?\s*(?:=|\()\s*["']((?:https?:)?\/\/[^"']+)["']/i
  );
  if (js) {
    const u = js[1];
    return u.startsWith("//") ? "https:" + u : u;
  }
  return "";
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "ko-KR,ko;q=0.9,en;q=0.8",
};

async function getHtml(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw Object.assign(new Error(`링크 응답이 ${res.status} 입니다`), { soft: true });
  return (await res.text()).slice(0, 600000);
}

export async function fetchMeta(url) {
  try {
    let html = await getHtml(url);
    let image = imageFrom(html);
    let title = metaFrom(html, "og:title") || metaFrom(html, "twitter:title");

    // 짧은 링크가 중간 페이지를 돌려줬으면 한 번 더 따라갑니다
    if (!title && !image) {
      const next = hopFrom(html);
      if (next) {
        html = await getHtml(next);
        image = imageFrom(html);
        title = metaFrom(html, "og:title") || metaFrom(html, "twitter:title");
      }
    }
    return {
      title,
      image,
      price: toNumber(metaFrom(html, "product:price:amount")),
    };
  } catch (e) {
    if (e.soft) return { error: e.message };
    return { error: e.name === "TimeoutError" ? "링크를 여는 데 시간이 너무 걸렸습니다" : String(e.message || e) };
  }
}

/* 링크에서 무엇을 읽어 왔는지 답글에 남깁니다. 쇼핑몰이 막으면 "왜 사진이
   없는지"를 여기서 알 수 있어야 합니다 — 조용히 넘어가면 원인을 못 찾습니다. */
function linkReport(meta) {
  if (!meta || (!meta.error && meta.title === undefined && meta.image === undefined)) return "";
  if (meta.error) return `\n\n> 링크를 여는 중 막혔습니다 — ${meta.error}`;
  const mark = (v) => (v ? "읽음" : "없음");
  return (
    `\n\n> 링크에서 읽은 것 — 상품명 ${mark(meta.title)} · ` +
    `사진 ${mark(meta.image)} · 가격 ${mark(meta.price)}`
  );
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

  // 폼에 "어떻게" 가 없으면(예전 이슈) 마감으로 봅니다.
  const soldOut = /품절/.test(field(form, "어떻게") || "");
  const label = soldOut ? "품절" : "마감";
  if (soldOut ? hit.soldOut : hit.ended) {
    comment(`ℹ️ **${hit.title}** 은(는) 이미 ${label}으로 표시돼 있습니다.`);
    return { changed: false };
  }
  // 언제 그렇게 됐는지 남겨 둡니다 — 사이트가 잠깐(site.js 의 endedHours)
  // 표시로 남겨야 놓친 사람이 알림방에 들어올 이유가 생깁니다.
  if (soldOut) {
    hit.soldOut = true;
    hit.soldOutAt = nowKST();
  } else {
    hit.ended = true;
    hit.endedAt = nowKST();
  }
  writeDeals(deals);
  comment(`✅ **${hit.title}** 을(를) ${label}으로 바꿨습니다. 목록에서 ${label} 표시로 잠깐 남았다가 빠집니다.`);
  return { changed: true, message: `딜 ${label}: ${hit.title}` };
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
  if (!price) {
    fail("지금 가격을 숫자로 적어 주세요. (예: `19900` 또는 `19,900`)" + linkReport(meta));
  }

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
    category: categoryName(field(form, "카테고리")) || undefined,
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
${deal.image ? "" : "\n> 상품 사진을 읽지 못했습니다. 카드에는 판매처 아이콘이 들어갑니다 — 이 이슈에 사진을 첨부해 다시 열면 그 사진을 씁니다." + linkReport(meta) + "\n"}
${SITE_URL ? `사이트: ${SITE_URL}` : ""}
`);
  return { changed: true, message: `딜 추가: ${title}` };
}

/* ── 실행 ─────────────────────────────────────────────────────
   테스트에서 parseShare · fetchMeta 만 꺼내 쓸 수 있도록,
   node 로 이 파일을 직접 돌릴 때만 본문이 실행되게 둡니다. */
const RUN_DIRECTLY =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (RUN_DIRECTLY) {
  const form = parseForm(BODY);
  const result = MODE === "end" ? endDeal(form) : await addDeal(form);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT || "/dev/null",
    `changed=${result.changed ? "true" : "false"}\n`
  );
  fs.writeFileSync(path.join(ROOT, ".deal-commit-message"), result.message || "딜 갱신", "utf8");
}
