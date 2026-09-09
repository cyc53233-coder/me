import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));   // ledger/
const INDEX = join(LEDGER, "index.html");
const ARTIFACT = join(LEDGER, "artifact.html");
const S = mkdtempSync(join(tmpdir(), "ledger-shot-"));
const body = readFileSync(ARTIFACT, "utf-8");
writeFileSync(`${S}/w2.html`, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ko-KR" });
const page = await ctx.newPage();
await page.goto("file://" + S + "/w2.html");
await page.waitForTimeout(700);
// 지출 폼 열고 수식 입력한 상태
await page.evaluate(() => { document.querySelector("#expAdder").open = true; });
await page.fill("#expAmt", "12000+3500-2000");
await page.fill("#expMemo", "이마트 장보기");
await page.waitForTimeout(200);
await page.locator("#expAmt").scrollIntoViewIfNeeded();
await page.screenshot({ path: S + "/shot-formula.png" });
// 패드 열기
await page.click("label.f:has(#expAmt) .calc-open");
await page.waitForTimeout(300);
for (const k of ["C","4","5","0","0","0","×","3"]) await page.click(`#calcKeys button:text-is("${k}")`);
await page.waitForTimeout(200);
await page.screenshot({ path: S + "/shot-pad.png" });
await b.close();
console.log("스크린샷: " + S);
