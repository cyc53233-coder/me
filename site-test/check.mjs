import { chromium } from "playwright";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = path.join(ROOT, "site-test", "shots");
fs.mkdirSync(S, { recursive: true });

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const FIXTURE = `window.DEALS = [
  { title: "한돈 냉장 삼겹살 구이용 1kg", url: "https://toss.im/_m/a1", price: 14900, listPrice: 24900,
    mall: "toss", image: "", category: "고기·메인반찬", note: "이 가격이면 바로 담으세요",
    postedAt: "${new Date(Date.now() - 7 * 3600e3).toISOString()}", grade: 3 },
  { title: "오리온 초코파이 39g × 24개입", url: "https://link.coupang.com/a/b2", price: 5980, listPrice: 8900,
    mall: "coupang", image: "", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 18 * 3600e3).toISOString()}", grade: 1 },
  { title: "삼다수 무라벨 2L, 24병", url: "https://toss.im/_m/c3", price: 13000, listPrice: 17900,
    mall: "toss", image: "", category: "생활용품·기타",
    postedAt: "${new Date(Date.now() - 3 * 86400e3).toISOString()}", grade: 2, ended: true },
];`;

// 쇼핑몰 사진은 비율이 제각각이라, 세로로 긴 것과 가로로 넓은 것을 둘 다 물려 봅니다
const TALL = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1400"><rect width="600" height="1400" fill="#2b6cb0"/></svg>`);
const WIDE = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="500"><rect width="1600" height="500" fill="#c53030"/></svg>`);
const PHOTO_FIXTURE = `window.DEALS = [
  { title: "세로로 긴 사진 상품", url: "https://toss.im/_m/p1", price: 9900, listPrice: 19900,
    mall: "toss", image: "${TALL}", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 3600e3).toISOString()}", grade: 3 },
  { title: "가로로 넓은 사진 상품, 이름이 길어서 두 줄까지 넘어가는 경우를 같이 봅니다", url: "https://toss.im/_m/p2",
    price: 4500, mall: "toss", image: "${WIDE}", category: "고기·메인반찬",
    postedAt: "${new Date(Date.now() - 2 * 3600e3).toISOString()}", grade: 1 },
  { title: "사진을 못 읽은 상품", url: "https://link.coupang.com/a/p3", price: 12900,
    mall: "coupang", image: "", category: "생활용품·기타",
    postedAt: "${new Date(Date.now() - 3 * 3600e3).toISOString()}", grade: 2 },
];`;

const assert = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  " + m); };

const run = async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  const errors = [];
  async function open(path, { ua, chat, deals } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: ua, locale: "ko-KR" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(path + ": " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/pretendard|jsdelivr|net::ERR/i.test(m.text())) errors.push(path + " console: " + m.text()); });
    // 검사용 딜은 여기서 넣습니다 — 실제 배포되는 data/deals.js 와 섞지 않습니다
    await page.route("**/data/deals.js", (route) =>
      route.fulfill({ body: deals || FIXTURE, headers: { "content-type": "text/javascript" } })
    );
    // chat 을 주면(빈 문자열 포함) 설정의 초대 링크를 그 값으로 바꿔 끼웁니다
    if (chat !== undefined) await page.route("**/data/site.js", async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(/openChatUrl:\s*"[^"]*"/, `openChatUrl: "${chat}"`);
      await route.fulfill({ response: res, body, headers: { "content-type": "text/javascript" } });
    });
    await page.goto(BASE + path, { waitUntil: "load" });
    return page;
  }
  const noOverflow = async (page, name) => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), name + ": no horizontal overflow");
  const text = async (page) => (await page.locator("body").innerText());

  // 1. index, plain browser, no open chat url
  let page = await open("index.html", { chat: "" });
  assert((await page.title()).startsWith("핫딜 주워담기"), "title uses site name");
  assert((await page.locator(".notice-bar").textContent()).startsWith("* 쉐어링크"), "top bar shows the short disclosure");
  assert((await page.locator(".intro h1").textContent()) === "방금 올라온 핫딜", "title band restored");
  assert((await page.locator(".notice-bar").boundingBox()).height < 32, "disclosure bar fits one line");
  assert(await page.locator("#grade-chips .chip").count() === 4, "4 grade chips (전체 + 3)");
  {
    const ys = await page.locator("#grade-chips .chip").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    assert(new Set(ys).size === 1, `grade chips sit on one line (tops: ${ys.join(",")})`);
  }
  assert((await page.locator("#grade-chips .chip").nth(1).locator("span").allTextContents()).join("|") === "무지성급|🔥🔥🔥", "grade chip is two lines: label / fires");
  assert(await page.locator("#chips .chip").count() === 4, "category chips: 전체 + 3 configured, shown even with no deal in them");
  {
    const ys = await page.locator("#chips .chip").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    assert(new Set(ys).size === 1, `category chips sit on one line (tops: ${ys.join(",")})`);
  }
  assert(await page.locator(".deal").count() === 2, "ended deal is not shown at all");
  assert(await page.locator("#q, #sort, #ended, .js-copy").count() === 0, "no search, sort, ended toggle or copy button");
  const first = page.locator(".deal").first();
  assert(/시간 전$/.test((await first.locator(".deal-time").textContent()).trim()), "card shows how long ago it went up");
  assert((await first.locator(".grade").textContent()) === "무지성급🔥🔥🔥", "grade label next to the price");
  assert((await first.getAttribute("href")) === "https://toss.im/_m/a1", "card links straight to the deal");
  assert((await first.locator(".price-now").textContent()) === "14,900원", "price");
  assert((await first.locator(".price-was").textContent()) === "평소가 24,900원", "usual price line");
  assert(await first.locator(".price-was").evaluate((el) => getComputedStyle(el).textDecorationLine.includes("line-through")), "usual price struck through");
  assert(await first.locator(".chevron").count() === 1, "chevron on the right");
  assert(await first.locator(".thumb-empty").count() === 1, "mall icon stands in when a photo could not be read");
  const thumbBox = await first.locator(".thumb").boundingBox();
  assert(Math.round(thumbBox.width) === 88 && Math.round(thumbBox.height) === 88, "thumb is 88×88");
  const gb = await first.locator(".grade").boundingBox(), pb = await first.locator(".price-now").boundingBox();
  assert(Math.abs(gb.y - pb.y) < 12, `grade and price share one line (grade y=${Math.round(gb.y)}, price y=${Math.round(pb.y)})`);
  const real = await page.evaluate(() => dealCardHTML({ title: "실제 딜", url: "https://toss.im/_m/abc", price: 1000, grade: 2, postedAt: new Date().toISOString() }));
  assert(/^<a class="deal" href="https:\/\/toss\.im\/_m\/abc" target="_blank" rel="nofollow sponsored noopener">/.test(real.trim()), "real deal renders as a whole-card affiliate link");
  assert((await page.locator("#caption").textContent()) === "최신 등록순 · 최대 50개", "caption under the list");
  assert(await page.locator("#cta").count() === 0, "CTA removed when openChatUrl empty");
  assert(await page.locator("#kakao-notice").isHidden(), "kakao notice hidden in normal browser");
  assert(!(await text(page)).includes("@gmail"), "no contact on the list page");
  // menu
  assert(await page.locator("#menu").isHidden(), "menu closed by default");
  await page.click("#menu-btn");
  assert(await page.locator("#menu").isVisible() && (await page.locator("#menu a").count()) === 2, "menu opens with 2 links");
  assert(!(await text(page)).includes("딜 올리기"), "menu never advertises posting");
  await page.mouse.click(200, 600);
  assert(await page.locator("#menu").isHidden(), "menu closes on outside click");
  await noOverflow(page, "index");
  await page.screenshot({ path: S + "/index-phone.png", fullPage: true });
  // filters
  await page.locator("#grade-chips .chip", { hasText: "무지성급" }).click();
  assert(await page.locator(".deal").count() === 1, "grade filter → 1 card");
  await page.locator("#grade-chips .chip", { hasText: "전체" }).click();
  assert(await page.locator(".deal").count() === 2, "전체 → back to 2");
  await page.locator("#chips .chip", { hasText: "간식·음료" }).click();
  assert(await page.locator(".deal").count() === 1, "category filter → 1 card");
  await page.locator("#chips .chip", { hasText: "고기·메인반찬" }).click();
  assert(await page.locator(".deal").count() === 1, "another category filter → 1 card");
  await page.locator("#grade-chips .chip", { hasText: "무지성급" }).click();
  assert(await page.locator(".deal").count() === 1, "고기·메인반찬 + 무지성급 both match the same deal");
  // 겹치는 딜이 없는 조합에서만 빈 화면이 나와야 합니다
  await page.locator("#chips .chip", { hasText: "간식·음료" }).click();
  assert((await page.locator(".empty").textContent()).includes("조건에 맞는"), "empty state for an impossible combo");
  await page.close();

  // 2. index with open chat url + KakaoTalk in-app UA
  page = await open("index.html", { ua: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 KAKAOTALK/10.9.0" });
  assert(await page.locator("#cta a").isVisible(), "CTA visible with openChatUrl");
  assert((await page.locator("#cta a").textContent()) === "🔥 핫딜 주워담기 입장하기", "CTA label");
  assert((await page.locator("#cta a").getAttribute("href")) === "https://open.kakao.com/o/gtI7swOi", "설정의 초대 링크가 그대로 버튼에 걸림");
  assert(await page.locator("#kakao-notice").isVisible(), "kakao notice visible in KakaoTalk");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const cta = await page.locator("#cta a").boundingBox();
  const foot = await page.locator("footer").boundingBox();
  assert(foot.y + foot.height <= cta.y + 1, `footer bottom (${Math.round(foot.y + foot.height)}) is above the CTA (${Math.round(cta.y)})`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await noOverflow(page, "index+kakao");
  await page.screenshot({ path: S + "/index-kakao.png" });
  await page.close();

  // 3. about
  page = await open("about.html");
  assert(await page.locator("[data-site-grades] li").count() === 3, "about: 3 grade rows");
  assert(await page.locator("#등급").count() === 1, "about: grade anchor for the menu link");
  assert(await page.locator("[data-site-openchat] a.btn-cta").isVisible(), "about: open chat button");
  assert((await page.locator("[data-site-openchat] a").getAttribute("href")) === "https://open.kakao.com/o/gtI7swOi", "about: 같은 초대 링크");
  assert(await page.locator("#cta").count() === 0, "about: no fixed CTA");
  const aboutText = await text(page);
  assert(!aboutText.includes("연락처") && !aboutText.includes("@gmail"), "about: no contact section");
  assert(aboutText.includes("수수료") && aboutText.includes("게시 당시"), "about: disclosure and notes kept");
  await noOverflow(page, "about");
  await page.screenshot({ path: S + "/about-phone.png", fullPage: true });
  await page.close();
  page = await open("about.html", { chat: "" });
  assert((await page.locator("[data-site-openchat]").textContent()).includes("준비"), "about: placeholder when no chat url");
  await page.close();

  // 3-1. 사진이 붙은 카드
  page = await open("index.html", { chat: "", deals: PHOTO_FIXTURE });
  assert(await page.locator(".deal").count() === 3, "photo fixture: 3 cards");
  {
    const tall = page.locator(".deal").nth(0), wide = page.locator(".deal").nth(1), none = page.locator(".deal").nth(2);
    for (const [card, name] of [[tall, "세로 사진"], [wide, "가로 사진"]]) {
      const box = await card.locator("img.thumb").boundingBox();
      assert(Math.round(box.width) === 88 && Math.round(box.height) === 88, `${name}: 썸네일 칸이 88×88 로 고정`);
      const fit = await card.locator("img.thumb").evaluate((el) => getComputedStyle(el).objectFit);
      assert(fit === "contain", `${name}: 잘리지 않고 통째로 들어감 (object-fit: ${fit})`);
    }
    assert(await none.locator(".thumb-empty").count() === 1, "사진 없는 카드는 판매처 아이콘");
    // 카드 높이가 사진 때문에 들쭉날쭉해지지 않아야 합니다
    const hs = await page.locator(".deal").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    assert(Math.max(...hs) - Math.min(...hs) <= 30, `카드 높이가 고르게 유지됨 (${hs.join(", ")})`);
    // 두 줄로 잘린 긴 상품명이 가격을 밀어내지 않아야 합니다
    const gb = await wide.locator(".grade").boundingBox(), pb = await wide.locator(".price-now").boundingBox();
    assert(Math.abs(gb.y - pb.y) < 12, "긴 이름 카드에서도 등급과 가격이 한 줄");
  }
  await noOverflow(page, "index+photos");
  await page.screenshot({ path: S + "/index-photos.png", fullPage: true });
  await page.close();

  // 4. add
  page = await open("add.html");
  assert(await page.locator("#f-grade option").count() === 4, "add: grade select options");
  await page.fill("#f-title", "테스트 상품"); await page.fill("#f-url", "https://toss.im/_m/abc"); await page.fill("#f-price", "9900");
  await page.selectOption("#f-grade", "2");
  assert((await page.locator("#out-code").textContent()).includes("grade: 2,"), "add: code has grade");
  assert((await page.locator("#out-kakao").textContent()).startsWith("🔥🔥 대박"), "add: kakao text starts with grade");
  assert((await page.locator("#preview .grade").textContent()) === "대박🔥🔥", "add: preview badge");
  assert((await page.locator("#preview a.deal").getAttribute("href")) === "https://toss.im/_m/abc", "add: preview card links to the deal");
  await noOverflow(page, "add");
  await page.close();

  await browser.close();
  if (errors.length) { console.error(errors.join("\n")); throw new Error("페이지 오류"); }
  console.log("ALL OK");
};

try {
  await run();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  server.close();
}
