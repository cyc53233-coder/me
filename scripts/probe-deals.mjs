/* 딜 링크가 지금 무엇을 돌려주는지 보기만 합니다 — 아무것도 고치지 않습니다.
 *
 * 토스가 지운 상품에 무엇을 주는지 모르는 채로 "죽었으면 마감" 규칙을 만들면
 * 멀쩡히 팔리는 딜을 지울 수 있습니다. 그래서 먼저 신호를 확인합니다.
 *
 * 이 환경에서는 쇼핑몰이 막혀 있어(403) GitHub Actions 러너에서 돌립니다.
 */
import { readDeals } from "./deals-file.mjs";
import { hopFrom } from "./add-deal.mjs";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/* 화면에 "없다 / 품절" 이라고 적혀 있는지 — 어떤 말을 쓰는지 알아내는 것이 목적입니다 */
const MARKERS = [
  "품절", "일시품절", "재입고", "판매중지", "판매 중지", "판매종료", "판매 종료",
  "찾을 수 없", "존재하지 않", "삭제된", "중단된", "종료된 상품", "구매할 수 없",
  "sold out", "soldout", "not found", "잘못된 접근", "이용할 수 없",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(url) {
  const out = { url, hops: [], status: 0, finalUrl: "", title: "", found: [], bytes: 0, error: "" };
  let cur = url;
  try {
    for (let i = 0; i < 4; i++) {
      const res = await fetch(cur, { redirect: "follow", headers: { "user-agent": UA, "accept-language": "ko-KR,ko" } });
      out.status = res.status;
      out.finalUrl = res.url;
      out.hops.push(`${res.status}→${new URL(res.url).host}${new URL(res.url).pathname.slice(0, 28)}`);
      const html = await res.text();
      out.bytes = html.length;
      out.title = (html.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [])[1]?.trim().replace(/\s+/g, " ") || "";
      // 토스 짧은 링크는 자바스크립트로 한 번 더 튑니다
      const next = hopFrom(html);
      if (next && i < 3) {
        cur = new URL(next, res.url).href;
        continue;
      }
      const low = html.toLowerCase();
      out.found = MARKERS.filter((m) => low.includes(m.toLowerCase()));
      break;
    }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

const deals = readDeals().filter((d) => !d.ended && !d.soldOut);
console.log(`살아 있는 딜 ${deals.length}개를 찍어 봅니다. 아무것도 고치지 않습니다.\n`);

const rows = [];
for (const d of deals) {
  const r = await probe(d.url);
  rows.push({ title: d.title.slice(0, 26), ...r });
  const flag = r.error ? "오류" : r.status >= 400 ? "❌" : r.found.length ? "⚠" : "ok";
  console.log(
    `${flag.padEnd(3)} ${String(r.status).padEnd(4)} ${String(r.bytes).padStart(7)}B  ${d.title.slice(0, 26).padEnd(28)}` +
      `\n      경로: ${r.hops.join(" ")}` +
      `\n      제목: ${r.title.slice(0, 70)}` +
      (r.found.length ? `\n      걸린 말: ${r.found.join(", ")}` : "") +
      (r.error ? `\n      오류: ${r.error}` : "")
  );
  await sleep(400); // 몰아치지 않습니다
}

console.log("\n────────── 요약 ──────────");
const by = (f) => rows.filter(f).length;
console.log(`전부 ${rows.length} · 200 응답 ${by((r) => r.status === 200)} · 400 이상 ${by((r) => r.status >= 400)} · 오류 ${by((r) => r.error)}`);
console.log(`"없다/품절" 류 문구가 걸린 것 ${by((r) => r.found.length)}`);
const words = {};
rows.forEach((r) => r.found.forEach((m) => (words[m] = (words[m] || 0) + 1)));
console.log("걸린 말 분포:", JSON.stringify(words, null, 0));
const sizes = rows.map((r) => r.bytes).sort((a, b) => a - b);
console.log(`응답 크기: 최소 ${sizes[0]} · 중앙 ${sizes[Math.floor(sizes.length / 2)]} · 최대 ${sizes[sizes.length - 1]}`);
console.log("\n살아 있는 딜이 전부 같은 모양이면, 그와 다른 것이 죽은 신호입니다.");
