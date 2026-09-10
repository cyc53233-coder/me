/**
 * 감시 목록의 가격을 한 바퀴 훑어 기록하고, 평소보다 많이 싸진 것만 이슈로 알립니다.
 * .github/workflows/pricewatch.yml 이 정해진 시각마다 실행합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { readProduct } from "./meta.mjs";
import { judge } from "./detect.mjs";
import { ROOT, loadConfig, loadHistory, saveHistory, won } from "./store.mjs";

const cfg = loadConfig();
const history = loadHistory();
const before = JSON.stringify(history);
const now = Date.now();

const lines = [];
const say = (l) => { lines.push(l); console.log(l); };

const targets = cfg.watch.slice(0, cfg.check.maxChecks);
say(`### 가격 확인\n\n감시 중인 상품: **${targets.length}개**\n`);

const alerts = [];
const failures = [];
let moved = 0;

for (const item of targets) {
  const entry = (history[item.url] ??= { name: item.name || "", points: [] });
  const read = await readProduct(item.url);

  if (read.error) {
    entry.lastError = read.error;
    failures.push(`${entry.name || item.url} — ${read.error}`);
  } else if (!read.price) {
    entry.lastError = "페이지에서 가격을 찾지 못했습니다";
    failures.push(`${entry.name || item.url} — 가격을 못 읽음`);
  } else {
    delete entry.lastError;
    if (!entry.name && read.title) entry.name = read.title;

    const verdict = judge(entry.points, read.price, cfg.alert, { now, lastAlert: entry.lastAlert });
    const last = entry.points.at(-1);

    if (!last || last.p !== read.price) {
      entry.points.push({ t: new Date(now).toISOString(), p: read.price });
      if (entry.points.length > cfg.alert.maxPoints) {
        entry.points = entry.points.slice(-cfg.alert.maxPoints);
      }
      moved++;
    }

    if (verdict.alert) {
      entry.lastAlert = { t: new Date(now).toISOString(), p: read.price };
      alerts.push({ ...item, ...verdict, price: read.price, name: entry.name || item.url });
    }
  }

  await new Promise((r) => setTimeout(r, cfg.check.requestDelayMs));
}

say(`가격이 움직인 상품: **${moved}개** · 알릴 만한 하락: **${alerts.length}개**`);
if (failures.length) {
  say(`\n확인하지 못한 상품 ${failures.length}개 — 계속 실패하면 config.json 의 watch 에서 빼세요:\n${failures.map((f) => `- ${f}`).join("\n")}`);
}

if (alerts.length) {
  alerts.sort((a, b) => b.dropPct - a.dropPct);
  const body = [
    "평소 가격보다 많이 떨어진 상품입니다. 기준가는 **그 상품 자신의 최근 가격 중앙값**입니다.",
    "",
    "| 상품 | 지금 | 기준가 | 하락 | |",
    "|---|---|---|---|---|",
    ...alerts.map(
      (a) =>
        `| [${a.name}](${a.url}) | **${won(a.price)}** | ${won(a.baseline)} | ${a.dropPct}% | ${a.isLowest ? "🔻 기록상 최저" : ""} |`
    ),
    "",
    "---",
    "",
    `최근 ${cfg.alert.baselineDays}일 기준, ${cfg.alert.dropPercent}% 이상 떨어졌을 때만 알립니다.`,
    "같은 가격으로는 " + cfg.alert.cooldownDays + "일 안에 다시 알리지 않습니다.",
    "가격은 상품 페이지가 공개한 값을 그대로 읽은 것이니, 사기 전에 실제 결제 금액을 확인하세요.",
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, "..", ".pricewatch-issue.md"), body + "\n", "utf8");
}

saveHistory(history);
const changed = JSON.stringify(history) !== before;

fs.appendFileSync(
  process.env.GITHUB_OUTPUT || "/dev/null",
  `changed=${changed ? "true" : "false"}\nalerted=${alerts.length ? "true" : "false"}\n`
);
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || "/dev/null", lines.join("\n") + "\n");
