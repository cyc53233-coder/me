import type { Metadata } from "next";
import { Analytics } from "@/components/Analytics";
import { SiteNav } from "@/components/SiteNav";
import { SITE } from "@/lib/site";
import "./globals.css";

const favicon =
  `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>` +
  `<text y='.9em' font-size='90'>${SITE.emoji}</text></svg>`;

export const metadata: Metadata = {
  title: `${SITE.name} — 오늘의 핫딜`,
  description: "매일 찾은 최저가 핫딜만 모아둔 곳. 가격이 확실히 떨어졌을 때만 올립니다.",
  icons: { icon: favicon },
  openGraph: {
    type: "website",
    title: "오늘의 핫딜",
    description: "매일 찾은 최저가 핫딜만 모아둔 곳.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <SiteNav />
        <main>{children}</main>

        <footer>
          <div className="wrap">
            <p>{SITE.disclosure}</p>
            <p>가격과 재고는 수시로 바뀝니다. 구매 전 판매 페이지에서 최종 가격을 확인해 주세요.</p>
            <p>
              © {SITE.name} · <a href="/about">채널 소개</a>
            </p>
          </div>
        </footer>

        <Analytics />
      </body>
    </html>
  );
}
