"use client";

import { useState } from "react";
import { track, trackDealClick } from "@/lib/firebase";
import { discountRate, kakaoText, mallEmoji, mallLabel, timeAgo, won } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { Deal } from "@/lib/types";

/** now 를 서버에서 받아 쓰는 이유는 DealList.tsx 주석에 적어 두었습니다. */
export function DealCard({ deal, now }: { deal: Deal; now: number }) {
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const rate = discountRate(deal);
  const showImage = Boolean(deal.image) && !imageFailed;

  async function copyKakao() {
    try {
      await navigator.clipboard.writeText(kakaoText(deal, SITE.shareDisclosure));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      void track("copy_kakao_text", { item_id: deal.id });
    } catch {
      // 클립보드는 https 이거나 localhost 여야 동작합니다.
      window.prompt("복사해서 쓰세요", kakaoText(deal, SITE.shareDisclosure));
    }
  }

  return (
    <article className={`deal ${deal.ended ? "is-ended" : ""}`}>
      <div className={`thumb ${showImage ? "" : "is-empty"}`}>
        {showImage ? (
          // next/image 대신 <img> 를 쓰는 이유는 README「왜 next/image를 안 쓰나」참고.
          <img src={deal.image!} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="thumb-fallback">{mallEmoji(deal.mall)}</div>
        )}
        <div className="badges">
          {rate > 0 && <span className="badge badge-off">{rate}%</span>}
          {deal.hot && !deal.ended && <span className="badge badge-hot">🔥 대박</span>}
          {deal.mall && <span className="badge badge-mall">{mallLabel(deal.mall)}</span>}
          {deal.ended && <span className="badge badge-ended">마감</span>}
        </div>
      </div>

      <div className="deal-body">
        {deal.category && <div className="deal-cat">{deal.category}</div>}
        <h2 className="deal-title">{deal.title}</h2>
        {deal.note && <p className="deal-note">{deal.note}</p>}
        <div className="deal-price">
          <span className="price-now">{won(deal.price)}</span>
          {deal.list_price ? <span className="price-was">{won(deal.list_price)}</span> : null}
        </div>
        <div className="deal-meta">
          {timeAgo(deal.posted_at, now)}
          {deal.clicks > 0 && ` · ${deal.clicks.toLocaleString("ko-KR")}번 눌림`}
        </div>
      </div>

      <div className="deal-actions">
        {deal.ended ? (
          <button className="btn" disabled>
            마감된 딜
          </button>
        ) : (
          <a
            className="btn"
            href={`/go/${deal.id}`}
            target="_blank"
            rel="nofollow sponsored noopener"
            onClick={() => void trackDealClick(deal)}
          >
            최저가 보러가기
          </a>
        )}
        <button
          className={`btn btn-ghost ${copied ? "is-done" : ""}`}
          onClick={copyKakao}
          title="카톡용 문구 복사"
          aria-label="카톡용 문구 복사"
        >
          {copied ? "✓" : "💬"}
        </button>
      </div>
    </article>
  );
}
