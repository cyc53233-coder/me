import { chromium } from "playwright";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = path.join(ROOT, "site-test", "shots");
fs.mkdirSync(S, { recursive: true });

// 실제 배포(Pages·Workers)가 내주는 것과 같게 둡니다. 여기서 빠뜨리면
// 파일이 멀쩡해도 검사만 엉뚱하게 실패하거나, 반대로 진짜 문제를 놓칩니다.
const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
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
    mall: "toss", image: "", category: "신선식품", note: "이 가격이면 바로 담으세요",
    postedAt: "${new Date(Date.now() - 7 * 3600e3).toISOString()}", grade: 5 },
  { title: "오리온 초코파이 39g × 24개입", url: "https://link.coupang.com/a/b2", price: 5980, listPrice: 8900,
    mall: "coupang", image: "", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 18 * 3600e3).toISOString()}", grade: 1 },
  { title: "삼다수 무라벨 2L, 24병", url: "https://toss.im/_m/c3", price: 13000, listPrice: 17900,
    mall: "toss", image: "", category: "생활용품",
    postedAt: "${new Date(Date.now() - 3 * 86400e3).toISOString()}", grade: 3, ended: true },
];`;

// 방금 마감한 딜은 잠깐 "마감" 으로 남고, 오래전 마감한 딜은 사라집니다
const ENDED_FIXTURE = `window.DEALS = [
  { title: "살아 있는 딜", url: "https://toss.im/_m/e1", price: 1000, mall: "toss", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 3600e3).toISOString()}", grade: 3 },
  { title: "방금 마감한 딜", url: "https://toss.im/_m/e2", price: 2000, mall: "toss", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 5 * 3600e3).toISOString()}", grade: 3,
    ended: true, endedAt: "${new Date(Date.now() - 3600e3).toISOString()}" },
  { title: "오래전 마감한 딜", url: "https://toss.im/_m/e3", price: 3000, mall: "toss", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 20 * 86400e3).toISOString()}", grade: 1,
    ended: true, endedAt: "${new Date(Date.now() - 10 * 86400e3).toISOString()}" },
  { title: "방금 품절된 딜", url: "https://toss.im/_m/e4", price: 400, mall: "toss", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 2 * 3600e3).toISOString()}", grade: 5,
    soldOut: true, soldOutAt: "${new Date(Date.now() - 3600e3).toISOString()}" },
];`;

// 쇼핑몰 사진은 비율이 제각각이라, 세로로 긴 것과 가로로 넓은 것을 둘 다 물려 봅니다
const TALL = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1400"><rect width="600" height="1400" fill="#2b6cb0"/></svg>`);
const WIDE = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="500"><rect width="1600" height="500" fill="#c53030"/></svg>`);
const PHOTO_FIXTURE = `window.DEALS = [
  { title: "세로로 긴 사진 상품", url: "https://toss.im/_m/p1", price: 9900, listPrice: 19900,
    mall: "toss", image: "${TALL}", category: "간식·음료",
    postedAt: "${new Date(Date.now() - 3600e3).toISOString()}", grade: 5 },
  { title: "가로로 넓은 사진 상품, 이름이 길어서 두 줄까지 넘어가는 경우를 같이 봅니다", url: "https://toss.im/_m/p2",
    price: 4500, mall: "toss", image: "${WIDE}", category: "신선식품",
    postedAt: "${new Date(Date.now() - 2 * 3600e3).toISOString()}", grade: 1 },
  { title: "사진을 못 읽은 상품", url: "https://link.coupang.com/a/p3", price: 12900,
    mall: "coupang", image: "", category: "생활용품",
    postedAt: "${new Date(Date.now() - 3 * 3600e3).toISOString()}", grade: 3 },
];`;

const assert = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  " + m); };

// 어느 크롬으로 열지 — playwright 가 받아 둔 것이 우선입니다.
// 그게 없으면 (미리 크롬이 깔린 컨테이너에서 playwright 만 새로 받았을 때가 그렇습니다)
// PLAYWRIGHT_BROWSERS_PATH 의 크롬으로 넘어갑니다. CHROMIUM_PATH 로 직접 짚어 줄 수도 있습니다.
const chromePath = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  let bundled = "";
  try { bundled = chromium.executablePath(); } catch {}
  if (bundled && fs.existsSync(bundled)) return "";
  const preinstalled = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH || "", "chromium");
  return process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(preinstalled) ? preinstalled : "";
};

/* 브라우저를 띄우기 전에 — 설정과 이슈 폼이 어긋나지 않았는지 봅니다.
   어긋나면 화면은 멀쩡한데 등급·카테고리만 조용히 틀어져서 제일 늦게 발견됩니다. */
const loadSite = () => { const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, "data/site.js"), "utf8"))(w); return w.SITE; };
const SHARE_INTRO = loadSite().shareIntro;

const checkConfigMatchesForm = () => {
  const load = (f) => { const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, f), "utf8"))(w); return w; };
  const SITE = load("data/site.js").SITE;
  const cats = SITE.categories.map((c) => (typeof c === "string" ? c : c.name));
  const fires = SITE.grades.map((g) => g.fire).sort((a, b) => b - a);
  const form = fs.readFileSync(path.join(ROOT, ".github/ISSUE_TEMPLATE/deal-add.yml"), "utf8");
  const strip = (v) => v.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const formCats = [...form.matchAll(/^        - (.+)$/gm)].map((m) => m[1].trim())
    .filter((v) => !/🔥/.test(v)).map(strip);
  const formFires = [...form.matchAll(/"(.+?🔥+.*?)"/g)].map((m) => (m[1].match(/🔥/g) || []).length);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert(same(formCats, cats), `이슈 폼의 카테고리가 설정과 같음 (폼 ${formCats} / 설정 ${cats})`);
  assert(same(formFires, fires), `이슈 폼의 🔥 개수가 설정과 같음 (폼 ${formFires} / 설정 ${fires})`);
  // 올라와 있는 딜이 전부 지금 등급표·카테고리 안에 있는지
  const deals = load("data/deals.js").DEALS.filter((d) => !d.ended);
  const strayG = deals.filter((d) => d.grade !== undefined && !fires.includes(d.grade));
  assert(!strayG.length, `모든 딜의 grade 가 등급표 안에 있음 (밖: ${strayG.map((d) => d.title).join(", ")})`);
  const strayC = deals.filter((d) => d.category && !cats.includes(d.category));
  assert(!strayC.length, `모든 딜의 category 가 설정 안에 있음 (밖: ${strayC.map((d) => d.category).join(", ")})`);
};

const run = async () => {
  checkConfigMatchesForm();
  const exe = chromePath();
  if (exe) console.log("크롬: " + exe);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  // 단언이 깨져도 브라우저는 닫아야 합니다. 안 그러면 node 가 끝나지 않고
  // 실패가 "멈춤" 으로 보여 원인을 못 찾습니다.
  try {
    return await body(browser);
  } finally {
    await browser.close();
  }
};

const body = async (browser) => {
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
  assert((await page.locator("#grade-chips .chip").nth(1).locator("span").allTextContents()).join("|") === "무지성급|🔥🔥🔥🔥🔥", "grade chip is two lines: label / fires");
  assert(await page.locator("#chips .chip").count() === 5, "카테고리 칩: 전체 + 설정한 4개, 딜이 없어도 보임");
  {
    const ys = await page.locator("#chips .chip").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    assert(new Set(ys).size === 1, `category chips sit on one line (tops: ${ys.join(",")})`);
  }
  assert(await page.locator(".deal").count() === 2, "ended deal is not shown at all");
  assert(await page.locator("#q, #ended, .js-copy").count() === 0, "no search, ended toggle or copy button");
  const first = page.locator(".deal").first();
  assert(/시간 전$/.test((await first.locator(".deal-time").textContent()).trim()), "card shows how long ago it went up");
  assert((await first.locator(".grade").textContent()) === "무지성급🔥🔥🔥🔥🔥", "등급이 가격 옆에 붙음");
  assert((await first.locator(".deal-link").getAttribute("href")) === "https://toss.im/_m/a1", "card links straight to the deal");
  {
    // 링크가 카드를 통째로 덮는지 — 공유 버튼이 생겨도 "카드 전체가 링크" 는 지켜져야 합니다
    // 테두리 1px 은 링크 바깥이라 양쪽 2px 까지는 덮은 것으로 봅니다
    const card = await first.boundingBox(), link = await first.locator(".deal-link").boundingBox();
    const gap = Math.max(
      Math.abs(card.x - link.x), Math.abs(card.y - link.y),
      Math.abs(card.width - link.width), Math.abs(card.height - link.height)
    );
    assert(gap <= 2, `링크가 카드 전체를 덮음 (최대 어긋남 ${gap}px)`);
  }
  assert((await first.locator(".price-now").textContent()) === "14,900원", "price");
  assert((await first.locator(".price-was").textContent()).startsWith("평소가 24,900원"), "usual price line");
  assert((await first.locator(".rate").textContent()) === "40%↓", "할인율이 평소가 옆에 붙음");
  assert(await first.locator(".price-was").evaluate((el) => getComputedStyle(el).textDecorationLine.includes("line-through")), "usual price struck through");
  assert(await first.locator(".share").count() === 1, "공유 버튼이 카드마다 하나");
  assert(await first.locator(".thumb-empty").count() === 1, "mall icon stands in when a photo could not be read");
  const thumbBox = await first.locator(".thumb").boundingBox();
  assert(Math.round(thumbBox.width) === 88 && Math.round(thumbBox.height) === 88, "thumb is 88×88");
  const gb = await first.locator(".grade").boundingBox(), pb = await first.locator(".price-now").boundingBox();
  // 예전에는 "등급과 가격이 한 줄" 인지를 봤습니다. 그건 대리 조건이고, 🔥 가 5개가 되면서
  // 한 줄에 안 들어가게 됐습니다. 진짜 요구는 "가격이 잘리거나 공유 버튼에 겹치지 않는 것" 입니다.
  {
    const noClip = await page.locator(".deal").evaluateAll((cards) =>
      cards.map((c) => {
        const body = c.querySelector(".deal-body");
        const row = c.querySelector(".deal-price");
        const price = c.querySelector(".price-now");
        const share = c.querySelector(".share");
        return {
          t: c.querySelector(".deal-title").textContent.slice(0, 12),
          over: row.scrollWidth - Math.round(body.getBoundingClientRect().width),
          hit: share
            ? Math.round(price.getBoundingClientRect().right - share.getBoundingClientRect().left)
            : -999,
        };
      })
    );
    const bad = noClip.filter((c) => c.over > 1 || c.hit > 0);
    assert(!bad.length, `가격이 잘리거나 공유 버튼에 겹치지 않음 (${bad.map((b) => `${b.t} 넘침${b.over} 겹침${b.hit}`).join(" / ") || "전부 ok"})`);
  }
  const real = await page.evaluate(() => dealCardHTML({ title: "실제 딜", url: "https://toss.im/_m/abc", price: 1000, grade: 2, postedAt: new Date().toISOString() }, 0));
  assert(/<a class="deal-link" href="https:\/\/toss\.im\/_m\/abc" target="_blank" rel="nofollow sponsored noopener"/.test(real), "실제 딜은 제휴 링크로 그려짐");
  assert((await page.locator("#count").textContent()) === "2개", "목록 개수 표시");
  assert(await page.locator("#cta").count() === 0, "CTA removed when openChatUrl empty");
  assert(await page.locator("#kakao-notice").isHidden(), "kakao notice hidden in normal browser");
  assert(!(await text(page)).includes("@gmail"), "no contact on the list page");

  // ── 한 줄 메모 · 정렬 · 공유 · 미리보기 사진 ──────────────────
  assert((await first.locator(".deal-note").textContent()) === "이 가격이면 바로 담으세요", "한 줄 메모가 카드에 보임");
  assert(await page.locator(".deal").nth(1).locator(".deal-note").count() === 0, "메모 없는 딜은 그 줄이 아예 없음");
  {
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    assert(/^https?:\/\/.+\/assets\/og\.png$/.test(og), `og:image 가 절대주소 (${og})`);
    const ou = await page.locator('meta[property="og:url"]').getAttribute("content");
    assert(/^https?:\/\/.+index\.html$/.test(ou), `og:url 이 절대주소 (${ou})`);
    // 주소만 맞고 파일이 없으면 카톡 미리보기는 그대로 빕니다
    const res = await page.request.get(og);
    assert(res.status() === 200, `og:image 가 실제로 받아짐 (${res.status()})`);
    assert((res.headers()["content-type"] || "").includes("image"), "og:image 가 이미지로 나감");
  }
  {
    // 정렬 — 드롭다운이 칩을 한 줄 더 늘리지 않고 목록 위 한 줄만 씁니다
    assert((await page.locator("#sort option").allTextContents()).join(",") === "최신순,등급순,할인율순,가격 낮은순", "정렬 항목 4개");
    const titles = () => page.locator(".deal-title").allTextContents();
    await page.selectOption("#sort", "cheap");
    assert((await titles())[0].startsWith("오리온"), "가격 낮은순 → 5,980원이 먼저");
    await page.selectOption("#sort", "rate");
    assert((await titles())[0].startsWith("한돈"), "할인율순 → 40% 가 먼저");
    await page.selectOption("#sort", "grade");
    assert((await titles())[0].startsWith("한돈"), "등급순 → 무지성급이 먼저");
    await page.selectOption("#sort", "new");
  }
  {
    // 마감 딜 — 잠깐 남지만 맨 아래로 내려가고, 공유 버튼은 달리지 않습니다
    const p2 = await open("/index.html", { deals: ENDED_FIXTURE });
    const titles = await p2.locator(".deal-title").allTextContents();
    assert(titles.length === 3, `오래전 마감한 딜은 사라짐 (남은 ${titles.length}개)`);
    assert(titles.includes("방금 마감한 딜"), "방금 마감한 딜은 잠깐 남음");
    assert(titles.includes("방금 품절된 딜"), "방금 품절된 딜도 잠깐 남음");
    assert((await p2.locator(".tag-ended").allTextContents()).sort().join("|") === "마감|품절", "마감·품절 배지 글자");
    assert(await p2.locator(".tag-soldOut").count() === 1, "품절 배지는 색이 다름");
    assert(titles[0] === "살아 있는 딜", `파는 중인 딜이 맨 위 (지금 순서: ${titles.join(" / ")})`);
    assert(!titles.slice(1).includes("살아 있는 딜"), "품절·마감은 전부 아래로");
    await p2.selectOption("#sort", "cheap");
    const cheap = await p2.locator(".deal-title").allTextContents();
    // 품절 딜이 400원으로 제일 싸지만 그래도 맨 위로 올라오면 안 됩니다
    assert(cheap[0] === "살아 있는 딜", `가격 낮은순에서도 제일 싼 품절 딜이 위로 안 올라옴 (${cheap.join(" / ")})`);
    assert(await p2.locator(".deal.is-ended .share").count() === 0, "품절·마감 딜에는 공유 버튼이 없음");
    assert(await p2.locator(".deal:not(.is-ended) .share").count() === 1, "살아 있는 딜에는 공유 버튼이 있음");
    await p2.context().close();
  }

  {
    // 공유 — 기본 공유창이 없는 브라우저에서는 문구를 복사합니다
    await page.locator(".share").first().click();
    // 공유는 비동기라(기본 공유창 → 실패하면 복사) 알림이 한 박자 뒤에 뜹니다
    await page.waitForSelector(".toast.is-on", { timeout: 4000 });
    assert(true, "공유를 누르면 알림이 뜸");
    const built = await page.evaluate(() => kakaoText(window.DEALS[0]));
    const want = [
      SHARE_INTRO,
      "",
      "✅ 한돈 냉장 삼겹살 구이용 1kg",
      " ┗ 무지성급 🔥🔥🔥🔥🔥 14,900원",
      " ┗ 평소가 24,900원 (40%↓)",
      " ┗ 이 가격이면 바로 담으세요",
      "https://toss.im/_m/a1",
      "",
      "- 가격·혜택은 게시 당시 기준이며 실시간 변경될 수 있습니다.",
      "- 안내된 가격과 다를 경우 구매를 권하지 않습니다.",
    ].join("\n");
    assert(built === want, "공유 문구가 고지 → 상품 → 안내 순서\n   나온 것:\n" + built + "\n   바란 것:\n" + want);
    assert(built.startsWith(SHARE_INTRO), "수수료 고지가 맨 앞 — 카톡이 긴 글을 접어도 먼저 보임");
  }
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
  await page.locator("#chips .chip", { hasText: "신선식품" }).click();
  assert(await page.locator(".deal").count() === 1, "another category filter → 1 card");
  await page.locator("#grade-chips .chip", { hasText: "무지성급" }).click();
  assert(await page.locator(".deal").count() === 1, "신선식품 + 무지성급 both match the same deal");
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
  {
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    assert(/^https?:\/\/.+\/assets\/og\.png$/.test(og), `about: og:image 도 채워짐 (${og})`);
  }
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
    // 등급이 가격보다 위에 오되(같은 줄이든 윗줄이든) 순서가 뒤집히지는 않아야 합니다
    assert(gb.y <= pb.y + 1, `긴 이름 카드에서도 등급이 가격 위 (등급 y=${Math.round(gb.y)}, 가격 y=${Math.round(pb.y)})`);
  }
  await noOverflow(page, "index+photos");
  await page.screenshot({ path: S + "/index-photos.png", fullPage: true });
  await page.close();

  // 4. add
  page = await open("add.html");
  assert(await page.locator("#f-grade option").count() === 4, "add: grade select options");
  await page.fill("#f-title", "테스트 상품"); await page.fill("#f-url", "https://toss.im/_m/abc"); await page.fill("#f-price", "9900");
  await page.selectOption("#f-grade", "3");
  assert((await page.locator("#out-code").textContent()).includes("grade: 3,"), "add: code has grade");
  assert((await page.locator("#out-kakao").textContent()).startsWith(SHARE_INTRO), "add: 카톡 문구는 수수료 고지로 시작");
  assert((await page.locator("#preview .grade").textContent()) === "대박🔥🔥🔥", "add: preview badge");
  assert((await page.locator("#preview .deal-link").getAttribute("href")) === "https://toss.im/_m/abc", "add: preview card links to the deal");
  assert(await page.locator("#preview .share").count() === 0, "add: 미리보기에는 동작하지 않는 공유 버튼을 안 달음");
  await noOverflow(page, "add");
  await page.close();

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
