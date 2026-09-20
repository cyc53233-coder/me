/* 마감·품절이 파일에 실제로 저장되는지 봅니다.
   예전에 endedAt 이 KEY_ORDER 에 없어 조용히 버려졌고, 화면 검사만으로는
   그걸 잡지 못했습니다 — 픽스처에는 endedAt 을 손으로 적어 넣었으니까요. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "deal-state-"));
for (const d of ["data", "scripts", "assets"]) fs.mkdirSync(path.join(tmp, d));
for (const f of fs.readdirSync(path.join(ROOT, "scripts")))
  fs.copyFileSync(path.join(ROOT, "scripts", f), path.join(tmp, "scripts", f));
fs.copyFileSync(path.join(ROOT, "data/site.js"), path.join(tmp, "data/site.js"));
fs.copyFileSync(path.join(ROOT, "assets/app.js"), path.join(tmp, "assets/app.js"));
const header = fs.readFileSync(path.join(ROOT, "data/deals.js"), "utf8").split("window.DEALS = [")[0];
fs.writeFileSync(
  path.join(tmp, "data/deals.js"),
  header + 'window.DEALS = [\n  {\n    title: "시험용 딜",\n    url: "https://toss.im/_m/zzz",\n    price: 1000,\n  },\n];\n'
);

let fail = 0;
const ok = (c, m) => { if (c) console.log("ok  " + m); else { fail++; console.log("FAIL " + m); } };

process.chdir(tmp);
const { readDeals, writeDeals, nowKST } = await import(path.join(tmp, "scripts/deals-file.mjs"));

// 상태 필드가 파일을 한 번 왕복해도 살아남아야 합니다
const d = readDeals();
d[0].soldOut = true;
d[0].soldOutAt = nowKST();
d[0].deadStrikes = 2;
writeDeals(d);
let back = readDeals()[0];
ok(back.soldOut === true, "soldOut 이 저장됨");
ok(typeof back.soldOutAt === "string" && back.soldOutAt.length > 10, `soldOutAt 이 저장됨 (${back.soldOutAt})`);
ok(back.deadStrikes === 2, "deadStrikes 가 저장됨");

back.ended = true;
back.endedAt = nowKST();
writeDeals([back]);
back = readDeals()[0];
ok(back.ended === true, "ended 가 저장됨");
ok(typeof back.endedAt === "string" && back.endedAt.length > 10, `endedAt 이 저장됨 (${back.endedAt})`);

// 사이트가 그 값을 읽어 실제로 "잠깐 남기는" 판단을 하는지
const ctx = { console, window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, navigator: {} };
const vm = await import("node:vm");
vm.createContext(ctx);
for (const rel of ["data/site.js", "data/deals.js", "assets/app.js"])
  vm.runInContext(fs.readFileSync(path.join(tmp, rel), "utf8"), ctx, { filename: rel });
const hours = ctx.window.SITE.endedHours;
const iso = (h) => new Date(Date.now() - h * 3600e3).toISOString();
ok(ctx.stillShown({ ended: true, endedAt: iso(1) }) === true, "방금 마감한 딜은 남음");
ok(ctx.stillShown({ ended: true, endedAt: iso(hours + 1) }) === false, `${hours}시간 지난 마감은 사라짐`);
ok(ctx.stillShown({ soldOut: true, soldOutAt: iso(1) }) === true, "방금 품절된 딜은 남음");
ok(ctx.stillShown({ soldOut: true, soldOutAt: iso(hours + 1) }) === false, `${hours}시간 지난 품절은 사라짐`);
ok(ctx.stillShown({ ended: true }) === false, "언제 마감됐는지 모르는 옛 딜은 숨김");
ok(ctx.stillShown({ price: 1 }) === true, "파는 중인 딜은 그대로 보임");
ok(ctx.statusOf({ soldOut: true }).label === "품절", "품절 배지 글자");
ok(ctx.statusOf({ ended: true, soldOut: true }).label === "마감", "마감이 품절보다 우선");

process.chdir(ROOT);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail ? `\n${fail}건 실패` : "\n마감·품절 상태 검사 통과");
process.exit(fail ? 1 : 0);
