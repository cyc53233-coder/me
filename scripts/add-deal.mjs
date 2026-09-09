/**
 * 이슈 폼으로 들어온 딜을 v2 사이트의 Supabase `deals` 표에 반영합니다.
 * .github/workflows/deal.yml 에서 실행되고, 이슈에 남길 답글을
 * .deal-comment.md 로 남깁니다.
 *
 * 환경변수: MODE(add|end) ISSUE_BODY SITE_URL
 *           SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMeta, toNumber } from "./meta.mjs";
import { kakaoText, mallFromUrl, MALLS } from "./kakao.mjs";
import { hasCreds, findDealByUrl, findLiveDealByText, insertDeal, updateDeal } from "./supabase.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODE = process.env.MODE === "end" ? "end" : "add";
const BODY = process.env.ISSUE_BODY || "";
const SITE_URL = process.env.SITE_URL || "";
const COMMENT_PATH = path.join(ROOT, ".deal-comment.md");

/* ── 답글 ─────────────────────────────────────────────────── */
const comment = (md) => fs.writeFileSync(COMMENT_PATH, md.trimStart() + "\n", "utf8");

function fail(md) {
  comment(`❌ **올리지 못했습니다.**\n\n${md}\n\n고쳐서 다시 이슈를 열어 주세요.`);
  process.exit(1);
}

/* ── 이슈 폼 파싱 ─────────────────────────────────────────── */
function parseForm(body) {
  const out = new Map();
  for (const part of body.replace(/\r\n/g, "\n").split(/^### +/m).slice(1)) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    let value = part.slice(nl + 1).trim();
    if (value === "_No response_" || value === "_없음_") value = "";
    out.set(part.slice(0, nl).trim(), value);
  }
  return out;
}

const field = (form, name) => (form.get(name) || "").trim();
const checked = (form, name, label) =>
  new RegExp(`- \\[x\\] .*${label}`, "i").test(form.get(name) || "");

/* ── 마감 처리 ────────────────────────────────────────────── */
async function endDeal(form) {
  const key = field(form, "마감할 딜") || field(form, "쉐어링크 주소");
  if (!key) fail("어떤 딜을 마감할지 주소나 상품명을 적어 주세요.");

  const hit = /^https?:\/\//i.test(key)
    ? await findDealByUrl(key)
    : await findLiveDealByText(key);

  if (!hit) fail(`\`${key}\` 에 해당하는 딜을 찾지 못했습니다.`);
  if (hit.ended) {
    comment(`ℹ️ **${hit.title}** 은(는) 이미 마감으로 표시돼 있습니다.`);
    return;
  }

  await updateDeal(hit.id, { ended: true });
  comment(`✅ **${hit.title}** 을(를) 마감으로 바꿨습니다. 목록에서는 "마감 포함"을 켜야 보입니다.`);
}

/* ── 등록 처리 ────────────────────────────────────────────── */
async function addDeal(form) {
  const url = field(form, "쉐어링크 주소");
  if (!/^https:\/\/\S+$/i.test(url)) fail("쉐어링크 주소는 `https://` 로 시작하는 주소여야 합니다.");
  if (/example\.com/i.test(url)) {
    fail("샘플 주소(example.com)가 들어왔습니다. 내 계정에서 만든 쉐어링크를 넣어 주세요.");
  }

  const needsLookup = !field(form, "상품명") || !field(form, "이미지 주소");
  const meta = needsLookup ? await fetchMeta(url) : {};

  const price = toNumber(field(form, "지금 가격")) || toNumber(meta.price);
  if (!price) fail("지금 가격을 숫자로 적어 주세요. (예: `19900` 또는 `19,900`)");

  const title = field(form, "상품명") || meta.title;
  if (!title) {
    fail(
      "상품명을 링크에서 읽지 못했습니다. 이슈의 **상품명** 칸에 직접 적어 주세요." +
        (meta.error ? `\n\n> 링크를 여는 중: ${meta.error}` : "")
    );
  }

  const listPrice = toNumber(field(form, "평소 가격")) || null;
  if (listPrice !== null && listPrice < price) {
    fail("평소 가격이 지금 가격보다 쌉니다. 두 칸이 바뀐 것 같습니다.");
  }

  const mallField = field(form, "판매처");
  const row = {
    title,
    url,
    price,
    list_price: listPrice,
    mall: MALLS[mallField] ? mallField : mallFromUrl(url),
    image: field(form, "이미지 주소") || meta.image || null,
    category: field(form, "카테고리") || "기타",
    note: field(form, "한 줄 메모") || null,
    hot: checked(form, "표시", "대박"),
  };

  // 같은 링크가 이미 있으면 새로 쌓지 않고 최신 정보로 되살립니다.
  const existing = await findDealByUrl(url);
  const saved = existing
    ? await updateDeal(existing.id, { ...row, ended: false })
    : await insertDeal(row);

  comment(`
✅ **사이트에 올렸습니다.** ${existing ? "(같은 링크가 있어 최신 정보로 바꿨습니다)" : ""}

카톡방에 붙여넣을 문구입니다 — 아래 상자 오른쪽 위 복사 버튼을 누르세요.

\`\`\`
${kakaoText(saved || row)}
\`\`\`
${meta.error ? `\n> 링크에서 상품 정보를 읽지 못해 적어 주신 내용만 썼습니다: ${meta.error}\n` : ""}
${SITE_URL ? `사이트: ${SITE_URL}` : ""}
`);
}

/* ── 실행 ─────────────────────────────────────────────────── */
if (!hasCreds()) {
  fail(
    "사이트 데이터베이스에 연결할 수 없습니다.\n\n" +
      "저장소 **Settings → Secrets and variables → Actions** 에 `SUPABASE_URL` 과 " +
      "`SUPABASE_SERVICE_ROLE_KEY` 를 등록해 주세요."
  );
}

try {
  const form = parseForm(BODY);
  if (MODE === "end") await endDeal(form);
  else await addDeal(form);
} catch (e) {
  fail(`처리 중 오류가 났습니다.\n\n> ${String(e.message || e)}`);
}
