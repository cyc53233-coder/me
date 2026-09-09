/**
 * 올려둔 딜의 가격을 확인해서, 오르거나 품절이면 마감으로 바꿉니다.
 * 확인에 실패한 딜은 절대 건드리지 않습니다 — 모르는 것과 끝난 것은 다릅니다.
 */
import fs from "node:fs";
import { loadConfig } from "./config.mjs";
import { fetchMeta } from "./meta.mjs";
import { won } from "./kakao.mjs";
import { hasCreds, listLiveDeals, updateDeal } from "./supabase.mjs";

const cfg = loadConfig().watch;
const lines = [];
const say = (l) => { lines.push(l); console.log(l); };
const finish = () =>
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || "/dev/null", lines.join("\n") + "\n");

if (!cfg.enabled) {
  say("automation.json 에서 watch.enabled 가 꺼져 있습니다.");
  finish();
  process.exit(0);
}
if (!hasCreds()) {
  say("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없어 건너뜁니다. 저장소 Settings → Secrets 에 넣어 주세요.");
  finish();
  process.exit(0);
}

const deals = (await listLiveDeals(cfg.maxChecks)).filter((d) => /^https:\/\//.test(d.url || ""));
say(`### 가격 감시\n\n확인 대상: **${deals.length}개**\n`);

const ended = [];
const dropped = [];
let skipped = 0;

for (const deal of deals) {
  const meta = await fetchMeta(deal.url, { timeout: 12000 });

  if (meta.error) {
    skipped++;
  } else if (meta.soldOut) {
    await updateDeal(deal.id, { ended: true });
    ended.push(`${deal.title} — 품절`);
  } else if (!meta.price) {
    skipped++;
  } else if (meta.price > deal.price * (1 + cfg.risePercent / 100)) {
    await updateDeal(deal.id, { ended: true });
    ended.push(`${deal.title} — ${won(deal.price)} → ${won(meta.price)}`);
  } else if (meta.price < deal.price && meta.price >= deal.price * 0.3) {
    // 더 내려갔으면 사이트 가격도 따라 내립니다. 너무 작은 값은 잘못 읽은 것으로 봅니다.
    await updateDeal(deal.id, { price: meta.price });
    dropped.push(`${deal.title} — ${won(deal.price)} → ${won(meta.price)}`);
  }

  await new Promise((r) => setTimeout(r, 700));
}

if (ended.length) say(`**마감 처리 ${ended.length}건**\n${ended.map((l) => `- ${l}`).join("\n")}\n`);
if (dropped.length) say(`**가격 더 내려감 ${dropped.length}건**\n${dropped.map((l) => `- ${l}`).join("\n")}\n`);
if (skipped) say(`확인하지 못해 그대로 둔 딜: ${skipped}개 (링크가 봇을 막거나 가격을 못 읽은 경우입니다)`);
if (!ended.length && !dropped.length) say("바꿀 것이 없었습니다.");

finish();
