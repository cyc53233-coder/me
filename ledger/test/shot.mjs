// 폰 크기 화면 확인용 스크린샷 — 테스트가 아니라 눈으로 보는 용도 (npm run shot)
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));   // ledger/
const S = mkdtempSync(join(tmpdir(), "ledger-shot-"));
writeFileSync(`${S}/index.html`, readFileSync(join(LEDGER, "index.html"), "utf-8"));

// 한 달 치처럼 보이는 예시 기록 — 화면 밀도를 실제와 비슷하게
const NOW = new Date("2026-09-20T12:00:00");
const e = (date, type, amount, memo, category, who, t) =>
  ({ id: "s" + t, type, date, month: date.slice(0, 7), amount, memo, category: type === "expense" ? category : "", who, createdAt: NOW.getTime() - 1e6 + t });
const seed = {
  entries: [
    e("2026-09-01", "income", 300000, "9월 생활비", "", "m0", 1),
    e("2026-09-01", "income", 300000, "9월 생활비", "", "m1", 2),
    e("2026-09-03", "expense", 45900, "이마트 장보기", "마트·장보기", "both", 3),
    e("2026-09-07", "expense", 18000, "배민 치킨", "외식·배달", "m0", 4),
    e("2026-09-12", "expense", 55000, "통신비", "통신·구독", "both", 5),
    e("2026-09-18", "expense", 6800, "메가커피", "카페·간식", "m1", 6),
    e("2026-09-20", "expense", 12300, "스타벅스", "카페·간식", "m0", 7),
    e("2026-09-20", "expense", 3200, "쿠팡 · 서울우유 900ml", "마트·장보기", "both", 8),
  ],
  pantry: [
    { id: "p1", name: "서울우유 900ml", buyAt: "2026-09-18", expireAt: "2026-09-21", guessed: true, createdAt: 1 },
    { id: "p2", name: "두부", buyAt: "2026-09-15", expireAt: "2026-09-19", guessed: false, createdAt: 2 },
    { id: "p3", name: "신라면 5개입", qty: "1봉", buyAt: "2026-09-10", expireAt: "2027-09-10", guessed: true, createdAt: 3 },
  ],
  members: ["용철", "다니"],
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const width of [390, 430]) {
  const ctx = await b.newContext({ viewport: { width, height: 860 }, locale: "ko-KR", deviceScaleFactor: 2 });
  await ctx.clock.install({ time: NOW });
  await ctx.addInitScript(s => { if (!localStorage.getItem("dani-ledger-v1")) localStorage.setItem("dani-ledger-v1", s); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  await page.goto("file://" + S + "/index.html");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${S}/${width}-1-ledger.png` });
  await page.click("#quickAdd"); await page.waitForTimeout(250);
  await page.fill("#entAmt", "12000+3500");
  await page.fill("#entMemo", "이마트 장보기");
  await page.screenshot({ path: `${S}/${width}-2-add.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  await page.click("#tb-fridge"); await page.waitForTimeout(200);
  await page.screenshot({ path: `${S}/${width}-3-fridge.png` });
  await page.click("#settingsBtn"); await page.waitForTimeout(350);
  await page.screenshot({ path: `${S}/${width}-4-menu.png` });
  await ctx.close();
}
await b.close();
console.log("스크린샷: " + S);
