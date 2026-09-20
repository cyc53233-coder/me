import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LEDGER = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(LEDGER, "index.html"), "utf-8");
const m = html.match(/\/\*EXPIRY_START\*\/([\s\S]*?)\/\*EXPIRY_END\*\//);
if (!m) { console.error("expiry block not found"); process.exit(1); }
const pad2 = n => String(n).padStart(2, "0");
const todayStr = () => "2026-09-20";
const { parseExpiryDate, guessShelfDays, dday, ddayLabel, decideExpiry } =
  new Function("pad2", "todayStr", m[1] + "; return { parseExpiryDate, guessShelfDays, dday, ddayLabel, decideExpiry };")(pad2, todayStr);

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + " -> " + JSON.stringify(got) + (ok ? "" : " (기대: " + JSON.stringify(want) + ")"));
};

console.log("--- 텍스트에서 실제 유통기한 찾기 ---");
eq("유통기한 2026-10-15", parseExpiryDate("우유 900ml 유통기한 2026-10-15"), "2026-10-15");
eq("소비기한 26.10.15", parseExpiryDate("소비기한 26.10.15"), "2026-10-15");
eq("유통기한 2026년 10월 5일", parseExpiryDate("유통기한 2026년 10월 5일"), "2026-10-05");
eq("2026.10.15까지", parseExpiryDate("2026.10.15까지 드세요"), "2026-10-15");
eq("유통기한 20261015", parseExpiryDate("유통기한 20261015"), "2026-10-15");
eq("품질유지기한도 인식", parseExpiryDate("품질유지기한 2027/01/02"), "2027-01-02");
eq("날짜 없으면 null", parseExpiryDate("오뚜기 컵누들 6,940원"), null);
eq("13월은 거부", parseExpiryDate("유통기한 2026-13-01"), null);
eq("2월 30일은 거부", parseExpiryDate("유통기한 2026-02-30"), null);
eq("빈 입력", parseExpiryDate(""), null);

console.log("--- 이름으로 대략 며칠 (모르면 null) ---");
eq("우유", guessShelfDays("서울우유 900ml"), 5);
eq("라면", guessShelfDays("신라면 5개입"), 365);
eq("냉동만두", guessShelfDays("비비고 냉동만두"), 180);
eq("계란", guessShelfDays("국내산 계란 30구"), 21);
eq("양배추", guessShelfDays("국내산 양배추, 1개입"), 14);
eq("모르는 이름은 null", guessShelfDays("고양이 터널"), null);
eq("황태가루도 null", guessShelfDays("황태를 그대로 담다 무염 황태가루100g"), null);
eq("빈 이름", guessShelfDays(""), null);

console.log("--- D-day ---");
eq("오늘", dday("2026-09-20", "2026-09-20"), 0);
eq("사흘 뒤", dday("2026-09-23", "2026-09-20"), 3);
eq("이틀 지남", dday("2026-09-18", "2026-09-20"), -2);
eq("월 경계", dday("2026-10-01", "2026-09-30"), 1);
eq("연 경계", dday("2027-01-01", "2026-12-31"), 1);
eq("형식 틀리면 null", dday("2026/09/20", "2026-09-20"), null);
eq("라벨 오늘", ddayLabel(0), "오늘까지");
eq("라벨 미래", ddayLabel(3), "D-3");
eq("라벨 과거", ddayLabel(-2), "2일 지남");
eq("라벨 없음", ddayLabel(null), "기한 없음");

console.log("--- 실제 날짜 > 추정 > 빈칸 ---");
eq("텍스트 날짜 우선", decideExpiry("우유", "유통기한 2026-12-01", "2026-09-20"), { expireAt: "2026-12-01", guessed: false });
eq("없으면 이름으로 추정", decideExpiry("서울우유", "", "2026-09-20"), { expireAt: "2026-09-25", guessed: true });
eq("모르면 빈칸(추정 아님)", decideExpiry("고양이 터널", "", "2026-09-20"), { expireAt: "", guessed: false });
eq("산 날 기준으로 더함", decideExpiry("신라면", "", "2026-01-01"), { expireAt: "2027-01-01", guessed: true });

if (fail) { console.log("\n" + fail + "건 실패"); process.exit(1); }
console.log("\n유통기한 로직 전체 통과");
