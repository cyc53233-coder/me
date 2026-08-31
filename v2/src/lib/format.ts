import { MALLS } from "./site";
import type { Deal } from "./types";

export const won = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("ko-KR") + "원";

export const discountRate = (d: Pick<Deal, "price" | "list_price">) =>
  d.list_price && d.price && d.list_price > d.price
    ? Math.round((1 - d.price / d.list_price) * 100)
    : 0;

export const mallLabel = (key: string) => MALLS[key]?.label ?? key ?? "";
export const mallEmoji = (key: string) => MALLS[key]?.emoji ?? "💎";

/**
 * "3시간 전" 같은 상대 시각.
 * 서버에서 그린 문자열과 브라우저에서 그린 문자열이 다르면 hydration 오류가
 * 나므로, 이 함수는 클라이언트 컴포넌트에서 마운트 뒤에만 부릅니다.
 */
export function timeAgo(iso: string, now: number = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  // 서버(UTC)와 브라우저(KST)가 다른 날짜를 그리면 hydration이 깨지므로
  // 시간대를 한국으로 못박습니다.
  return new Date(t).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

/** 카톡방에 그대로 붙여넣는 문구 */
export function kakaoText(deal: Deal, shareDisclosure: string) {
  const lines = [
    `${mallEmoji(deal.mall)} [${mallLabel(deal.mall)}] ${deal.title}`,
    ` ┗ ${deal.hot ? "대박 🔥🔥🔥 " : ""}${won(deal.price)}`,
  ];
  const rate = discountRate(deal);
  if (deal.list_price) {
    lines.push(` ┗ 평소가 ${won(deal.list_price)}${rate ? ` (${rate}% 싸요)` : ""}`);
  }
  if (deal.note) lines.push(` ┗ ${deal.note}`);
  lines.push(deal.url, "", shareDisclosure);
  return lines.join("\n");
}
