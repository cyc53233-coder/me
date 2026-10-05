// 홈 화면 앱(PWA) 검사 — 배포 zip에 들어가는 파일만 로컬 HTTP로 띄워서 본다.
// (서비스 워커는 file:// 에서 안 돌아서 page.mjs와 따로 둔다)
import { createServer } from "node:http";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { FILES } from "../build-zip.mjs";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = mkdtempSync(join(tmpdir(), "ledger-pwa-"));
for (const f of FILES) { mkdirSync(dirname(join(ROOT, f)), { recursive: true }); cpSync(join(LEDGER, f), join(ROOT, f)); }

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = readFileSync(join(ROOT, p));
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://localhost:" + server.address().port;
const URL0 = ORIGIN + "/";
const SHOTS = mkdtempSync(join(tmpdir(), "ledger-pwa-shots-"));

const fails = [];
const check = (name, cond, extra = "") => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); if (!cond) fails.push(name); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosNaver: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.6.1)",
  kakaoAndroid: "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 KAKAOTALK 10.8.2",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
};
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: 844 }, locale: "ko-KR", userAgent: opts.ua, deviceScaleFactor: 2 });
  // 외부 SDK는 막는다 — 이 검사는 Firebase가 아니라 앱 껍데기를 본다 (필요하면 스텁을 심는다)
  await ctx.route(/^https:\/\/(www\.gstatic\.com|cdn\.jsdelivr\.net|fonts\.)/, r => opts.slowCdn
    ? setTimeout(() => r.abort().catch(() => {}), opts.slowCdn) : r.abort());
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR", e.message); fails.push("pageerror: " + e.message); });
  return { ctx, page };
}

// ---- 매니페스트 · 아이콘 ----
{
  const m = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf-8"));
  check("매니페스트: 이름", m.name === "다니랑 생활비" && !!m.short_name);
  check("매니페스트: standalone", m.display === "standalone");
  check("매니페스트: 시작·범위가 상대경로(하위 경로·루트 어디서나)", m.start_url === "./" && m.scope === "./");
  check("매니페스트: 한국어", m.lang === "ko");
  const sizeOf = f => { const b = readFileSync(join(ROOT, f)); return b.slice(1, 4).toString() === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
  for (const ic of m.icons) {
    const wh = sizeOf(ic.src);
    check(`아이콘: ${ic.src} 실제 크기 ${ic.sizes}`, wh && `${wh[0]}x${wh[1]}` === ic.sizes, JSON.stringify(wh));
  }
  check("아이콘: 192·512·maskable 모두 있음", ["192x192", "512x512"].every(s => m.icons.some(i => i.sizes === s && i.purpose !== "maskable")) && m.icons.some(i => i.purpose === "maskable"));
  check("아이콘: iOS용 180px", JSON.stringify(sizeOf("icons/apple-touch-icon.png")) === "[180,180]");
}

// ---- 서비스 워커 · 오프라인 · 로딩 화면 ----
{
  const { ctx, page } = await open({ slowCdn: 2500 });
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto(URL0, { waitUntil: "commit" });     // 다 뜨기 전 — 외부 스크립트를 기다리는 동안
  await page.waitForTimeout(700);
  check("로딩 화면: 연결 확인 중에는 보임", await page.locator("#splash:not(.gone)").count() === 1);
  check("로딩 화면: 완전히 가림", await page.evaluate(() => getComputedStyle(document.querySelector("#splash")).opacity) === "1");
  check("로딩 화면: 확인 중엔 '공유 꺼짐' 경고를 미리 띄우지 않음", await page.locator("#shareBanner.show").count() === 0);
  // page.screenshot은 페이지가 다 뜰 때까지 기다리므로, 뜨는 중인 화면은 CDP로 바로 찍는다
  const cdp = await ctx.newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOTS + "/390-0-splash.png", Buffer.from(data, "base64"));
  await page.waitForTimeout(3000);
  check("로딩 화면: 연결이 끝나면 사라짐", await page.locator("#splash").count() === 0);
  check("매니페스트 링크", await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href")) === "manifest.webmanifest");
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  check("서비스 워커: 등록·활성", reg);
  await page.waitForTimeout(500);
  check("처음 설치 때 저절로 새로고침하지 않음", loads === 1, loads + "번 로드");
  await page.reload(); await page.waitForTimeout(1500);
  check("서비스 워커: 다시 열면 화면을 맡음", await page.evaluate(() => !!navigator.serviceWorker.controller));

  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(2500);
  check("오프라인: 앱 화면이 뜸", await page.locator("#tb-ledger").count() === 1 && await page.locator("#splash").count() === 0);
  check("오프라인: 이 기기에만이라고 솔직히 표시", (await page.locator("#connText").textContent()).includes("이 기기에만") && await page.locator("#shareBanner.show").count() === 1);
  await ctx.setOffline(false);

  // 새 버전: sw.js가 바뀌면 배너 → [새로고침] → 새 워커로 넘어감
  const swPath = join(ROOT, "sw.js");
  const sw0 = readFileSync(swPath, "utf-8");
  writeFileSync(swPath, sw0.replace(/const VERSION = "[0-9a-f]*";/, 'const VERSION = "testnext01";'));
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForTimeout(1500);
  check("새 버전: 배너 표시", await page.locator("#updateBanner.show").count() === 1);
  await Promise.all([page.waitForEvent("load", { timeout: 8000 }).catch(() => null), page.click("#updateGo")]);
  await page.waitForTimeout(1200);
  const keys = await page.evaluate(() => caches.keys());
  check("새 버전: 새로고침 후 새 캐시로 바뀜", keys.includes("ledger-testnext01") && keys.length === 1, JSON.stringify(keys));
  check("새 버전: 새로고침 후 배너 없음", await page.locator("#updateBanner.show").count() === 0);
  writeFileSync(swPath, sw0);
  await ctx.close();
}

// ---- 설치 안내 배너: 환경별 ----
{
  const { ctx, page } = await open({ ua: UA.iosSafari });
  await page.goto(URL0); await page.waitForTimeout(900);
  const t = await page.locator("#installText").textContent();
  check("설치(iOS 사파리): 공유 → 홈 화면에 추가 안내", await page.locator("#installBanner.show").count() === 1 && t.includes("공유") && t.includes("홈 화면에 추가"), t);
  check("설치(iOS 사파리): 링크 복사 버튼 (설치한 앱은 저장 공간이 따로)", await page.locator("#installCopy").isVisible() && await page.locator("#installGo").isHidden());
  await page.screenshot({ path: SHOTS + "/390-1-install-ios.png" });
  await page.click("#installClose"); await page.waitForTimeout(150);
  check("설치(iOS): 닫으면 사라짐", await page.locator("#installBanner.show").count() === 0);
  await page.reload(); await page.waitForTimeout(900);
  check("설치(iOS): 닫은 건 기억", await page.locator("#installBanner.show").count() === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open({ ua: UA.iosNaver });
  await page.goto(URL0); await page.waitForTimeout(900);
  check("설치(네이버 앱 안): 사파리로 열라고 안내", (await page.locator("#installText").textContent()).includes("사파리"));
  await ctx.close();
}
{
  const { ctx, page } = await open({ ua: UA.kakaoAndroid, width: 430 });
  await page.goto(URL0 + "#l=abcdefgh12345678abcdef"); await page.waitForTimeout(900);
  const t = await page.locator("#installText").textContent();
  check("설치(카톡): 브라우저로 열기 안내", t.includes("카톡"), t);
  check("설치(카톡): [브라우저로 열기] + [링크 복사]", (await page.locator("#installGo").textContent()) === "브라우저로 열기" && await page.locator("#installCopy").isVisible());
  check("설치(카톡): 닫기 없음 — 카톡 안에선 계속 알림", await page.locator("#installClose").isHidden());
  await page.screenshot({ path: SHOTS + "/430-2-install-kakao.png" });
  // [브라우저로 열기]가 가는 곳 — 커스텀 스킴이라 실제로 열리진 않으니 요청을 붙잡아 주소만 본다
  const opened = page.waitForRequest(r => r.url().startsWith("kakaotalk:"), { timeout: 2000 }).then(r => r.url()).catch(() => "");
  await page.click("#installGo");
  const ext = await opened;
  check("설치(카톡): 카톡 외부 브라우저 열기 주소", ext.startsWith("kakaotalk://web/openExternal?url="), ext.slice(0, 60));
  check("설치(카톡): 여는 주소에 가계부 코드 포함", decodeURIComponent(ext).includes("#l=abcdefgh12345678abcdef"));
  await ctx.close();
}
{
  const { ctx, page } = await open({ ua: UA.androidChrome });
  await page.goto(URL0); await page.waitForTimeout(900);
  check("설치(안드로이드): 크롬이 설치 창을 주기 전엔 배너 없음", await page.locator("#installBanner.show").count() === 0);
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    e.prompt = () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(150);
  check("설치(안드로이드): [설치] 버튼", await page.locator("#installBanner.show").count() === 1 && (await page.locator("#installGo").textContent()) === "설치");
  await page.click("#installGo"); await page.waitForTimeout(200);
  check("설치(안드로이드): 누르면 크롬 설치 창", await page.evaluate(() => window.__prompted === true));
  check("설치(안드로이드): 한 번 쓰면 배너 내려감", await page.locator("#installBanner.show").count() === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open({ ua: UA.iosSafari, init: () => Object.defineProperty(navigator, "standalone", { get: () => true }) });
  await page.goto(URL0); await page.waitForTimeout(900);
  check("설치: 이미 홈 화면 앱으로 열었으면 배너 없음", await page.locator("#installBanner.show").count() === 0);
  await ctx.close();
}

// ---- 가계부 코드가 없는 기기 (아이폰 홈 화면 앱 첫 실행 등) ----
const FB_STUB = () => {
  const tree = {};
  const parts = p => p.split("/").filter(Boolean);
  const get = p => { let n = tree; for (const k of parts(p)) { if (!n || typeof n !== "object") return null; n = n[k]; } return n ?? null; };
  const listeners = [];
  const ref = p => ({
    child: s => ref(p + "/" + s),
    on(e, cb){ listeners.push([p, cb]); cb({ val: () => get(p) }); return cb; },
    off(){},
    set(v){ const ks = parts(p), last = ks.pop(); let n = tree; for (const k of ks) n = n[k] = n[k] || {}; n[last] = v; listeners.forEach(([lp, cb]) => cb({ val: () => get(lp) })); return Promise.resolve(); },
    remove(){ return this.set(null); },
  });
  window.__refs = [];
  window.firebase = {
    initializeApp(){},
    auth: () => ({ signInAnonymously: () => Promise.resolve({}) }),
    database: () => ({ ref: p => { window.__refs.push(p); return ref(p); } }),
  };
};
{
  const { ctx, page } = await open({ init: FB_STUB });
  await page.goto(URL0); await page.waitForTimeout(900);
  check("코드 없음: 새로 만들지 않고 먼저 물어봄", await page.locator("#connectSheet.show").count() === 1 && (await page.evaluate(() => window.__refs.length)) === 0);
  check("코드 없음: 로딩 화면이 가리지 않음", await page.locator("#splash").count() === 0);
  await page.screenshot({ path: SHOTS + "/390-3-connect.png" });
  await page.mouse.click(10, 10);     // 시트 바깥(배경)
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  check("코드 없음: 배경·Esc로 닫히지 않음 (골라야 함)", await page.locator("#connectSheet.show").count() === 1);
  await page.fill("#connectUrl", "아무 글자");
  await page.click("#connectGo"); await page.waitForTimeout(150);
  check("코드 없음: 링크가 아니면 안내하고 그대로", await page.locator("#connectSheet.show").count() === 1 && (await page.locator("#toast").textContent()).includes("초대 링크"));
  await page.fill("#connectUrl", "https://cyc53233-coder.github.io/me/ledger/#l=abcdefgh12345678abcdef");
  await page.click("#connectGo"); await page.waitForTimeout(500);
  check("코드 없음: 붙여넣은 링크의 가계부로 연결", (await page.evaluate(() => window.__refs)).includes("ledgers/abcdefgh12345678abcdef"));
  check("코드 없음: 주소에 코드가 붙음", page.url().endsWith("#l=abcdefgh12345678abcdef"));
  check("코드 없음: 공유 중", (await page.locator("#connText").textContent()).includes("공유 중"));
  await page.goto(URL0); await page.waitForTimeout(900);
  check("코드 없음: 한 번 연결하면 다음엔 안 물어봄", await page.locator("#connectSheet.show").count() === 0 && (await page.evaluate(() => window.__refs)).includes("ledgers/abcdefgh12345678abcdef"));
  await ctx.close();
}
{
  const { ctx, page } = await open({ init: FB_STUB });
  await page.goto(URL0); await page.waitForTimeout(900);
  await page.click("#connectNew"); await page.waitForTimeout(500);
  const ref = (await page.evaluate(() => window.__refs))[0] || "";
  check("코드 없음: [새 가계부 만들기] → 새 코드", /^ledgers\/[a-z0-9]{22}$/.test(ref), ref);
  check("코드 없음: 새로 만들면 초대 안내", (await page.locator("#toast").textContent()).includes("초대 링크"));
  await ctx.close();
}

// ---- 폰 크기 화면 (430) ----
{
  const { ctx, page } = await open({ ua: UA.iosSafari, width: 430 });
  await page.goto(URL0); await page.waitForTimeout(900);
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check("430px: 가로 스크롤 없음", !hs);
  await page.screenshot({ path: SHOTS + "/430-1-install-ios.png" });
  await ctx.close();
}

await browser.close();
server.close();
console.log("스크린샷: " + SHOTS);
if (fails.length) { console.log("\nFAILED: " + fails.join(" | ")); process.exit(1); }
console.log("\nall pwa checks ok");
