// ─────────────────────────────────────────────────────────────
//  딜 목록 — 새 딜은 이 배열 맨 위에 한 칸 추가하면 끝입니다.
//  add.html 을 열어서 폼에 채우면 아래 형식대로 만들어 줍니다.
//
//  title      상품명 (필수)
//  url        내 쉐어링크 / 파트너스 링크 (필수)
//  price      지금 가격, 숫자만 (필수)
//  listPrice  평소 가격, 숫자만 — 있으면 할인율이 자동 계산됩니다
//  mall       "toss" | "coupang" | "naver" | "11st" | 그 외 아무 이름
//  image      상품 이미지 주소 — 없으면 빈 칸으로 두세요
//  category   식품 / 생활 / 가전 / 패션 / 반려동물 … 자유롭게
//  note       "평소가 3.4만대" 같은 한 줄 메모
//  postedAt   올린 시각 "2026-08-31T19:34+09:00"
//  hot        true 면 🔥 대박 표시
//  ended      true 면 마감 처리 (지우지 말고 마감으로 남겨두면 기록이 됩니다)
//  sample     샘플 딜 표시 — 진짜 딜에는 쓰지 마세요
// ─────────────────────────────────────────────────────────────
window.DEALS = [
  {
    title: "하림펫푸드 밥이보약 DOG, 튼튼한 관절, 전연령, 3.4kg, 1개",
    url: "https://example.com/내-쉐어링크로-바꾸세요",
    price: 19900,
    listPrice: 34000,
    mall: "toss",
    image: "",
    category: "반려동물",
    note: "관절 사료 이 가격 잘 없어요",
    postedAt: "2026-08-31T19:34+09:00",
    hot: true,
    sample: true,
  },
  {
    title: "오뚜기 토마토 케찹, 800g, 2개",
    url: "https://example.com/내-쉐어링크로-바꾸세요",
    price: 5980,
    listPrice: 8900,
    mall: "coupang",
    image: "",
    category: "식품",
    note: "별점 4.8 / 리뷰 23만개",
    postedAt: "2026-08-31T19:27+09:00",
    hot: false,
    sample: true,
  },
  {
    title: "삼다수 무라벨 2L, 24병",
    url: "https://example.com/내-쉐어링크로-바꾸세요",
    price: 13000,
    listPrice: 17900,
    mall: "toss",
    image: "",
    category: "생활",
    note: "생수는 이 밑으로는 잘 안 내려옵니다",
    postedAt: "2026-08-30T11:02+09:00",
    hot: false,
    ended: true,
    sample: true,
  },
];
