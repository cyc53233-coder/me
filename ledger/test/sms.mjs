import { readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));   // ledger/
const INDEX = join(LEDGER, "index.html");
const ARTIFACT = join(LEDGER, "artifact.html");


const html = readFileSync(INDEX, "utf-8");
const m = html.match(/\/\*SMS_PARSE_START\*\/([\s\S]*?)\/\*SMS_PARSE_END\*\//);
if (!m) { console.error("parse function not found"); process.exit(1); }
const pad2 = n => String(n).padStart(2, "0");
const { parseSms, parseItems } = new Function("pad2", m[1] + "; return { parseSms, parseItems };")(pad2);

const cases = [
  {
    name: "신한카드 승인 문자",
    text: "[Web발신]\n신한카드(1234)승인 홍*동 12,300원(일시불)08/31 12:34 스타벅스코리아 누적1,234,567원",
    expect: { amount: 12300, merchantIncludes: "스타벅스" },
  },
  {
    name: "KB국민 승인 문자",
    text: "[Web발신]\nKB국민카드 3456 승인\n33,000원 일시불\n08/30 19:22\n배달의민족",
    expect: { amount: 33000, merchantIncludes: "배달" },
  },
  {
    name: "카카오페이",
    text: "[카카오페이] 결제 완료\n5,500원 | GS25 서울점\n08/29 08:11",
    expect: { amount: 5500 },
  },
  {
    name: "금액만 있는 짧은 메모",
    text: "이마트 45,900원",
    expect: { amount: 45900, merchantIncludes: "" },
  },
  {
    name: "결제 정보 없음",
    text: "안녕하세요 내일 회의 있습니다",
    expect: { amount: 0 },
  },
];

let fail = 0;
for (const c of cases) {
  const r = parseSms(c.text);
  const okAmt = r.amount === c.expect.amount;
  const okMerch = c.expect.merchantIncludes === undefined || r.merchant.includes(c.expect.merchantIncludes);
  const ok = okAmt && okMerch;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL"), c.name, "->", JSON.stringify(r));
}
// 입금/지출 구분
const kinds = [
  ["[Web발신]\n신한카드(1234)승인 12,300원(일시불)08/31 12:34 스타벅스", "expense"],
  ["[Web발신]\n농협 입금 500,000원\n09/01 09:00 홍길동", "income"],
  ["[Web발신]\n카카오뱅크 이체 300,000원 09/02 다니", "income"],
  ["[Web발신]\n국민 출금 20,000원 09/02 ATM", "expense"],
  ["[Web발신]\n토스 급여 입금 2,500,000원 09/25", "income"],
];
for (const [text, want] of kinds) {
  const got = parseSms(text).kind;
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL"), "구분:", text.split("\n").pop().slice(0, 22), "->", got);
}

// 여러 품목 (쿠팡 주문 완료 화면을 OCR한 것과 비슷한 텍스트)
const coupang = `주문 완료
로켓프레시 내일(수) 새벽 도착 (상품 3개)
판매자 : 쿠팡
오뚜기 컵누들 베트남 쌀국수, 47g, 6개
6,940 원 로켓프레시
수량: 1개
곰곰 칼국수 김치, 500g, 1개
5,990 원 로켓프레시
수량: 1개
국내산 양배추, 1개입, 1개
3,090 원 로켓프레시
수량: 1개
배송 3건 중 2
황태를 그대로 담다 무염 황태가루100g 강아지 애견 고양이 간식 보양식, 1개
7,740 원 판매자로켓
수량: 1개
유즈코쇼 38g 유자고추
5,390 원 판매자로켓
총 결제금액 29,150원`;
const mi = parseItems(coupang);
const okN = mi.items.length === 5;
if (!okN) fail++;
console.log((okN ? "PASS" : "FAIL"), "여러 품목: 5개 추출 ->", mi.items.length, JSON.stringify(mi.items.map(x => x.amount)));
const okSum = mi.items.reduce((a, x) => a + x.amount, 0) === 29150;
if (!okSum) fail++;
console.log((okSum ? "PASS" : "FAIL"), "여러 품목: 합계 29,150 ->", mi.items.reduce((a, x) => a + x.amount, 0));
const okTotal = mi.total === 29150;
if (!okTotal) fail++;
console.log((okTotal ? "PASS" : "FAIL"), "여러 품목: 총액 줄은 품목에서 제외 ->", mi.total);
const okName = mi.items[0].name.includes("쌀국수") && mi.items[4].name.includes("유자고추");
if (!okName) fail++;
console.log((okName ? "PASS" : "FAIL"), "여러 품목: 이름 매칭 ->", mi.items[0].name, "/", mi.items[4].name);
const single = parseItems("[Web발신]\n신한카드 승인 12,300원 08/31 스타벅스");
const okSingle = single.items.length === 1;
if (!okSingle) fail++;
console.log((okSingle ? "PASS" : "FAIL"), "단일 문자는 1개 ->", single.items.length);

// CSV 파서 (첨부 파일 원문)
{
  const mc = html.match(/\/\*CSV_START\*\/([\s\S]*?)\/\*CSV_END\*\//);
  const parseCsv = new Function(mc[1] + "; return parseCsv;")();
  const { readFileSync: rf } = await import("node:fs");
  const { fileURLToPath: f2p } = await import("node:url");
  const { dirname: dn, join: jn } = await import("node:path");
  const fx = rf(jn(dn(f2p(import.meta.url)), "fixtures", "export-sample.csv"), "utf-8");
  const r = parseCsv(fx);
  const chk = (name, ok, extra="") => { if (!ok) fail++; console.log((ok ? "PASS" : "FAIL"), "CSV:", name, extra); };
  chk("첨부 11행·오류 0", r.rows.length === 11 && r.errors.length === 0, r.rows.length + "/" + r.errors.length);
  chk("입금 3·지출 8", r.rows.filter(x => x.type === "income").length === 3 && r.rows.filter(x => x.type === "expense").length === 8);
  chk("쉼표 없는 이름 그대로", r.rows[4].memo === "오꾸밥" && r.rows[4].amount === 14900);
  chk("괄호 포함 내용", r.rows[2].memo === "네이버 쇼핑 (고기)");
  const tricky = '\uFEFF"금액(원)","날짜","구분","내용","누가"\r\n"1,500","2026-09-05","지출","김치, 500g ""특가""","같이"\r\n"x","2026-09-06","지출","깨진 금액","나"\r\n"1000","20260907","입금","깨진 날짜","나"\r\n';
  const t2 = parseCsv(tricky);
  chk("BOM·CRLF·열 순서 무관", t2.rows.length === 1 && t2.rows[0].amount === 1500 && t2.rows[0].date === "2026-09-05");
  chk("따옴표 안 쉼표·이스케이프", t2.rows[0].memo === '김치, 500g "특가"');
  chk("깨진 금액·날짜는 errors", t2.errors.length === 2 && /금액/.test(t2.errors[0].reason) && /날짜/.test(t2.errors[1].reason));
  chk("머리글 없음은 오류", parseCsv("a,b,c\n1,2,3").errors.length === 1 && parseCsv("a,b,c\n1,2,3").rows.length === 0);
}

// date sanity for the first case
const d = parseSms(cases[0].text).date;
console.log(/^\d{4}-08-31$/.test(d) ? "PASS" : "FAIL", "date parse ->", d);
if (fail) process.exit(1);
console.log("all sms cases ok");
