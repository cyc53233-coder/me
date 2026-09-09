import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));   // ledger/
const INDEX = join(LEDGER, "index.html");
const ARTIFACT = join(LEDGER, "artifact.html");
const SCRATCH = mkdtempSync(join(tmpdir(), "ledger-test-"));
// 아티팩트 변형(스켈레톤·Firebase 스크립트 제거본)을 아티팩트 발행 스켈레톤으로 감싸 재현
const body = readFileSync(ARTIFACT, "utf-8");
const wrapped = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light dark}body{margin:0;font:14px system-ui;background:#faf9f5}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
writeFileSync(`${SCRATCH}/wrapped.html`, wrapped);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const fails = [];
const check = (name, cond, extra="") => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); if (!cond) fails.push(name); };

async function newPage(scheme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 940 }, colorScheme: scheme, locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR", e.message); fails.push("pageerror: " + e.message); });
  await page.goto("file://" + SCRATCH + "/wrapped.html");
  await page.waitForTimeout(600);
  return { ctx, page };
}

// ---- mobile light: full interaction flow ----
{
  const { ctx, page } = await newPage("light", 390);

  check("규칙 카드가 최상단(설정 제외)", await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".wrap > section.card")].filter(c => c.id !== "settingsPanel");
    return cards[0] && cards[0].id === "rulesCard";
  }));
  check("예시 규칙 3줄 렌더", await page.locator("#rulesList li").count() === 3);
  check("로컬 모드 표시", (await page.locator("#connText").textContent()).includes("이 기기"));

  // 입금 추가
  await page.click("#incAdder summary");
  await page.fill("#incAmt", "700000");
  check("금액 콤마 포맷", await page.inputValue("#incAmt") === "700,000");
  await page.fill("#incMemo", "9월 생활비");
  await page.click("#incSave");
  await page.waitForTimeout(200);
  check("입금 합계", (await page.locator("#incSum").textContent()).includes("700,000"));

  // 지출 추가 + 카테고리 자동 추천
  await page.click("#expAdder summary");
  await page.fill("#expAmt", "45900");
  await page.fill("#expMemo", "이마트 장보기");
  await page.dispatchEvent("#expMemo", "change");
  check("카테고리 자동 추천(이마트→마트·장보기)", await page.inputValue("#expCat") === "마트·장보기");
  await page.click("#expSave");
  await page.waitForTimeout(200);

  // 문자 붙여넣기 인식
  await page.click("#pasteBtn");
  await page.fill("#pasteText", "[Web발신]\n신한카드(1234)승인 12,300원(일시불)08/31 12:34 스타벅스코리아 누적1,234,567원");
  await page.click("#pasteParse");
  await page.waitForTimeout(200);
  check("문자 인식 → 금액 채움", await page.inputValue("#expAmt") === "12,300");
  check("문자 인식 → 가맹점 채움", (await page.inputValue("#expMemo")).includes("스타벅스"));
  check("문자 인식 → 카페 카테고리", await page.inputValue("#expCat") === "카페·간식");
  await page.click("#expSave");
  await page.waitForTimeout(200);

  // 8/31 날짜가 있는 문자 → 저장하면 그 달(8월)로 화면 이동
  check("문자 날짜의 달로 이동", (await page.locator("#monthLabel").textContent()).includes("8월"));
  check("8월 지출 1건", await page.locator("#expRows .row").count() === 1);
  await page.click("#toThis");
  await page.waitForTimeout(100);

  // 이번 달 수동 지출 1건 더
  await page.evaluate(() => { document.querySelector("#expAdder").open = true; });
  await page.fill("#expAmt", "5500");
  await page.fill("#expMemo", "메가커피");
  await page.dispatchEvent("#expMemo", "change");
  await page.click("#expSave");
  await page.waitForTimeout(200);

  check("이번 달 지출 2건 표시", await page.locator("#expRows .row").count() === 2);
  check("지출 합계 51,400", (await page.locator("#expSum").textContent()).includes("51,400"));
  const net = await page.locator("#tNet").textContent();
  check("남은 돈 648,600", net.includes("648,600"), net);
  check("통장 누적 잔액(8월 포함)", (await page.locator("#tBal").textContent()).includes("636,300"));
  check("카테고리 차트 2행", await page.locator("#catChart .crow").count() === 2);

  // 고정지출 등록 → 배너 → 채우기
  await page.click("#settingsBtn");
  await page.fill("#recDay", "25");
  await page.fill("#recAmt", "55000");
  await page.fill("#recMemo", "통신비");
  await page.selectOption("#recCat", "통신·구독");
  await page.click("#recAdd");
  await page.waitForTimeout(200);
  check("고정지출 배너 표시", await page.locator("#recBanner.show").count() === 1);
  await page.click("#recFill");
  await page.waitForTimeout(200);
  check("고정지출 채움 → 배너 사라짐", await page.locator("#recBanner.show").count() === 0);
  check("지출 3건", await page.locator("#expRows .row").count() === 3);
  check("지출 합계 106,400", (await page.locator("#expSum").textContent()).includes("106,400"));

  // 이름 변경 반영
  await page.fill("#setM0", "채영");
  await page.click("#saveSettings");
  await page.waitForTimeout(200);
  check("이름 변경 → 세그먼트 반영", (await page.locator("#expWho button").first().textContent()) === "채영");

  // 삭제 두 번 탭
  const delBtn = page.locator("#expRows .row .del").first();
  await delBtn.click();
  check("삭제 1차 탭 → 확인 상태", (await delBtn.textContent()) === "지우기");
  await delBtn.click();
  await page.waitForTimeout(200);
  check("삭제 완료 → 2건", await page.locator("#expRows .row").count() === 2);

  // ===== 달력 =====
  check("달력: 요일 머리 7칸", await page.locator("#calGrid .cal-h").count() === 7);
  const cells = await page.locator("#calGrid .cal-c:not(.pad)").count();
  check("달력: 이번 달 날짜 수", cells === new Date(2026, 9, 0).getDate() || cells >= 28, cells + "칸");
  check("달력: 지출 있는 날 표시", await page.locator("#calGrid .cal-c .cal-a").count() >= 1);
  check("달력: 입금 있는 날 점 표시", await page.locator("#calGrid .cal-in").count() >= 1);
  check("달력: 오늘 표시", await page.locator("#calGrid .cal-c.today").count() === 1);

  // 지출이 있는 날을 눌러 필터
  const dayCell = page.locator("#calGrid .cal-c:not(.pad)").filter({ has: page.locator(".cal-a") }).first();
  await dayCell.click();
  await page.waitForTimeout(250);
  check("달력: 날짜 선택 표시", await page.locator("#calGrid .cal-c.sel").count() === 1);
  check("달력: 필터 칩 노출", await page.locator("#expRows .filter-chip").count() === 1);
  check("달력: 합계 라벨이 그날로 바뀜", (await page.locator("#expSumLabel").textContent()).includes("일 지출 합계"));
  const filteredRows = await page.locator("#expRows .row").count();
  check("달력: 그날 내역만 남음", filteredRows >= 1 && filteredRows < 3, filteredRows + "건");
  check("달력: 전체 보기 버튼 노출", await page.locator("#calClear").isVisible());

  // 칩으로 해제
  await page.locator("#expRows .filter-chip").click();
  await page.waitForTimeout(250);
  check("달력: 필터 해제됨", await page.locator("#expRows .filter-chip").count() === 0);
  check("달력: 합계 라벨 원복", (await page.locator("#expSumLabel").textContent()).includes("이번 달"));

  // 달을 옮기면 필터가 따라오지 않는다
  await dayCell.click(); await page.waitForTimeout(150);
  await page.click("#prevM"); await page.waitForTimeout(200);
  check("달력: 달 이동 시 필터 해제", await page.locator("#expRows .filter-chip").count() === 0);
  await page.click("#toThis"); await page.waitForTimeout(200);

  // ===== 계산기: 금액 칸 수식 =====
  await page.evaluate(() => { document.querySelector("#expAdder").open = true; });
  await page.fill("#expAmt", "12000+3500-2000");
  await page.waitForTimeout(120);
  check("수식 미리보기 표시", (await page.locator(".amt-row:has(#expAmt) + .amt-preview").textContent()).includes("13,500"));
  await page.fill("#expMemo", "계산기 테스트");
  await page.click("#expSave");
  await page.waitForTimeout(200);
  check("수식 계산값으로 저장", (await page.locator("#expRows .row").first().textContent()).includes("13,500"));
  check("저장 후 미리보기 정리", await page.locator(".amt-row:has(#expAmt) + .amt-preview").isHidden());

  // 순수 숫자는 예전 그대로 (회귀)
  await page.fill("#expAmt", "45900");
  await page.waitForTimeout(80);
  check("순수 숫자 콤마 포맷 유지", await page.inputValue("#expAmt") === "45,900");
  check("순수 숫자엔 미리보기 없음", await page.locator(".amt-row:has(#expAmt) + .amt-preview").isHidden());

  // 잘못된 식은 저장을 막는다
  const beforeBad = await page.locator("#expRows .row").count();
  await page.fill("#expAmt", "1000+");
  await page.waitForTimeout(80);
  check("잘못된 식 미리보기 경고", (await page.locator(".amt-row:has(#expAmt) + .amt-preview").textContent()).includes("계산할 수 없"));
  await page.click("#expSave");
  await page.waitForTimeout(200);
  check("잘못된 식은 저장 안 됨", await page.locator("#expRows .row").count() === beforeBad);

  // blur 시 계산값으로 확정
  await page.fill("#expAmt", "1000*3");
  await page.locator("#expMemo").focus();
  await page.waitForTimeout(120);
  check("칸 벗어나면 계산값 확정", await page.inputValue("#expAmt") === "3,000");

  // ===== 계산기: 패드 =====
  await page.click(".amt-row:has(#expAmt) .calc-open");
  await page.waitForTimeout(150);
  check("패드 열림", await page.locator("#calcSheet.show").count() === 1);
  for (const k of ["C", "1", "2", "3", "+", "7", "="]) {
    await page.click(`#calcKeys button:text-is("${k}")`);
  }
  await page.waitForTimeout(120);
  check("패드 계산 결과 130원", (await page.locator("#calcResult").textContent()).includes("130"));
  await page.click("#calcApply");
  await page.waitForTimeout(150);
  check("패드 → 금액 칸 반영", await page.inputValue("#expAmt") === "130");
  check("넣기 후 패드 닫힘", await page.locator("#calcSheet.show").count() === 0);

  // Esc로 닫기
  await page.click(".amt-row:has(#expAmt) .calc-open");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check("Esc로 패드 닫힘", await page.locator("#calcSheet.show").count() === 0);
  await page.fill("#expAmt", "");

  // 월 이동
  await page.click("#prevM");
  check("이전 달 = 문자 등록 1건", (await page.locator("#expRows").textContent()).includes("스타벅스"));
  await page.click("#toThis");

  // 새로고침 후 localStorage 유지
  await page.reload(); await page.waitForTimeout(600);
  // 계산기 테스트가 지출 1건(13,500)을 더 저장했으므로 이번 달 3건
  const afterReload = await page.locator("#expRows .row").count();
  check("새로고침 후 데이터 유지", afterReload === 3, afterReload + "건");
  check("새로고침 후 수식 저장분 유지", (await page.locator("#expRows").textContent()).includes("13,500"));
  check("새로고침 후 이름 유지", (await page.locator("#expWho button").first().textContent()) === "채영");

  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check("가로 스크롤 없음(모바일)", !hasHScroll);

  await page.screenshot({ path: SCRATCH + "/shot-light-mobile.png", fullPage: true });
  await ctx.close();
}

// ---- desktop, dark OS setting: single white theme must hold ----
{
  const { ctx, page } = await newPage("dark", 800);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("다크 OS에서도 화이트 유지(단일 테마)", bg === "rgb(255, 255, 255)", bg);
  await page.click("#incAdder summary");
  await page.click("#expAdder summary");
  await page.screenshot({ path: SCRATCH + "/shot-desktop.png", fullPage: true });
  await ctx.close();
}

// ---- 호스팅 변형(index.html 원본, Firebase 스크립트 포함): 미설정 시 로컬 모드로 폴백 ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, colorScheme: "light", locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR(hosted)", e.message); fails.push("hosted pageerror: " + e.message); });
  await page.goto("file://" + INDEX);
  await page.waitForTimeout(800);
  check("호스팅판: 로컬 모드 폴백", (await page.locator("#connText").textContent()).includes("이 기기"));
  check("호스팅판: 초대 UI 숨김", await page.locator("#inviteRow").isHidden());
  check("호스팅판: 이사 배너 숨김", await page.locator("#migBanner.show").count() === 0);
  await page.click("#incAdder summary");
  await page.fill("#incAmt", "10000");
  await page.click("#incSave");
  await page.waitForTimeout(200);
  check("호스팅판: 입금 저장 동작", (await page.locator("#incSum").textContent()).includes("10,000"));
  await ctx.close();
}

// ---- RTDB 어댑터: 가짜 firebase.database() 스텁으로 연결까지 통과시키기 ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, colorScheme: "light", locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR(rtdb)", e.message); fails.push("rtdb pageerror: " + e.message); });

  // 페이지 스크립트보다 먼저 firebase 스텁을 심는다 (in-memory RTDB 흉내)
  await page.addInitScript(() => {
    const store = {};                       // 절대경로 -> 값
    const listeners = {};                   // 절대경로 -> [fn]
    window.__rtdb = { store, pushes: 0, removes: 0 };
    const emit = path => (listeners[path] || []).forEach(fn => fn(snapOf(path)));
    const snapOf = path => ({
      val: () => (store[path] === undefined ? null : store[path]),
      exists: () => store[path] !== undefined,
    });
    function makeRef(path){
      return {
        child: sub => makeRef(path + "/" + sub),
        on(evt, cb){ (listeners[path] = listeners[path] || []).push(cb); cb(snapOf(path)); return cb; },
        off(){},
        set(v){ store[path] = v; emit(path); return Promise.resolve(); },
        remove(){
          const parent = path.slice(0, path.lastIndexOf("/"));
          const key = path.slice(path.lastIndexOf("/") + 1);
          if (store[parent]) { delete store[parent][key]; emit(parent); }
          delete store[path]; window.__rtdb.removes++;
          return Promise.resolve();
        },
        push(v){
          window.__rtdb.pushes++;
          const key = "k" + window.__rtdb.pushes;
          store[path] = Object.assign({}, store[path], { [key]: v });
          emit(path);
          return Promise.resolve({ key });
        },
      };
    }
    window.firebase = {
      initializeApp(){},
      auth: () => ({ signInAnonymously: () => Promise.resolve({}) }),
      database: () => ({ ref: p => makeRef(p) }),
    };
  });
  // 설정 플레이스홀더를 통과시키기 위해 apiKey를 심은 사본을 사용
  const hosted = readFileSync(INDEX, "utf-8").replace(/apiKey: "[^"]*"/, 'apiKey: "test-key"');
  writeFileSync(`${SCRATCH}/hosted-stub.html`, hosted);
  await page.goto("file://" + SCRATCH + "/hosted-stub.html");
  await page.waitForTimeout(900);

  check("RTDB: 공유 연결 표시", (await page.locator("#connText").textContent()).includes("Firebase"));
  check("RTDB: 초대 UI 노출", await page.locator("#inviteRow").isVisible() || !(await page.locator("#inviteRow").getAttribute("hidden")));
  check("RTDB: 초대 링크에 코드 포함", /#l=[a-z0-9]{22}/.test(await page.inputValue("#inviteUrl")));

  await page.evaluate(() => { document.querySelector("#expAdder").open = true; });
  await page.fill("#expAmt", "8800");
  await page.fill("#expMemo", "메가커피");
  await page.click("#expSave");
  await page.waitForTimeout(300);
  check("RTDB: 지출 추가 → push 호출", (await page.evaluate(() => window.__rtdb.pushes)) === 1);
  check("RTDB: 스냅샷 반영 → 목록 1건", await page.locator("#expRows .row").count() === 1);
  check("RTDB: 합계 반영", (await page.locator("#expSum").textContent()).includes("8,800"));

  // 규칙 저장 → meta/rules 경로에 set
  await page.click("#rulesEditBtn");
  await page.fill("#rulesText", "커피는 하루 한 잔");
  await page.click("#rulesSave");
  await page.waitForTimeout(300);
  const rulesPath = await page.evaluate(() => Object.keys(window.__rtdb.store).find(k => k.endsWith("/meta/rules")));
  check("RTDB: 규칙이 meta/rules 경로에 저장", !!rulesPath, rulesPath);
  check("RTDB: 규칙 스냅샷 반영", (await page.locator("#rulesList").textContent()).includes("커피는 하루 한 잔"));

  // 삭제 → remove 호출
  const del = page.locator("#expRows .row .del").first();
  await del.click(); await del.click();
  await page.waitForTimeout(300);
  check("RTDB: 삭제 → remove 호출", (await page.evaluate(() => window.__rtdb.removes)) >= 1);
  check("RTDB: 삭제 후 목록 비었음", await page.locator("#expRows .row").count() === 0);

  await ctx.close();
}

// ---- Firebase 연결 실패 시 원인을 화면에 알려 주는지 ----
// "이 기기에만 저장 중"만 뜨면 사용자가 콘솔에서 뭘 빠뜨렸는지 알 수 없다.
for (const [label, stub, expect] of [
  ["익명 로그인 꺼짐",
   `auth: () => ({ signInAnonymously: () => Promise.reject({ code: "auth/operation-not-allowed" }) })`,
   "익명"],
  ["승인되지 않은 도메인",
   `auth: () => ({ signInAnonymously: () => Promise.reject({ code: "auth/unauthorized-domain" }) })`,
   "승인된 도메인"],
  ["규칙 미게시",
   `auth: () => ({ signInAnonymously: () => Promise.reject({ code: "PERMISSION_DENIED", message: "PERMISSION_DENIED" }) })`,
   "규칙"],
  ["알 수 없는 오류도 코드 노출",
   `auth: () => ({ signInAnonymously: () => Promise.reject({ code: "auth/weird-thing" }) })`,
   "auth/weird-thing"],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR(fb)", e.message); fails.push("fb pageerror: " + e.message); });
  await page.addInitScript(new Function(`
    window.firebase = {
      initializeApp(){},
      ${stub},
      database: () => ({ ref: () => ({ on: () => {}, off: () => {}, child(){ return this; }, set: () => Promise.resolve() }) }),
    };
  `));
  await page.goto("file://" + SCRATCH + "/hosted-stub.html");
  await page.waitForTimeout(900);
  const note = await page.locator("#footNote").textContent();
  check(`실패 안내: ${label}`, note.includes("공유가 안 켜졌어요") && note.includes(expect), note.slice(0, 70));
  check(`실패 안내: ${label} — 강조 표시`, await page.locator("#footNote.warn").count() === 1);
  check(`실패 안내: ${label} — 앱은 계속 동작`, (await page.locator("#connText").textContent()).includes("이 기기"));
  await ctx.close();
}

// 아티팩트 안(window.claude 있음)에서는 "스크립트 못 불러옴"이라고 하면 안 된다 —
// 그 스크립트는 일부러 뺀 것이라 사용자가 네트워크를 의심하게 만든다
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.claude = { use: () => Promise.resolve(null) }; });
  await page.goto("file://" + SCRATCH + "/hosted-stub.html");
  await page.waitForTimeout(900);
  const note = await page.locator("#footNote").textContent();
  check("실패 안내: 아티팩트 문맥은 네트워크를 탓하지 않음",
    note.includes("이 화면에서는") && !note.includes("네트워크"), note.slice(0, 70));
  await ctx.close();
}

// SDK 자체가 안 뜬 경우
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  await page.goto("file://" + SCRATCH + "/hosted-stub.html");   // firebase 전역 없음
  await page.waitForTimeout(900);
  const note = await page.locator("#footNote").textContent();
  check("실패 안내: SDK 로드 실패", note.includes("스크립트를 불러오지 못했어요"), note.slice(0, 70));
  await ctx.close();
}

await browser.close();
if (fails.length) { console.log("\nFAILED: " + fails.join(" | ")); process.exit(1); }
console.log("\nall page checks ok");
