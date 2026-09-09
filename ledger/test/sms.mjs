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
const parseSms = new Function("pad2", m[1] + "; return parseSms;")(pad2);

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

// date sanity for the first case
const d = parseSms(cases[0].text).date;
console.log(/^\d{4}-08-31$/.test(d) ? "PASS" : "FAIL", "date parse ->", d);
if (fail) process.exit(1);
console.log("all sms cases ok");
