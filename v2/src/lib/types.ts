/** deals 테이블 한 줄. 컬럼 이름은 DB(snake_case)를 그대로 씁니다. */
export type Deal = {
  id: string;
  title: string;
  url: string;
  price: number;
  list_price: number | null;
  mall: string;
  image: string | null;
  category: string;
  note: string | null;
  hot: boolean;
  ended: boolean;
  clicks: number;
  posted_at: string;
};
