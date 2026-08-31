/**
 * 올려둔 딜의 가격을 확인해서, 오르거나 품절이면 마감으로 바꿉니다.
 * 확인에 실패한 딜은 절대 건드리지 않습니다 — 모르는 것과 끝난 것은 다릅니다.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, readDeals, writeDeals } from "./deals-file.mjs";
import { loadConfig } from "./config.mjs";
import { fetchMeta } from "./meta.mjs";

const cfg = loadConfig().watch;
const lines = [];
const say = (l) => { lines.push(l); console.log(l); };

function finish(changed, message) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `changed=${changed ? "true" : "false"}\n`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || "/dev/null", lines.join("\n") + "\n");
  if (message) fs.writeFileSync(path.join(ROOT, ".deal-commit-message"), message, "utf8");
}

if (!cfg.enabled) {
  say("automation.json 에서 watch.enabled 가 꺼져 있습니다.");
  finish(false);
  process.exit(0);
}

const deals = readDeals();
const targets = deals
  .filter((d) => !d.ended && !d.sample && /^https:\/\//.test(d.url || ""))
  .slice(0, cfg.maxChecks);

say(`### 가격 감시\n\n확인 대상: **${targets.length}개**\n`);

const ended = [];
const dropped = [];
let skipped = 0;

for (const deal of targets) {
  const meta = await fetchMeta(deal.url, { timeout: 12000 });
  if (meta.error) {
    skipped++;
    continue;
  }
  if (meta.soldOut) {
    deal.ended = true;
    ended.push(`${deal.title} — 품절`);
    continue;
  }
  if (!meta.price) {
    skipped++;
    continue;
  }
  const limit = deal.price * (1 + cfg.risePercent / 100);
  if (meta.price > limit) {
    deal.ended = true;
    ended.push(`${deal.title} — ${deal.price.toLocaleString("ko-KR")}원 → ${meta.price.toLocaleString("ko-KR")}원`);
  } else if (meta.price < deal.price && meta.price >= deal.price * 0.3) {
    // 더 내려갔으면 사이트 가격도 따라 내립니다. 너무 작은 값은 잘못 읽은 것으로 봅니다.
    dropped.push(`${deal.title} — ${deal.price.toLocaleString("ko-KR")}원 → ${meta.price.toLocaleString("ko-KR")}원`);
    deal.price = meta.price;
  }
  await new Promise((r) => setTimeout(r, 700));
}

if (ended.length) say(`**마감 처리 ${ended.length}건**\n${ended.map((l) => `- ${l}`).join("\n")}\n`);
if (dropped.length) say(`**가격 더 내려감 ${dropped.length}건**\n${dropped.map((l) => `- ${l}`).join("\n")}\n`);
if (skipped) say(`확인하지 못해 그대로 둔 딜: ${skipped}개 (링크가 봇을 막거나 가격을 못 읽은 경우입니다)`);

if (!ended.length && !dropped.length) {
  finish(false);
  process.exit(0);
}

writeDeals(deals);
finish(true, `딜 상태 갱신: 마감 ${ended.length}건, 가격 ${dropped.length}건`);
