/**
 * 쿠팡 골드박스에서 조건에 맞는 상품을 골라 내 딥링크로 사이트에 올립니다.
 * .github/workflows/auto-coupang.yml 에서 정해진 시각마다 돕니다.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, readDeals, writeDeals, nowKST } from "./deals-file.mjs";
import { loadConfig } from "./config.mjs";
import { goldbox, deeplink, hasKeys } from "./coupang.mjs";

const cfg = loadConfig().coupang;
const out = [];
const say = (line) => { out.push(line); console.log(line); };

function finish(changed, message) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `changed=${changed ? "true" : "false"}\n`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || "/dev/null", out.join("\n") + "\n");
  if (message) fs.writeFileSync(path.join(ROOT, ".deal-commit-message"), message, "utf8");
}

if (!cfg.enabled) {
  say("automation.json 에서 coupang.enabled 가 꺼져 있어 아무것도 하지 않았습니다.");
  finish(false);
  process.exit(0);
}
if (!hasKeys()) {
  say("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없어 건너뜁니다. 저장소 Settings → Secrets 에 넣어 주세요.");
  finish(false);
  process.exit(0);
}

/** 응답 모양이 조금씩 달라도 버티도록 넓게 읽습니다. */
function normalize(item) {
  const price = Number(item.productPrice ?? item.salePrice ?? 0) || 0;
  const listPrice =
    Number(item.originalPrice ?? item.basePrice ?? item.productBasePrice ?? item.orgPrice ?? 0) || 0;
  const rate =
    Number(item.discountRate ?? 0) ||
    (listPrice > price && price ? Math.round((1 - price / listPrice) * 100) : 0);
  return {
    id: String(item.productId ?? item.productItemId ?? ""),
    title: String(item.productName ?? "").trim(),
    url: String(item.productUrl ?? ""),
    image: String(item.productImage ?? ""),
    category: String(item.categoryName ?? "").trim(),
    isRocket: Boolean(item.isRocket),
    price,
    listPrice,
    rate,
  };
}

const raw = await goldbox({ subId: process.env.COUPANG_SUB_ID });
const items = (Array.isArray(raw) ? raw : raw?.productData || []).map(normalize);
say(`### 쿠팡 골드박스\n\n받아온 상품: **${items.length}개**`);
if (items.length) {
  // 첫 실행에서 실제 응답 필드를 눈으로 확인할 수 있게 남깁니다.
  const sample = Array.isArray(raw) ? raw[0] : raw?.productData?.[0];
  say(`\n<details><summary>응답 필드</summary>\n\n\`\`\`\n${Object.keys(sample || {}).join(", ")}\n\`\`\`\n</details>`);
}

const deals = readDeals();
const posted = new Set(deals.map((d) => String(d.sourceId || "")).filter(Boolean));
const postedUrls = new Set(deals.map((d) => d.url));
const bad = (cfg.excludeKeywords || []).filter(Boolean);

const picks = items
  .filter((it) => it.id && it.title && it.url && it.price)
  .filter((it) => !posted.has(it.id) && !postedUrls.has(it.url))
  .filter((it) => it.price >= cfg.minPrice && it.price <= cfg.maxPrice)
  .filter((it) => !bad.some((w) => it.title.includes(w)))
  .filter((it) => !it.rate || it.rate >= cfg.minDiscountRate)
  .sort((a, b) => b.rate - a.rate)
  .slice(0, cfg.maxPerRun);

say(`\n조건을 통과한 상품: **${picks.length}개** (한 번에 최대 ${cfg.maxPerRun}개)`);

if (!picks.length) {
  finish(false);
  process.exit(0);
}

/* 골드박스가 이미 제휴 링크를 주면 그대로 쓰고, 아니면 딥링크로 바꿉니다. */
const needsLink = picks.filter((p) => !p.url.includes("link.coupang.com"));
if (needsLink.length) {
  try {
    const links = await deeplink(needsLink.map((p) => p.url), process.env.COUPANG_SUB_ID);
    const list = Array.isArray(links) ? links : links?.data || [];
    needsLink.forEach((p, i) => {
      const got = list[i]?.shortenUrl || list[i]?.landingUrl;
      if (got) p.url = got;
    });
  } catch (e) {
    say(`\n⚠️ 딥링크 변환에 실패해 이번 회차를 건너뜁니다: ${e.message}`);
    finish(false);
    process.exit(0);
  }
}

const stillRaw = picks.filter((p) => !p.url.includes("link.coupang.com"));
if (stillRaw.length) {
  say(`\n⚠️ 제휴 링크로 바꾸지 못한 ${stillRaw.length}개는 올리지 않았습니다. 수수료가 안 붙는 링크는 올릴 이유가 없습니다.`);
}

const fresh = picks
  .filter((p) => p.url.includes("link.coupang.com"))
  .map((p) => ({
    title: p.title,
    url: p.url,
    price: p.price,
    listPrice: p.listPrice || undefined,
    mall: "coupang",
    image: p.image || undefined,
    category: p.category || cfg.category,
    note: [p.rate ? `${p.rate}% 할인` : "", p.isRocket ? "로켓배송" : ""].filter(Boolean).join(" · ") || undefined,
    postedAt: nowKST(),
    hot: p.rate >= 50 || undefined,
    sourceId: p.id,
  }));

if (!fresh.length) {
  finish(false);
  process.exit(0);
}

writeDeals([...fresh, ...deals]);
say(`\n올린 딜:\n${fresh.map((d) => `- ${d.title} — ${d.price.toLocaleString("ko-KR")}원`).join("\n")}`);
finish(true, `딜 추가(쿠팡 자동): ${fresh.length}건`);
