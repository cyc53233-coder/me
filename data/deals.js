// ─────────────────────────────────────────────────────────────
//  딜 목록 — 손으로 고칠 일은 거의 없습니다.
//  Issues → 「딜 올리기」 에 공유하기 문구를 붙여넣으면 여기에 자동으로 쌓입니다.
//
//  title      상품명 (필수) — 붙여넣은 글에서 갈라냅니다
//  url        내 쉐어링크 / 파트너스 링크 (필수)
//  price      지금 가격, 숫자만 (필수)
//  listPrice  평소 가격, 숫자만 — 있으면 취소선으로 같이 보여 줍니다
//  mall       "toss" | "coupang" | "naver" | "11st" — 없으면 링크로 판단합니다
//  image      상품 사진 — 링크에서 읽어 오고, 못 읽으면 판매처 아이콘이 들어갑니다
//  category   고기·메인반찬 / 간식·음료 / 생활용품·기타 … (필터 칩이 됩니다)
//  note       "평소가 3.4만대" 같은 한 줄 메모
//  postedAt   올린 시각 "2026-09-20T19:34+09:00"
//  grade      🔥 개수 1~3 (3 무지성급 · 2 대박 · 1 추천). 없으면 등급 없음
//  ended      true 면 목록에서 빠집니다 (기록은 남습니다)
// ─────────────────────────────────────────────────────────────
window.DEALS = [
  {
    title: "크라운 빙수하임 말차팥빙수, 284g, 2개",
    url: "https://toss.im/_m/fjRzzPen",
    price: 6600,
    listPrice: 19500,
    image: "https://shopping.toss.im/live/temp/2026-07-30/6f6b2803-5537-4120-aa1e-0ed6ea92cadb.jpeg",
    category: "간식·음료",
    note: "과자파이 1위 · 여름 한정 · 무료배송",
    postedAt: "2026-09-20T18:16+09:00",
    grade: 2,
  },
  {
    title: "산과들에 원데이 발란스 그린라벨, 20g, 30봉",
    url: "https://toss.im/_m/VB9iIlu4",
    price: 7630,
    listPrice: 16000,
    image: "https://shopping.toss.im/live/taca/ai/MmNlNjFi/QUszS3g4YldOeXgvK2x4K0ZsOFlzbm1CSEsxclpHUlhvVld4TXBXNkJQVk8.png",
    category: "간식·음료",
    note: "혼합견과·믹스넛 1위 · 1봉당 255원 · 무료배송",
    postedAt: "2026-09-20T18:14+09:00",
    grade: 2,
  },
  {
    title: "셰프애찬 수제 청양 맵짤이, 매콤알싸한, 225g, 2통",
    url: "https://toss.im/_m/bCLByjZb",
    price: 7990,
    listPrice: 30000,
    image: "https://shopping.toss.im/live/temp/2026-08-25/2f72eb9e-beb9-440e-b752-44ee3fb0ea19.jpeg",
    category: "고기·메인반찬",
    note: "냉장냉동 분식 1위 · 1통당 3,995원 · 무료배송",
    postedAt: "2026-09-20T18:13+09:00",
    grade: 2,
  },
  {
    title: "에브리워터 무라벨, 500ml, 40개",
    url: "https://toss.im/_m/fxejB3Ko",
    price: 4400,
    listPrice: 19800,
    image: "https://shopping.toss.im/live/temp/2026-02-17/32d41410-98f1-42d9-a442-9e8820fad904.jpeg",
    category: "생활용품·기타",
    note: "국산생수 3위 · 1병당 110원 · 무료배송",
    postedAt: "2026-09-20T18:09+09:00",
    grade: 3,
  },
  {
    title: "제주 맑은콩나물, 무농약, 300g, 1개",
    url: "https://toss.im/_m/NdsQEWsm",
    price: 100,
    listPrice: 1390,
    image: "https://shopping.toss.im/live/temp/2026-09-03/19b2b5a6-934b-4dd3-bb00-dde44585514e.jpg",
    category: "고기·메인반찬",
    note: "오아시스 · 단품 배송비 5,000원, 2만원 이상 사면 무료배송",
    postedAt: "2026-09-20T17:04+09:00",
    grade: 1,
  },
  {
    title: "맥스 앤 맥스 전자레인지 라면 용기, 아이보리 1L 1개 + 올리브그린 1L 1개 + 뚜껑, 2개",
    url: "https://toss.im/_m/li4uEhtj",
    price: 3990,
    listPrice: 18900,
    image: "https://shopping.toss.im/live/temp/2026-03-06/4d9c7749-b71a-4815-9622-50747aeb997a.jpeg",
    category: "생활용품·기타",
    note: "전자레인지용기·찜기 1위 · 1개당 1,995원",
    postedAt: "2026-09-20T17:04+09:00",
    grade: 2,
  },
  {
    title: "롯데웰푸드 구구 크러스트 홈, 660ml, 6개",
    url: "https://toss.im/_m/lH4ogW93",
    price: 23300,
    listPrice: 38900,
    image: "https://shopping.toss.im/live/taca/ai/v2/NWNmYmIz/TFhxN2NQb3Yxbmpicjg1dzJxOVZLb2MxbUljMDBOT3ZUUkNxVldwUVZiZz0.png",
    category: "간식·음료",
    note: "컵 아이스크림 6위 · 10ml당 59원",
    postedAt: "2026-09-20T17:01+09:00",
    grade: 1,
  },
  {
    title: "스파클 생수, 무라벨, 2L, 24개",
    url: "https://toss.im/_m/BECumSdn",
    price: 7400,
    listPrice: 20000,
    image: "https://shopping.toss.im/live/temp/2026-03-18/268e4c6a-1595-43e9-9c1b-f101e5774429.jpeg",
    category: "생활용품·기타",
    note: "국산생수 2위 · 1병당 309원",
    postedAt: "2026-09-20T17:01+09:00",
    grade: 2,
  },
  {
    title: "던킨 제로 아이스티 화이트피치 6개 + 샤인앤라임 6개, 500ml, 1세트",
    url: "https://toss.im/_m/DmxOW6s8",
    price: 6600,
    listPrice: 24000,
    image: "https://shopping.toss.im/live/temp/2026-08-25/d1cbf35f-74b2-4757-9af7-57b15db20589.png",
    category: "간식·음료",
    note: "아이스티음료 1위 · 1개당 550원",
    postedAt: "2026-09-20T17:01+09:00",
    grade: 2,
  },
  {
    title: "더건강플러스 엑스트라버진 올리브오일, 1L, 1개",
    url: "https://toss.im/_m/JkNGxKlw",
    price: 8900,
    listPrice: 39800,
    image: "https://shopping.toss.im/live/temp/2026-06-05/28f63f1a-246e-4e36-82ad-12f0fbb50755.jpeg",
    category: "생활용품·기타",
    note: "엑스트라버진 올리브유 1위 · 하루 1개 한정",
    postedAt: "2026-09-20T16:57+09:00",
    grade: 3,
  },
  {
    title: "베베앙 데일리 비데 물티슈 캡형, 60매, 10팩",
    url: "https://toss.im/_m/NvBEQ4po",
    price: 6860,
    listPrice: 25900,
    image: "https://shopping.toss.im/live/temp/2025-06-05/f19b42f0-7bc7-4a21-b91b-7089d83de9fd.png",
    category: "생활용품·기타",
    note: "비데티슈 1위 · 1팩당 686원",
    postedAt: "2026-09-20T16:56+09:00",
    grade: 2,
  },
];
