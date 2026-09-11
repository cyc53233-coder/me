// 채널 설정 — v1의 data/site.js에 해당합니다. 이 파일만 고치면 사이트 전체가 바뀝니다.
export const SITE = {
  name: "무지성 핫딜",
  emoji: "🔥",
  tagline: "하루 종일 뒤져서 진짜 싼 것만 올립니다",
  intro: [
    "생필품·식품·가전 위주로 매일 최저가를 찾아 올리는 핫딜 큐레이션 채널입니다.",
    "가격이 평소보다 확실히 떨어졌을 때만 올리고, 종료된 딜은 마감 표시를 남깁니다.",
  ],
  repo: "cyc53233-coder/me",
  contact: "cyc53233@gmail.com",

  // 수수료 고지 — 공정거래위원회 추천·보증 심사지침상 의무입니다. 지우지 마세요.
  disclosure:
    "이 사이트의 상품 링크는 토스쇼핑 쉐어링크 · 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  shareDisclosure:
    "* 이 게시물은 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
} as const;

export const MALLS: Record<string, { label: string; emoji: string }> = {
  toss: { label: "토스", emoji: "💎" },
  coupang: { label: "쿠팡", emoji: "🚀" },
  naver: { label: "네이버", emoji: "🟢" },
  "11st": { label: "11번가", emoji: "🔴" },
  gmarket: { label: "지마켓", emoji: "🟡" },
};
