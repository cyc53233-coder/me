import { readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));   // ledger/
const INDEX = join(LEDGER, "index.html");
const ARTIFACT = join(LEDGER, "artifact.html");


const html = readFileSync(INDEX, "utf-8");
const m = html.match(/\/\*CALC_START\*\/([\s\S]*?)\/\*CALC_END\*\//);
if (!m) { console.error("calc engine not found"); process.exit(1); }
const { evalAmount, looksLikeFormula } =
  new Function(m[1] + "; return { evalAmount, looksLikeFormula };")();

let fail = 0;
const eq = (input, want, label) => {
  const got = evalAmount(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + (label || JSON.stringify(input)) + " -> " + got + (ok ? "" : " (기대: " + want + ")"));
};

console.log("--- 계산 ---");
eq("12000+3500-2000", 13500);
eq("1000*3", 3000);
eq("10000/4", 2500);
eq("12,000 + 3,500", 15500, "콤마·공백");
eq("12000×3÷2", 18000, "유니코드 연산자");
eq("(1000+2000)*2", 6000);
eq("1000.5+0.5", 1001, "소수점 반올림");
eq("45900", 45900, "순수 숫자");
eq("1000−200", 800, "유니코드 마이너스");
eq("((1+2)*1000)", 3000, "중첩 괄호");
eq("2*(3+4)*100", 1400, "연산자 우선순위");

console.log("--- 거부 ---");
eq("", null, "빈 문자열");
eq("1+", null, "미완성 식");
eq("((1+2)", null, "괄호 불일치");
eq("1000/0", null, "0으로 나누기");
eq("-5000", null, "음수");
eq("abc", null, "문자");
eq("1000+abc", null, "문자 섞임");
eq("0", null, "0원");
eq("1000-1000", null, "결과 0");
eq("1000-2000", null, "결과 음수");
eq(null, null, "null 입력");
eq("1..2", null, "잘못된 숫자");

console.log("--- 수식 감지 ---");
const detect = (v, want) => {
  const got = looksLikeFormula(v);
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + JSON.stringify(v) + " -> " + got);
};
detect("12000", false);
detect("12,000", false);
detect("12000+3500", true);
detect("(1+2)", true);

if (fail) { console.log("\n" + fail + "건 실패"); process.exit(1); }
console.log("\n계산기 엔진 전체 통과");
