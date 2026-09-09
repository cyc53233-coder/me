/**
 * 카톡방에 붙여넣는 문구. v2 사이트의 src/lib/format.ts 와 같은 모양을 냅니다.
 * 두 곳에 있는 이유는 런타임이 달라서입니다(브라우저 TS / Actions 안의 Node).
 * 한쪽을 고치면 다른 쪽도 같이 고치세요 — 특히 아래 수수료 고지 문구.
 */

export const MALLS = {
  toss: { label: "토스", emoji: "💎" },
  coupang: { label: "쿠팡", emoji: "🚀" },
  naver: { label: "네이버", emoji: "🟢" },
  "11st": { label: "11번가", emoji: "🔴" },
  gmarket: { label: "지마켓", emoji: "🟡" },
};

/** 공정거래위원회 추천·보증 심사지침상 의무 고지입니다. 지우지 마세요. */
export const SHARE_DISCLOSURE =
  "* 이 게시물은 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";

export const discountRate = (deal) =>
  deal.list_price && deal.price && deal.list_price > deal.price
    ? Math.round((1 - deal.price / deal.list_price) * 100)
    : 0;

export const mallLabel = (key) => MALLS[key]?.label ?? key ?? "";
export const mallEmoji = (key) => MALLS[key]?.emoji ?? "💎";

/** 링크 주소로 판매처를 알아냅니다. 폼에서 고르지 않았을 때 씁니다. */
export function mallFromUrl(url = "") {
  const u = String(url);
  if (u.includes("toss.im")) return "toss";
  if (u.includes("coupang")) return "coupang";
  if (u.includes("naver")) return "naver";
  if (u.includes("11st")) return "11st";
  if (u.includes("gmarket")) return "gmarket";
  return "toss";
}

export function kakaoText(deal) {
  const lines = [
    `${mallEmoji(deal.mall)} [${mallLabel(deal.mall)}] ${deal.title}`,
    ` ┗ ${deal.hot ? "대박 🔥🔥🔥 " : ""}${won(deal.price)}`,
  ];
  const rate = discountRate(deal);
  if (deal.list_price) {
    lines.push(` ┗ 평소가 ${won(deal.list_price)}${rate ? ` (${rate}% 싸요)` : ""}`);
  }
  if (deal.note) lines.push(` ┗ ${deal.note}`);
  lines.push(deal.url, "", SHARE_DISCLOSURE);
  return lines.join("\n");
}
