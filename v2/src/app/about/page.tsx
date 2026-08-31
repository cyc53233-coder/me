import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `채널 소개 — ${SITE.name}`,
  description: SITE.tagline,
};

export default function AboutPage() {
  return (
    <section className="wrap prose">
      <h1>채널 소개</h1>
      {SITE.intro.map((line) => (
        <p key={line}>{line}</p>
      ))}

      <h2>수수료 고지</h2>
      <p className="disclosure">
        <span>ℹ️</span>
        <span>{SITE.disclosure}</span>
      </p>
      <p>
        위 고지는 공정거래위원회 「추천·보증 등에 관한 표시·광고 심사지침」에 따라 대가를 받는
        링크임을 알리는 문구입니다. 링크를 눌러 구매하셔도 가격은 같고, 판매는 각 쇼핑몰이 합니다.
      </p>

      <h2>딜을 고르는 기준</h2>
      <ul>
        <li>평소 가격보다 확실히 떨어졌을 때만 올립니다.</li>
        <li>재고가 빠지거나 가격이 오르면 마감으로 표시하고 기록은 남깁니다.</li>
        <li>직접 쓰지 않는 물건이라도 가격 근거가 없으면 올리지 않습니다.</li>
      </ul>

      <h2>연락</h2>
      <p>
        문의는 <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a> 로 주세요.
      </p>
    </section>
  );
}
