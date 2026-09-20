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
//  category   고기·메인반찬 / 간식·음료 / 생활용품·기타 … 자유롭게 (필터 칩이 됩니다)
//  note       "평소가 3.4만대" 같은 한 줄 메모
//  postedAt   올린 시각 "2026-09-20T19:34+09:00"
//  grade      🔥 개수 1~5 (5 무지성급 · 4 초대박 · 3 대박 · 2 중박 · 1 추천). 없으면 등급 없음
//  ended      true 면 마감 처리 (지우지 말고 마감으로 남겨두면 기록이 됩니다)
//  sample     샘플 딜 표시 — 진짜 딜에는 쓰지 마세요
// ─────────────────────────────────────────────────────────────
window.DEALS = [
  {
    title: "한돈 냉장 삼겹살 구이용 1kg",
    url: "https://example.com/내-쉐어링크로-바꾸세요",
    price: 14900,
    listPrice: 24900,
    mall: "toss",
    image: "",
    category: "고기·메인반찬",
    note: "냉장 삼겹 1kg 이 가격이면 바로 담으세요",
    postedAt: "2026-09-20T09:12+09:00",
    grade: 4,
    sample: true,
  },
  {
    title: "오리온 초코파이 39g × 24개입",
    url: "https://example.com/내-쉐어링크로-바꾸세요",
    price: 5980,
    listPrice: 8900,
    mall: "coupang",
    image: "",
    category: "간식·음료",
    note: "별점 4.8 / 리뷰 12만개",
    postedAt: "2026-09-19T21:40+09:00",
    grade: 2,
    sample: true,
  },
  {
    title: "삼다수 무라벨 2L, 24병",
    url: "https://example.com/내-쉐어링크로-바꾸세요",
    price: 13000,
    listPrice: 17900,
    mall: "toss",
    image: "",
    category: "생활용품·기타",
    note: "생수는 이 밑으로는 잘 안 내려옵니다",
    postedAt: "2026-09-17T11:02+09:00",
    grade: 3,
    ended: true,
    sample: true,
  },
];
