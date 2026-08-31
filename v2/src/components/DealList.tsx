"use client";

import { useMemo, useState } from "react";
import { DealCard } from "./DealCard";
import { discountRate } from "@/lib/format";
import type { Deal } from "@/lib/types";

/**
 * now 는 서버에서 계산해 내려받습니다.
 * "3시간 전" 을 서버와 브라우저가 각자 Date.now() 로 계산하면 몇 밀리초 차이로
 * 다른 글자가 나와 hydration 경고가 뜹니다. 같은 기준 시각을 넘겨 주면 양쪽이
 * 반드시 같은 문자열을 그립니다.
 */
export function DealList({ deals, now }: { deals: Deal[]; now: number }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "off">("new");
  const [showEnded, setShowEnded] = useState(false);

  const categories = useMemo(
    () => [...new Set(deals.map((d) => d.category).filter(Boolean))],
    [deals],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return deals
      .filter((d) => (showEnded ? true : !d.ended))
      .filter((d) => (category ? d.category === category : true))
      .filter((d) =>
        needle
          ? `${d.title} ${d.note ?? ""} ${d.category}`.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => {
        // 마감된 딜은 정렬 기준과 상관없이 항상 아래로 내립니다.
        if (a.ended !== b.ended) return a.ended ? 1 : -1;
        if (sort === "off") return discountRate(b) - discountRate(a);
        return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
      });
  }, [deals, q, category, sort, showEnded]);

  return (
    <>
      <section className="wrap controls">
        <div className="search">
          <span>🔎</span>
          <input
            type="search"
            placeholder="상품 이름으로 찾기"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <div className="chips">
            <button
              className="chip"
              aria-pressed={category === null}
              onClick={() => setCategory(null)}
            >
              전체
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className="chip"
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="row">
          <button className="linkish" onClick={() => setSort(sort === "new" ? "off" : "new")}>
            {sort === "new" ? "최신순" : "할인율순"}
          </button>
          <span>·</span>
          <button className="linkish" onClick={() => setShowEnded(!showEnded)}>
            {showEnded ? "마감 포함" : "진행 중만"}
          </button>
        </div>
      </section>

      <section className="wrap">
        {shown.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🫙</div>
            <p>조건에 맞는 딜이 없습니다.</p>
          </div>
        ) : (
          <div className="grid">
            {shown.map((deal) => (
              <DealCard key={deal.id} deal={deal} now={now} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
