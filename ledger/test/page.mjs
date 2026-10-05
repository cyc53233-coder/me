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

// 이 테스트는 "9월 20일"을 전제로 쓰였다 — 문자 날짜(08/31)가 이전 달이고, CSV 픽스처가 9월이다.
// 실제 오늘 날짜에 묶어 두면 달이 바뀌는 날 아무 코드도 안 건드렸는데 빨개진다.
// 날짜만 옮기고 시간은 **흐르게** 둔다. 얼려 버리면(setFixedTime) Date.now() 가 멈춰 모든 기록의
// createdAt 이 같아지고, "맨 위 행 = 방금 넣은 것" 이라는 목록 정렬 전제가 깨진다 — 실제 앱에선 안 생기는 상황.
const FIXED_NOW = new Date("2026-09-20T12:00:00");
const FIXED_TODAY = "2026-09-20";
const _newContext = browser.newContext.bind(browser);
browser.newContext = async (opts) => {
  const c = await _newContext(opts);
  await c.clock.install({ time: FIXED_NOW });
  return c;
};
const fails = [];
const check = (name, cond, extra="") => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); if (!cond) fails.push(name); };
let page;   // goTab 이 현재 페이지를 쓰도록
const goTab = async n => { await page.click("#tb-" + n); await page.waitForTimeout(120); };   // "ledger" | "fridge"

async function newPage(scheme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 940 }, colorScheme: scheme, locale: "ko-KR" });
  page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR", e.message); fails.push("pageerror: " + e.message); });
  await page.goto("file://" + SCRATCH + "/wrapped.html");
  await page.waitForTimeout(600);
  return { ctx, page };
}


// 자주 쓰는 동작 — 가계부 목록의 행, ＋로 시트 열기, 시트 저장
const ROWS = "#ledgerRows .row.entry";
const rowCount = () => page.locator(ROWS).count();
const openAdd = async kind => {
  await page.click("#quickAdd"); await page.waitForTimeout(120);
  if (kind) await page.click(`#entKind button[data-val="${kind}"]`);
};
const saveSheet = async () => { await page.click("#entSave"); await page.waitForTimeout(250); };
const openMenu = async sec => {
  if (!(await page.locator("#drawerWrap.open").count())) { await page.click("#settingsBtn"); await page.waitForTimeout(250); }
  if (sec) await page.evaluate(id => { document.querySelector(id).open = true; }, sec);
};

// ---- mobile light: full interaction flow ----
{
  const { ctx, page: pg } = await newPage("light", 390);
  page = pg;

  // ===== 화면 구성: 탭 두 개, 장식 없음 =====
  check("탭은 가계부·냉장고 두 개", await page.locator(".tabbar [role=tab]").count() === 2);
  check("기본 탭은 가계부", await page.evaluate(() => document.querySelector("#tb-ledger").getAttribute("aria-selected") === "true" && !document.querySelector("#tab-ledger").hidden));
  check("냉장고 탭은 숨김", await page.evaluate(() => document.querySelector("#tab-fridge").hidden));
  check("본문에 장식·푸터 없음", await page.evaluate(() => !document.querySelector(".band, footer, .subtitle")));
  check("예시 규칙 3줄 렌더", await page.locator("#rulesList li").count() === 3);
  check("로컬 모드 표시", (await page.locator("#connText").textContent()).includes("이 기기"));
  check("빈 목록 안내", (await page.locator("#ledgerRows .empty").textContent()).includes("＋"));

  // ===== ＋ → 입금 =====
  await openAdd();
  check("＋ → 기록 시트 열림", await page.locator("#entrySheet.show").count() === 1);
  check("＋ → 금액 칸에 커서", await page.evaluate(() => document.activeElement && document.activeElement.id === "entAmt"));
  check("새 기록은 지출이 기본", await page.locator('#entKind button[data-val="expense"][aria-pressed="true"]').count() === 1);
  await page.click('#entKind button[data-val="income"]');
  check("입금으로 바꾸면 카테고리 숨김", await page.locator("#entCatWrap").isHidden());
  check("입금 저장 버튼 문구", (await page.locator("#entSave").textContent()) === "입금 저장");
  await page.fill("#entAmt", "700000");
  check("금액 콤마 포맷", await page.inputValue("#entAmt") === "700,000");
  await page.fill("#entMemo", "9월 생활비");
  await saveSheet();
  check("저장하면 시트 닫힘", await page.locator("#entrySheet.show").count() === 0);
  check("요약: 입금 700,000", (await page.locator("#tIn").textContent()).includes("700,000"));
  check("목록에 입금 행(+)", (await page.locator("#ledgerRows .amt.in").first().textContent()).includes("+700,000"));

  // ===== ＋ → 지출 + 카테고리 자동 추천 =====
  await openAdd();
  check("다시 열면 지출로 돌아옴", await page.locator('#entKind button[data-val="expense"][aria-pressed="true"]').count() === 1);
  check("다시 열면 금액 칸 비어 있음", (await page.inputValue("#entAmt")) === "");
  await page.fill("#entAmt", "45900");
  await page.fill("#entMemo", "이마트 장보기");
  await page.dispatchEvent("#entMemo", "change");
  check("카테고리 자동 추천(이마트→마트·장보기)", await page.inputValue("#entCat") === "마트·장보기");
  await saveSheet();

  // ===== 문자 붙여넣기 인식 =====
  await openAdd();
  await page.click("#pasteBtn");
  await page.fill("#pasteText", "[Web발신]\n신한카드(1234)승인 12,300원(일시불)08/31 12:34 스타벅스코리아 누적1,234,567원");
  await page.click("#pasteParse");
  await page.waitForTimeout(200);
  check("문자 인식 → 금액 채움", await page.inputValue("#entAmt") === "12,300");
  check("문자 인식 → 가맹점 채움", (await page.inputValue("#entMemo")).includes("스타벅스"));
  check("문자 인식 → 카페 카테고리", await page.inputValue("#entCat") === "카페·간식");
  check("문자 인식 → 붙여넣기 칸 닫힘", await page.locator("#pasteBox.show").count() === 0);
  await saveSheet();

  // 8/31 날짜가 있는 문자 → 저장하면 그 달(8월)로 화면 이동
  check("문자 날짜의 달로 이동", (await page.locator("#monthLabel").textContent()).includes("8월"));
  check("8월 기록 1건", await rowCount() === 1);
  await page.click("#toThis");
  await page.waitForTimeout(100);

  // 입금 알림 문자는 입금으로 바뀐다
  await openAdd();
  await page.click("#pasteBtn");
  await page.fill("#pasteText", "[국민은행] 09/20 입금 50,000원 김다니");
  await page.click("#pasteParse");
  await page.waitForTimeout(200);
  check("입금 문자 → 시트가 입금으로", await page.locator('#entKind button[data-val="income"][aria-pressed="true"]').count() === 1);
  await page.click("#entryClose"); await page.waitForTimeout(150);

  // 이번 달 수동 지출 1건 더
  await openAdd();
  await page.fill("#entAmt", "5500");
  await page.fill("#entMemo", "메가커피");
  await page.dispatchEvent("#entMemo", "change");
  await saveSheet();

  check("한 목록에 입금 1 + 지출 2", await rowCount() === 3);
  check("날짜별 묶음: 오늘 머리 1개", await page.locator("#ledgerRows .dayhead").count() === 1);
  const head = await page.locator("#ledgerRows .dayhead").first().textContent();
  check("날짜 머리에 그날 입금·지출 합계", head.includes("+700,000") && head.includes("−51,400"), head);
  check("요약: 지출 51,400", (await page.locator("#tOut").textContent()).includes("51,400"));
  const net = await page.locator("#tNet").textContent();
  check("남은 돈 648,600", net.includes("648,600"), net);
  check("통장 누적 잔액(8월 포함)", (await page.locator("#tBal").textContent()).includes("636,300"));
  check("카테고리 차트 2행", await page.locator("#catChart .crow").count() === 2);

  // ===== 고정지출 (메뉴 안) =====
  await openMenu("#recSec");
  // 아직 나갈 날이 안 된 고정지출은 재촉하지 않아야 한다
  const todayD = FIXED_NOW.getDate();
  const futureDay = todayD < 28 ? String(todayD + 1) : null;
  if (futureDay) {
    await page.fill("#recDay", futureDay);
    await page.fill("#recAmt", "9000");
    await page.fill("#recMemo", "미래 고정지출");
    await page.click("#recAdd");
    await page.waitForTimeout(200);
    check("고정지출: 날짜 전이면 배너 없음", await page.locator("#recBanner.show").count() === 0);
    await page.locator("#recList .row .del").last().click();   // 정리
    await page.waitForTimeout(200);
  }

  await page.fill("#recDay", String(Math.max(1, todayD)));
  await page.fill("#recAmt", "55000");
  await page.fill("#recMemo", "통신비");
  await page.selectOption("#recCat", "통신·구독");
  await page.click("#recAdd");
  await page.waitForTimeout(200);
  check("고정지출: 날짜가 지나면 배너 표시", await page.locator("#recBanner.show").count() === 1);
  await page.keyboard.press("Escape"); await page.waitForTimeout(250);   // 서랍 뒤 배너를 누르려면 닫아야 한다
  await page.click("#recFill");
  await page.waitForTimeout(200);
  check("고정지출 채움 → 배너 사라짐", await page.locator("#recBanner.show").count() === 0);
  check("고정지출 채움 → 4행", await rowCount() === 4);
  check("요약: 지출 106,400", (await page.locator("#tOut").textContent()).includes("106,400"));

  // ===== 이름 변경 =====
  await openMenu("#settingsPanel");
  await page.fill("#setM0", "채영");
  await page.click("#saveSettings");
  await page.waitForTimeout(200);
  check("이름 변경 → 누가 버튼 반영", (await page.locator("#entWho button").first().textContent()) === "채영");

  // ===== 메뉴 서랍 =====
  check("서랍: 메뉴로 열림", await page.locator("#drawerWrap.open").count() === 1);
  check("서랍: 규칙이 서랍 안에(펼쳐짐)", await page.locator("#drawer #rulesCard[open] #rulesList li").count() === 3);
  check("서랍: 분석이 서랍 안에", await page.locator("#drawer #catChart").count() === 1);
  check("서랍: 분석 제목에 달", (await page.locator("#statsTitle").textContent()) === "9월 분석");
  check("서랍: CSV가 서랍 안에", await page.locator("#drawer #csvBtn").count() === 1);
  check("서랍: 최근 활동 로그 표시", await page.locator("#logRows .logrow").count() >= 1);
  check("서랍: 이름 설정이 서랍 안에", await page.locator("#drawer #settingsPanel").count() === 1);
  check("서랍: 연결 상태 안내가 서랍 안에", await page.locator("#drawer #footNote").count() === 1);
  check("서랍: 본문에 규칙·분석 없음", await page.locator(".wrap #rulesCard, .wrap #catChart").count() === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  check("서랍: Esc로 닫힘", await page.locator("#drawerWrap.open").count() === 0);

  // ===== 고치기 =====
  const rowsBeforeEdit = await rowCount();
  check("행에는 지우기 버튼이 없다", await page.locator(ROWS + " .del").count() === 0);
  await page.locator(ROWS).first().click();
  await page.waitForTimeout(200);
  check("고치기: 시트 제목", (await page.locator("#entryTitle").textContent()) === "기록 고치기");
  check("고치기: 폼에 값이 실림", (await page.inputValue("#entAmt")).length > 0, await page.inputValue("#entAmt"));
  check("고치기: 저장 버튼 문구 변경", (await page.locator("#entSave").textContent()).includes("고친"));
  check("고치기: 지우기 버튼 노출", await page.locator("#entDelete").isVisible());
  check("고치기: 스크린샷·문자 줄 숨김", await page.locator("#autoRow").isHidden());
  await page.fill("#entAmt", "77777");
  await saveSheet();
  check("고치기: 건수가 늘지 않음", await rowCount() === rowsBeforeEdit);
  check("고치기: 새 금액 반영", (await page.locator("#ledgerRows").textContent()).includes("77,777"));

  // 고치다가 닫으면 다음 ＋는 빈 새 기록
  await page.locator(ROWS).first().click();
  await page.waitForTimeout(150);
  await page.click("#entryClose");
  await page.waitForTimeout(150);
  await openAdd();
  check("고치기 취소: 폼 비워짐", (await page.inputValue("#entAmt")) === "");
  check("고치기 취소: 새 기록 제목·버튼", (await page.locator("#entryTitle").textContent()) === "기록 적기" && (await page.locator("#entSave").textContent()) === "지출 저장");
  check("고치기 취소: 지우기 숨김", await page.locator("#entDelete").isHidden());
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);

  // 지우기(두 번) → 되돌리기
  const beforeDel = await rowCount();
  await page.locator(ROWS).first().click();
  await page.waitForTimeout(150);
  await page.click("#entDelete");
  check("지우기 1차 → 확인 상태", (await page.locator("#entDelete").textContent()).includes("한 번 더"));
  check("지우기 1차 → 아직 안 지워짐", await rowCount() === beforeDel);
  await page.click("#entDelete");
  await page.waitForTimeout(300);
  check("지우기: 시트 닫힘", await page.locator("#entrySheet.show").count() === 0);
  check("지우기: 한 건 줄어듦", await rowCount() === beforeDel - 1);
  check("지우기: 되돌리기 버튼 제공", await page.locator("#toast .toast-act").count() === 1);
  await page.click("#toast .toast-act");
  await page.waitForTimeout(400);
  check("되돌리기: 건수 복구", await rowCount() === beforeDel);

  // ===== 달력 (가계부 탭 위) =====
  check("달력: 요일 머리 7칸", await page.locator("#calGrid .cal-h").count() === 7);
  const cells = await page.locator("#calGrid .cal-c:not(.pad)").count();
  check("달력: 9월 30칸", cells === 30, cells + "칸");
  check("달력: 지출 있는 날 표시", await page.locator("#calGrid .cal-c .cal-a").count() >= 1);
  check("달력: 입금 있는 날 점 표시", await page.locator("#calGrid .cal-in").count() >= 1);
  check("달력: 오늘 표시", await page.locator("#calGrid .cal-c.today").count() === 1);

  // 지출이 있는 날 → 그날만
  const busyDay = page.locator("#calGrid .cal-c:not(.pad)").filter({ has: page.locator(".cal-a") }).first();
  await busyDay.click();
  await page.waitForTimeout(200);
  check("달력: 날짜 선택 표시", await page.locator("#calGrid .cal-c.sel").count() === 1);
  check("달력: 필터 칩 노출", await page.locator("#ledgerRows .filter-chip").count() === 1);
  check("달력: 그날 기록이 남음", await rowCount() >= 1);
  check("달력: 탭 그대로(가계부)", await page.evaluate(() => !document.querySelector("#tab-ledger").hidden));
  check("달력: 시트는 저절로 안 열림", await page.locator("#entrySheet.show").count() === 0);
  await page.locator("#ledgerRows .filter-chip").click();
  await page.waitForTimeout(200);
  check("달력: 칩으로 해제", await page.locator("#ledgerRows .filter-chip").count() === 0);

  // 빈 날을 고르고 ＋ → 그 날짜로 적힌다
  const day5 = page.locator("#calGrid .cal-c:not(.pad)").nth(4);
  await day5.click();
  await page.waitForTimeout(200);
  check("달력: 빈 날 안내", (await page.locator("#ledgerRows .empty").textContent()).includes("이 날은"));
  await openAdd();
  check("달력: ＋는 고른 날짜로", (await page.inputValue("#entDate")) === "2026-09-05", await page.inputValue("#entDate"));
  await page.fill("#entAmt", "1500");
  await page.fill("#entMemo", "그날 추가");
  await saveSheet();
  check("달력: 그날에 저장하면 필터 유지", await page.locator("#ledgerRows .filter-chip").count() === 1);
  check("달력: 방금 저장한 것이 보임", (await page.locator("#ledgerRows").textContent()).includes("그날 추가"));
  await day5.click();     // 같은 날 다시 → 해제
  await page.waitForTimeout(200);
  check("달력: 같은 날 다시 누르면 해제", await page.locator("#ledgerRows .filter-chip").count() === 0);

  // 달을 옮기면 필터가 따라오지 않는다
  await busyDay.click(); await page.waitForTimeout(150);
  await page.click("#prevM"); await page.waitForTimeout(200);
  check("달력: 달 이동 시 필터 해제", await page.locator("#ledgerRows .filter-chip").count() === 0);
  await page.click("#toThis"); await page.waitForTimeout(200);

  // ===== CSV 가져오기 (메뉴) =====
  const fixture = join(LEDGER, "test", "fixtures", "export-sample.csv");
  const csvBefore = await rowCount();
  await openMenu("#dataSec");
  await page.locator("#csvFile").setInputFiles(fixture);
  await page.waitForTimeout(400);
  check("CSV: 미리보기 열림", await page.locator("#csvSheet.show").count() === 1);
  check("CSV: 11행", await page.locator("#csvRows .crow-csv:not(.err)").count() === 11);
  const dupBadges = await page.locator("#csvRows .cbadge").count();
  check("CSV: 파일 안 중복 1건 표시", dupBadges === 1, dupBadges + "개");
  check("CSV: 중복 행은 체크 해제", (await page.locator("#csvRows .crow-csv.dup input[type=checkbox]").isChecked()) === false);
  check("CSV: 버튼에 10건", (await page.locator("#csvGo").textContent()).includes("10건"));
  await page.click("#csvGo");
  await page.waitForTimeout(600);
  check("CSV: 시트 닫힘", await page.locator("#csvSheet.show").count() === 0);
  check("CSV: 메뉴도 닫혀 목록이 보임", await page.locator("#drawerWrap.open").count() === 0);
  check("CSV: 입금 2 + 지출 8 = 10행 증가", await rowCount() === csvBefore + 10, csvBefore + " → " + await rowCount());
  check("CSV: 다니 입금 100,000", (await page.locator("#ledgerRows").textContent()).includes("+100,000"));
  // 같은 파일 다시 → 전부 "이미 있음"
  await page.locator("#csvFile").setInputFiles(fixture);
  await page.waitForTimeout(400);
  check("CSV: 재업로드는 전부 이미 있음", await page.locator("#csvRows .cbadge").count() === 11);
  check("CSV: 재업로드 가져오기 비활성", await page.locator("#csvGo").isDisabled());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check("CSV: Esc로 닫힘", await page.locator("#csvSheet.show").count() === 0);

  // ===== 여러 품목 스크린샷/문자 =====
  const beforeMulti = await rowCount();
  await openAdd();
  await page.click("#pasteBtn");
  await page.fill("#pasteText", "주문 완료\n판매자 : 쿠팡\n오뚜기 컵누들\n6,940 원\n수량: 1개\n곰곰 김치\n5,990 원\n국내산 양배추\n3,090 원\n총 결제금액 16,020원");
  await page.click("#pasteParse");
  await page.waitForTimeout(300);
  check("여러 품목: 확인 시트 열림", await page.locator("#multiSheet.show").count() === 1);
  check("여러 품목: 3행", await page.locator("#multiRows .mrow").count() === 3);
  check("여러 품목: 가게 추정 쿠팡", (await page.inputValue("#multiStore")) === "쿠팡");
  await page.click("#multiEach");
  await page.waitForTimeout(400);
  check("여러 품목: 각각 등록 → 3건 증가", await rowCount() === beforeMulti + 3);
  check("여러 품목: 시트 둘 다 닫힘", await page.locator(".sheet.show").count() === 0);
  check("여러 품목: 가게명 붙음", (await page.locator("#ledgerRows").textContent()).includes("쿠팡 · "));

  await openAdd();
  await page.click("#pasteBtn");
  await page.fill("#pasteText", "쿠팡\n사과\n4,000 원\n배\n6,000 원");
  await page.click("#pasteParse");
  await page.waitForTimeout(300);
  await page.locator("#multiRows .mpick").nth(1).uncheck();
  await page.click("#multiMerge");
  await page.waitForTimeout(400);
  check("여러 품목: 체크 해제 반영 + 합쳐서 1건", await rowCount() === beforeMulti + 4);
  check("여러 품목: 합친 금액 4,000", (await page.locator(ROWS).first().textContent()).includes("4,000"));

  // ===== 냉장고 =====
  await goTab("fridge");
  check("냉장고: 월 이동·요약 숨김", await page.locator("#ledgerBar").isHidden());
  check("냉장고: ＋ 이름이 바뀜", (await page.locator("#quickAdd").getAttribute("aria-label")) === "냉장고에 담기");
  const pBefore = await page.locator("#pantryRows .row").count();
  await goTab("ledger");
  check("가계부로 오면 월 이동 다시 보임", await page.locator("#ledgerBar").isVisible());
  await openAdd();
  await page.click("#pasteBtn");
  await page.fill("#pasteText", "쿠팡\n서울우유 900ml\n3,200 원\n신라면 5개입\n4,500 원\n고양이 터널\n7,150 원");
  await page.click("#pasteParse");
  await page.waitForTimeout(350);
  check("냉장고: 시트에 냉장고 칸", await page.locator("#multiRows .mpk").count() === 3);
  // 식품만 기본 체크 — 고양이 터널은 꺼져 있어야
  check("냉장고: 우유 기본 체크", await page.locator("#multiRows .mrow").nth(0).locator(".mpk").isChecked());
  check("냉장고: 라면 기본 체크", await page.locator("#multiRows .mrow").nth(1).locator(".mpk").isChecked());
  check("냉장고: 비식품은 체크 해제", (await page.locator("#multiRows .mrow").nth(2).locator(".mpk").isChecked()) === false);
  check("냉장고: 추정 표시", await page.locator("#multiRows .mguess").count() === 2);
  const uyuExpire = await page.locator("#multiRows .mrow").nth(0).locator(".mexp").inputValue();
  check("냉장고: 우유 기한 추정됨", /^\d{4}-\d{2}-\d{2}$/.test(uyuExpire), uyuExpire);
  const expBeforePantry = await rowCount();
  await page.click("#multiEach");
  await page.waitForTimeout(600);
  check("냉장고: 지출도 3건 증가", await rowCount() === expBeforePantry + 3);

  await goTab("fridge");
  const pAfterReceipt = await page.locator("#pantryRows .row").count();
  check("냉장고: 영수증에서 2개만 담김 (비식품 제외)", pAfterReceipt === pBefore + 2, pBefore + " → " + pAfterReceipt);
  check("냉장고: 임박한 순 정렬(우유 먼저)", (await page.locator("#pantryRows .row").first().textContent()).includes("우유"));
  check("냉장고: D-day 표시", await page.locator("#pantryRows .pchip").count() === pAfterReceipt);
  check("냉장고: 추정 표시 있음", await page.locator("#pantryRows .pguess").count() >= 2);

  // ＋ → 직접 담기 — 오늘 기한이면 탭 안 알림·배지가 떠야
  await page.click("#quickAdd"); await page.waitForTimeout(150);
  check("냉장고: ＋ → 담기 시트", await page.locator("#pantrySheet.show").count() === 1);
  check("냉장고: 새로 담을 땐 지우기 없음", await page.locator("#pDelete").isHidden());
  await page.fill("#pName", "임박 두부");
  const todayIso = FIXED_TODAY;
  await page.fill("#pExpire", todayIso);
  await page.click("#pSave");
  await page.waitForTimeout(400);
  check("냉장고: 시트 닫힘", await page.locator("#pantrySheet.show").count() === 0);
  check("냉장고: 직접 담기 반영", await page.locator("#pantryRows .row").count() === pAfterReceipt + 1);
  check("냉장고: 임박 항목이 맨 위", (await page.locator("#pantryRows .row").first().textContent()).includes("임박 두부"));
  check("냉장고: 오늘까지 라벨", (await page.locator("#pantryRows .pchip").first().textContent()) === "오늘까지");
  check("냉장고: 탭 배지 노출", await page.locator("#pantryBadge").isVisible());
  check("냉장고: 탭 안 알림 노출", await page.locator("#tab-fridge #pantryBanner.show").count() === 1);
  check("냉장고: 알림에 개수", (await page.locator("#pantryBannerText").textContent()).includes("1개"));
  await goTab("ledger");
  check("가계부 화면엔 유통기한 알림 없음", await page.locator("#pantryBanner").isHidden());
  check("가계부 화면에서도 배지는 보임", await page.locator("#pantryBadge").isVisible());
  await goTab("fridge");

  // 다 먹었어요 → 치운 목록으로, 되돌리기
  await page.locator("#pantryRows .row").first().locator(".peat").click();
  await page.waitForTimeout(400);
  check("냉장고: 치우면 목록에서 빠짐", await page.locator("#pantryRows .row").count() === pAfterReceipt);
  check("냉장고: 치우면 배지 사라짐", await page.locator("#pantryBadge").isHidden());
  check("냉장고: 다 먹었어요는 시트를 안 엶", await page.locator("#pantrySheet.show").count() === 0);
  check("냉장고: 되돌리기 제공", await page.locator("#toast .toast-act").count() === 1);
  await page.click("#toast .toast-act");
  await page.waitForTimeout(400);
  check("냉장고: 되돌리면 복구", await page.locator("#pantryRows .row").count() === pAfterReceipt + 1);

  // 행을 눌러 고치기
  await page.locator("#pantryRows .row").first().click();
  await page.waitForTimeout(200);
  check("냉장고: 고치기 시트에 이름 실림", (await page.inputValue("#pName")) === "임박 두부");
  check("냉장고: 고칠 땐 지우기 보임", await page.locator("#pDelete").isVisible());
  await page.fill("#pName", "두부 반모");
  await page.click("#pSave");
  await page.waitForTimeout(400);
  check("냉장고: 고쳐도 개수 그대로", await page.locator("#pantryRows .row").count() === pAfterReceipt + 1);
  check("냉장고: 고친 이름 반영", (await page.locator("#pantryRows").textContent()).includes("두부 반모"));

  // 추정 기한 품목은 이름만 고쳐도 "추정" 표시가 남는다 — 날짜는 여전히 짐작한 값
  const guessedRow = page.locator("#pantryRows .row").filter({ has: page.locator(".pguess") }).first();
  const guessedName = (await guessedRow.locator(".memo").textContent()).trim();
  await guessedRow.click(); await page.waitForTimeout(150);
  await page.fill("#pName", guessedName + " (큰 것)");
  await page.click("#pSave"); await page.waitForTimeout(400);
  check("냉장고: 이름만 고치면 추정 표시 유지",
    await page.locator("#pantryRows .row").filter({ hasText: guessedName + " (큰 것)" }).locator(".pguess").count() === 1);

  // 시트에서 지우기(두 번) → 되돌리기
  await page.locator("#pantryRows .row").first().click();
  await page.waitForTimeout(150);
  await page.click("#pDelete");
  check("냉장고: 지우기 1차 → 확인 상태", (await page.locator("#pDelete").textContent()).includes("한 번 더"));
  await page.click("#pDelete");
  await page.waitForTimeout(300);
  check("냉장고: 지우면 한 개 줄어듦", await page.locator("#pantryRows .row").count() === pAfterReceipt);
  await page.click("#toast .toast-act");
  await page.waitForTimeout(400);
  check("냉장고: 지운 것 되돌리기", await page.locator("#pantryRows .row").count() === pAfterReceipt + 1);
  await goTab("ledger");

  // ===== 계산기: 금액 칸 수식 =====
  await openAdd();
  await page.fill("#entAmt", "12000+3500-2000");
  await page.waitForTimeout(120);
  check("수식 미리보기 표시", (await page.locator(".amt-row:has(#entAmt) + .amt-preview").textContent()).includes("13,500"));
  await page.fill("#entMemo", "계산기 테스트");
  await saveSheet();
  check("수식 계산값으로 저장", (await page.locator(ROWS).first().textContent()).includes("13,500"));
  await openAdd();
  check("다시 열면 미리보기 정리", await page.locator(".amt-row:has(#entAmt) + .amt-preview").isHidden());

  // 순수 숫자는 예전 그대로 (회귀)
  await page.fill("#entAmt", "45900");
  await page.waitForTimeout(80);
  check("순수 숫자 콤마 포맷 유지", await page.inputValue("#entAmt") === "45,900");
  check("순수 숫자엔 미리보기 없음", await page.locator(".amt-row:has(#entAmt) + .amt-preview").isHidden());

  // 잘못된 식은 저장을 막는다
  const beforeBad = await rowCount();
  await page.fill("#entAmt", "1000+");
  await page.waitForTimeout(80);
  check("잘못된 식 미리보기 경고", (await page.locator(".amt-row:has(#entAmt) + .amt-preview").textContent()).includes("계산할 수 없"));
  await page.click("#entSave");
  await page.waitForTimeout(200);
  check("잘못된 식은 저장 안 됨", await rowCount() === beforeBad);
  check("잘못된 식이면 시트 유지", await page.locator("#entrySheet.show").count() === 1);

  // blur 시 계산값으로 확정
  await page.fill("#entAmt", "1000*3");
  await page.locator("#entMemo").focus();
  await page.waitForTimeout(120);
  check("칸 벗어나면 계산값 확정", await page.inputValue("#entAmt") === "3,000");

  // ===== 계산기: 패드 (시트 위에 뜬다) =====
  check("금액 라벨을 눌러도 계산기는 안 열림", await (async () => {
    await page.locator("label[for=entAmt]").click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);
    return (await page.locator("#calcSheet.show").count()) === 0;
  })());
  await page.click(".amt-row:has(#entAmt) .calc-open");
  await page.waitForTimeout(150);
  check("패드 열림", await page.locator("#calcSheet.show").count() === 1);
  for (const k of ["C", "1", "2", "3", "+", "7", "="]) {
    await page.click(`#calcKeys button:text-is("${k}")`);
  }
  await page.waitForTimeout(120);
  check("패드 계산 결과 130원", (await page.locator("#calcResult").textContent()).includes("130"));
  await page.click("#calcApply");
  await page.waitForTimeout(150);
  check("패드 → 금액 칸 반영", await page.inputValue("#entAmt") === "130");
  check("넣기 후 패드 닫힘", await page.locator("#calcSheet.show").count() === 0);
  check("넣기 후 기록 시트는 그대로", await page.locator("#entrySheet.show").count() === 1);

  // Esc는 맨 위 하나만 닫는다
  await page.click(".amt-row:has(#entAmt) .calc-open");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check("Esc 1번: 패드만 닫힘", await page.locator("#calcSheet.show").count() === 0 && await page.locator("#entrySheet.show").count() === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check("Esc 2번: 기록 시트도 닫힘", await page.locator("#entrySheet.show").count() === 0);

  // 월 이동
  await page.click("#prevM");
  check("이전 달 = 문자 등록 1건", (await page.locator("#ledgerRows").textContent()).includes("스타벅스"));
  await page.click("#toThis");

  // 새로고침 후 localStorage 유지 + 마지막 탭·누가 기억
  const beforeReload = await rowCount();
  await goTab("fridge");
  await page.reload(); await page.waitForTimeout(600);
  check("새로고침 후 마지막 탭(냉장고) 기억", await page.evaluate(() => !document.querySelector("#tab-fridge").hidden));
  await goTab("ledger");
  const afterReload = await rowCount();
  check("새로고침 후 데이터 유지", afterReload === beforeReload && afterReload > 20, beforeReload + " → " + afterReload);
  check("새로고침 후 수식 저장분 유지", (await page.locator("#ledgerRows").textContent()).includes("13,500"));
  check("새로고침 후 이름 유지", (await page.locator("#entWho button").first().textContent()) === "채영");

  await openAdd();
  await page.click('#entWho button[data-val="m1"]');
  await page.fill("#entAmt", "1000"); await page.fill("#entMemo", "누가 기억");
  await saveSheet();
  await openAdd();
  check("마지막에 고른 '누가'를 기억", (await page.locator('#entWho button[aria-pressed="true"]').getAttribute("data-val")) === "m1");
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);

  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check("가로 스크롤 없음(모바일)", !hasHScroll);

  await page.screenshot({ path: SCRATCH + "/shot-light-mobile.png", fullPage: true });
  await ctx.close();
}

// ---- desktop, dark OS setting: single white theme must hold ----
{
  const { ctx, page: pg } = await newPage("dark", 800);
  page = pg;
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("다크 OS에서도 화이트 유지(단일 테마)", bg === "rgb(255, 255, 255)", bg);
  await openAdd();
  await page.screenshot({ path: SCRATCH + "/shot-desktop.png", fullPage: true });
  await ctx.close();
}

// ---- 호스팅 변형(index.html 원본, Firebase 스크립트 포함): 미설정 시 로컬 모드로 폴백 ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, colorScheme: "light", locale: "ko-KR" });
  page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR(hosted)", e.message); fails.push("hosted pageerror: " + e.message); });
  await page.goto("file://" + INDEX);
  await page.waitForTimeout(800);
  check("호스팅판: 로컬 모드 폴백", (await page.locator("#connText").textContent()).includes("이 기기"));
  check("호스팅판: 초대 UI 숨김", await page.locator("#inviteRow").isHidden());
  check("호스팅판: 이사 배너 숨김", await page.locator("#migBanner.show").count() === 0);
  await openAdd("income");
  await page.fill("#entAmt", "10000");
  await saveSheet();
  check("호스팅판: 입금 저장 동작", (await page.locator("#tIn").textContent()).includes("10,000"));
  await ctx.close();
}

// ---- RTDB 어댑터: 가짜 firebase.database() 스텁으로 연결까지 통과시키기 ----
// 스텁은 진짜 RTDB처럼 트리 하나를 들고, 쓰기는 화면(리스너)에 먼저 반영한 뒤 응답한다.
// hang/reject 에 경로 조각을 넣으면 그 쓰기는 응답이 없거나(오프라인) 거절된다(규칙).
const LID = "abcdefgh12345678abcdef";
const RTDB_STUB = (lid) => {
  const tree = {};
  const listeners = [];
  const R = window.__rtdb = { tree, onCalls: [], writes: [], hang: "", reject: "" };
  const parts = p => p.split("/").filter(Boolean);
  const getAt = p => { let n = tree; for (const k of parts(p)) { if (n == null || typeof n !== "object") return null; n = n[k]; } return n === undefined ? null : n; };
  const setAt = (p, v) => {
    const ks = parts(p), last = ks.pop();
    let n = tree; const trail = [];
    for (const k of ks) { if (n[k] == null || typeof n[k] !== "object") n[k] = {}; trail.push([n, k]); n = n[k]; }
    if (v === null || v === undefined) delete n[last]; else n[last] = JSON.parse(JSON.stringify(v));
    for (let i = trail.length - 1; i >= 0; i--) { const [o, k] = trail[i]; if (o[k] && !Object.keys(o[k]).length) delete o[k]; }
  };
  const clone = v => v === null ? null : JSON.parse(JSON.stringify(v));
  const emit = () => listeners.forEach(({ p, cb }) => cb({ val: () => clone(getAt(p)), exists: () => getAt(p) !== null }));
  R.get = p => clone(getAt(p));
  R.write = (p, v) => { setAt(p, v); emit(); };            // 다른 기기가 쓴 것처럼
  function write(p, v){
    R.writes.push(p);
    const before = clone(getAt(p));
    setAt(p, v); emit();                                     // 화면엔 먼저 반영 (RTDB의 로컬 반영)
    if (R.hang && p.includes(R.hang)) return new Promise(() => {});
    if (R.reject && p.includes(R.reject)) {
      setAt(p, before); emit();                              // 거절되면 RTDB가 스스로 되돌린다
      return Promise.reject(Object.assign(new Error("PERMISSION_DENIED: Permission denied"), { code: "PERMISSION_DENIED" }));
    }
    return Promise.resolve();
  }
  function makeRef(p){
    return {
      child: sub => makeRef(p + "/" + sub),
      on(evt, cb){ R.onCalls.push(p); listeners.push({ p, cb }); cb({ val: () => clone(getAt(p)), exists: () => getAt(p) !== null }); return cb; },
      off(){},
      set: v => write(p, v),
      remove: () => write(p, null),
    };
  }
  // 예전 판이 남긴 고정지출 배열 — 첫 로드 때 항목별로 옮겨져야 한다
  setAt("ledgers/" + lid + "/meta/recurring", { items: [{ id: "r1", day: 25, amount: 500000, memo: "월세", category: "주거·공과금", who: "both" }], updatedAt: 1 });
  window.firebase = {
    initializeApp(){},
    auth: () => ({ signInAnonymously: () => Promise.resolve({}) }),
    database: () => ({ ref: p => makeRef(p) }),
  };
};
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, colorScheme: "light", locale: "ko-KR" });
  page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR(rtdb)", e.message); fails.push("rtdb pageerror: " + e.message); });
  await page.addInitScript(RTDB_STUB, LID);
  // 설정 플레이스홀더를 통과시키기 위해 apiKey를 심은 사본을 사용
  const hosted = readFileSync(INDEX, "utf-8").replace(/apiKey: "[^"]*"/, 'apiKey: "test-key"');
  writeFileSync(`${SCRATCH}/hosted-stub.html`, hosted);
  await page.goto("file://" + SCRATCH + "/hosted-stub.html#l=" + LID);
  await page.waitForTimeout(900);
  const base = "ledgers/" + LID;
  const get = p => page.evaluate(p => window.__rtdb.get(p), base + "/" + p);
  const writesSince = async n => (await page.evaluate(() => window.__rtdb.writes)).slice(n);
  const writeCount = () => page.evaluate(() => window.__rtdb.writes.length);

  check("RTDB: 공유 연결 표시", (await page.locator("#connText").textContent()).includes("공유 중"));
  check("RTDB: 자세한 상태는 메뉴에", (await page.locator("#footNote").textContent()).includes("초대 링크"));
  check("RTDB: 초대 UI 노출", !(await page.evaluate(() => document.querySelector("#inviteRow").hidden)));
  check("RTDB: 초대 링크에 코드 포함", (await page.inputValue("#inviteUrl")).endsWith("#l=" + LID));
  const onCalls = await page.evaluate(() => window.__rtdb.onCalls);
  check("RTDB: 실시간 구독은 하나 — 가계부 루트에만", onCalls.length === 1 && onCalls[0] === base, JSON.stringify(onCalls));

  // 예전 고정지출 배열 → 항목별 문서로 이사
  check("RTDB: 예전 고정지출이 recurring/<id>로 옮겨짐", (await get("recurring/r1"))?.memo === "월세");
  check("RTDB: 예전 배열은 비워짐", !((await get("meta/recurring"))?.items || []).length);
  check("RTDB: 옮긴 고정지출이 메뉴에 보임", (await page.locator("#recList").textContent()).includes("월세"));

  // 지출 추가 — 항목 하나만 쓴다
  let n0 = await writeCount();
  await openAdd();
  await page.fill("#entAmt", "8800");
  await page.fill("#entMemo", "메가커피");
  await saveSheet();
  const addWrites = await writesSince(n0);
  check("RTDB: 지출 추가 → entries/<id> 한 곳만 씀", addWrites.length === 1 && /\/entries\/[a-z0-9]+$/.test(addWrites[0]), JSON.stringify(addWrites));
  check("RTDB: 스냅샷 반영 → 목록 1건", await rowCount() === 1);
  check("RTDB: 요약 반영", (await page.locator("#tOut").textContent()).includes("8,800"));
  check("RTDB: 저장됨 표시", (await page.locator("#saveState").textContent()) === "저장됨");
  check("RTDB: 구독은 여전히 하나", (await page.evaluate(() => window.__rtdb.onCalls.length)) === 1);

  // 고정지출 동시 추가 — 다른 기기가 방금 넣은 것을 지우지 않는다
  await page.evaluate(b => window.__rtdb.write(b + "/recurring/rOther", { day: 5, amount: 30000, memo: "다니가 넣은 구독", category: "통신·구독", who: "m1" }), base);
  await openMenu("#recSec");
  n0 = await writeCount();
  await page.fill("#recDay", "10");
  await page.fill("#recAmt", "55000");
  await page.fill("#recMemo", "통신비");
  await page.click("#recAdd");
  await page.waitForTimeout(300);
  const recWrites = await writesSince(n0);
  check("RTDB: 고정지출 추가 → 그 항목 하나만 씀", recWrites.length === 1 && /\/recurring\/[a-z0-9]+$/.test(recWrites[0]), JSON.stringify(recWrites));
  const recs = Object.values((await get("recurring")) || {}).map(r => r.memo).sort();
  check("RTDB: 동시에 넣은 고정지출이 모두 남음", JSON.stringify(recs) === JSON.stringify(["다니가 넣은 구독", "월세", "통신비"]), JSON.stringify(recs));

  // 규칙 저장 → meta/rules
  await page.click("#rulesEditBtn");
  await page.fill("#rulesText", "커피는 하루 한 잔");
  await page.click("#rulesSave");
  await page.waitForTimeout(300);
  check("RTDB: 규칙이 meta/rules 경로에 저장", (await get("meta/rules"))?.text === "커피는 하루 한 잔");
  check("RTDB: 규칙 스냅샷 반영", (await page.locator("#rulesList").textContent()).includes("커피는 하루 한 잔"));

  // 규칙 동시 수정 — 고치는 사이 상대가 먼저 저장했으면 덮어쓰지 않는다
  await page.click("#rulesEditBtn");
  await page.fill("#rulesText", "내가 고친 규칙");
  await page.evaluate(b => window.__rtdb.write(b + "/meta/rules", { text: "다니가 고친 규칙", updatedAt: Date.now() + 1000 }), base);
  await page.click("#rulesSave");
  await page.waitForTimeout(300);
  check("RTDB: 규칙 충돌 → 덮어쓰지 않음", (await get("meta/rules"))?.text === "다니가 고친 규칙");
  check("RTDB: 규칙 충돌 → 알림", (await page.locator("#toast").textContent()).includes("다른 기기에서 규칙이 바뀌었어요"));
  check("RTDB: 규칙 충돌 → 최신 규칙이 보이고 내 글은 남음",
    (await page.locator("#rulesList").isVisible()) && (await page.locator("#rulesList").textContent()).includes("다니가 고친 규칙") && (await page.inputValue("#rulesText")) === "내가 고친 규칙");
  await page.click("#rulesSave");
  await page.waitForTimeout(300);
  check("RTDB: 확인 후 다시 저장하면 반영", (await get("meta/rules"))?.text === "내가 고친 규칙");

  // 이름 동시 수정
  await page.evaluate(() => { document.querySelector("#settingsPanel").open = true; });
  await page.fill("#setM0", "용철");
  await page.evaluate(b => window.__rtdb.write(b + "/meta/settings", { members: ["철수", "다니"], updatedAt: Date.now() + 2000 }), base);
  await page.click("#saveSettings");
  await page.waitForTimeout(300);
  check("RTDB: 이름 충돌 → 덮어쓰지 않음", JSON.stringify((await get("meta/settings"))?.members) === JSON.stringify(["철수", "다니"]));
  check("RTDB: 이름 충돌 → 최신 이름으로 칸 갱신", (await page.inputValue("#setM0")) === "철수");
  await page.fill("#setM0", "용철");
  await page.click("#saveSettings");
  await page.waitForTimeout(300);
  check("RTDB: 이름 다시 저장하면 반영", (await get("meta/settings"))?.members?.[0] === "용철");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);

  // 저장 응답이 없으면(오프라인) 10초 뒤 실패로 보고 되돌린다 — 다시 눌러도 한 건만
  await page.evaluate(() => { window.__rtdb.hang = "/entries/"; });
  await openAdd();
  await page.fill("#entAmt", "4500");
  await page.fill("#entMemo", "응답 없는 저장");
  await page.click("#entSave");
  await page.waitForTimeout(150);
  check("RTDB 타임아웃: 기다리는 동안 저장 중 표시", (await page.locator("#saveState").textContent()) === "저장 중…" && (await page.locator("#entSave").textContent()) === "저장 중…");
  await page.clock.fastForward(10500);
  await page.waitForTimeout(200);
  check("RTDB 타임아웃: 화면에서 되돌림", !(await page.locator("#ledgerRows").textContent()).includes("응답 없는 저장"));
  check("RTDB 타임아웃: 저장 실패 표시", (await page.locator("#saveState").textContent()) === "저장 실패");
  check("RTDB 타임아웃: 이유 안내", (await page.locator("#toast").textContent()).includes("되돌렸어요"));
  check("RTDB 타임아웃: 시트와 입력값은 그대로", await page.locator("#entrySheet.show").count() === 1 && (await page.inputValue("#entMemo")) === "응답 없는 저장");
  await page.evaluate(() => { window.__rtdb.hang = ""; });
  await saveSheet();
  const memos = Object.values((await get("entries")) || {}).map(e => e.memo);
  check("RTDB 타임아웃: 다시 누르면 한 건만 들어감", memos.filter(m => m === "응답 없는 저장").length === 1, JSON.stringify(memos));
  check("RTDB 타임아웃: 다시 저장하면 저장됨", (await page.locator("#saveState").textContent()) === "저장됨");

  // 규칙이 거절하면 화면이 되돌아가고 이유를 알린다
  await page.evaluate(() => { window.__rtdb.reject = "/pantry/"; });
  await goTab("fridge");
  await page.click("#quickAdd"); await page.waitForTimeout(120);
  await page.fill("#pName", "거절될 우유");
  await page.click("#pSave"); await page.waitForTimeout(300);
  check("RTDB 거절: 목록에 남지 않음", await page.locator("#pantryRows .row").count() === 0);
  check("RTDB 거절: 권한 안내", (await page.locator("#toast").textContent()).includes("권한"));
  check("RTDB 거절: 시트는 열린 채로", await page.locator("#pantrySheet.show").count() === 1);
  await page.evaluate(() => { window.__rtdb.reject = ""; });
  await page.click("#pSave"); await page.waitForTimeout(300);
  check("RTDB: 냉장고는 pantry 경로에 저장", Object.keys((await get("pantry")) || {}).length === 1);
  check("RTDB: 냉장고 스냅샷 반영", await page.locator("#pantryRows .row").count() === 1);
  await goTab("ledger");

  // 지우기 → 그 항목만 삭제
  const before = await rowCount();
  n0 = await writeCount();
  await page.locator(ROWS).first().click();
  await page.waitForTimeout(150);
  await page.click("#entDelete"); await page.click("#entDelete");
  await page.waitForTimeout(300);
  const delWrites = await writesSince(n0);
  check("RTDB: 지우기 → 그 항목 하나만", delWrites.length === 1 && /\/entries\/[a-z0-9]+$/.test(delWrites[0]), JSON.stringify(delWrites));
  check("RTDB: 지운 뒤 한 줄 줄어듦", await rowCount() === before - 1);

  await ctx.close();
}

// ---- 아티팩트 내장 db: 컬렉션별 구독을 한 트리로 모아도 똑같이 동작하는지 ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, locale: "ko-KR" });
  page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGEERROR(artdb)", e.message); fails.push("artdb pageerror: " + e.message); });
  await page.addInitScript(() => {
    const cols = {}, docs = {}, subs = [];
    const fire = () => subs.forEach(f => f());
    const colSnap = name => ({ docs: Object.entries(cols[name] || {}).map(([id, v]) => ({ id, exists: true, data: () => v })) });
    const docSnap = path => ({ exists: path in docs, data: () => docs[path] });
    const db = {
      collection: name => ({
        onSnapshot(cb){ const f = () => cb(colSnap(name)); subs.push(f); f(); },
        doc: id => ({
          set: async v => { (cols[name] = cols[name] || {})[id] = v; fire(); },
          delete: async () => { if (cols[name]) delete cols[name][id]; fire(); },
        }),
      }),
      doc: path => ({
        onSnapshot(cb){ const f = () => cb(docSnap(path)); subs.push(f); f(); },
        set: async v => { docs[path] = v; fire(); },
        delete: async () => { delete docs[path]; fire(); },
      }),
    };
    window.__art = { cols, docs };
    window.claude = { use: name => Promise.resolve(name === "db" ? db : null) };
  });
  await page.goto("file://" + SCRATCH + "/wrapped.html");
  await page.waitForTimeout(700);
  check("아티팩트 db: 공유 연결 표시", (await page.locator("#connText").textContent()).includes("공유 중"));
  await openAdd();
  await page.fill("#entAmt", "3300"); await page.fill("#entMemo", "아티팩트 커피");
  await saveSheet();
  check("아티팩트 db: 지출이 entries 컬렉션에", Object.values(await page.evaluate(() => window.__art.cols.entries || {})).some(e => e.memo === "아티팩트 커피"));
  check("아티팩트 db: 목록 반영", (await page.locator("#ledgerRows").textContent()).includes("아티팩트 커피"));
  await openMenu("#recSec");
  await page.fill("#recDay", "3"); await page.fill("#recAmt", "1000"); await page.fill("#recMemo", "구독");
  await page.click("#recAdd"); await page.waitForTimeout(200);
  check("아티팩트 db: 고정지출이 recurring 컬렉션에", Object.keys(await page.evaluate(() => window.__art.cols.recurring || {})).length === 1);
  check("아티팩트 db: 고정지출 목록 반영", (await page.locator("#recList").textContent()).includes("구독"));
  await page.click("#rulesEditBtn"); await page.fill("#rulesText", "아티팩트 규칙"); await page.click("#rulesSave");
  await page.waitForTimeout(200);
  check("아티팩트 db: 규칙 저장·반영", (await page.evaluate(() => window.__art.docs["meta/rules"]?.text)) === "아티팩트 규칙" && (await page.locator("#rulesList").textContent()).includes("아티팩트 규칙"));
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
  page = await ctx.newPage();
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
  page = await ctx.newPage();
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
  page = await ctx.newPage();
  await page.goto("file://" + SCRATCH + "/hosted-stub.html");   // firebase 전역 없음
  await page.waitForTimeout(900);
  const note = await page.locator("#footNote").textContent();
  check("실패 안내: SDK 로드 실패", note.includes("스크립트를 불러오지 못했어요"), note.slice(0, 70));
  await ctx.close();
}

await browser.close();
if (fails.length) { console.log("\nFAILED: " + fails.join(" | ")); process.exit(1); }
console.log("\nall page checks ok");
