/* assets/og.html 을 1200×630 으로 찍어 assets/og.png 를 만듭니다.
   카톡·인스타 링크 미리보기에 쓰는 사진이라 래스터여야 합니다. */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const chromePath = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  let bundled = "";
  try { bundled = chromium.executablePath(); } catch {}
  if (bundled && fs.existsSync(bundled)) return "";
  const preinstalled = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH || "", "chromium");
  return process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(preinstalled) ? preinstalled : "";
};

const exe = chromePath();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.join(ROOT, "assets", "og.html")).href, { waitUntil: "networkidle" });
const out = path.join(ROOT, "assets", "og.png");
await page.screenshot({ path: out });
await browser.close();
console.log("만들었습니다: " + path.relative(ROOT, out) + " (" + Math.round(fs.statSync(out).size / 1024) + "KB)");
