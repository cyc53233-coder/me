import { DealList } from "@/components/DealList";
import { SetupNotice } from "@/components/SetupNotice";
import { SITE } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Deal } from "@/lib/types";

// 딜은 수시로 바뀌므로 요청마다 새로 읽습니다.
// (캐시를 붙이는 방법은 README「더 해 볼 것」참고)
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <Hero live={0} total={0} />
        <SetupNotice />
      </>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("posted_at", { ascending: false });

  if (error) {
    return (
      <>
        <Hero live={0} total={0} />
        <SetupNotice error={`Supabase에서 딜을 못 읽었습니다: ${error.message}`} />
      </>
    );
  }

  const deals = (data ?? []) as Deal[];

  return (
    <>
      <Hero live={deals.filter((d) => !d.ended).length} total={deals.length} />
      <DealList deals={deals} now={Date.now()} />
    </>
  );
}

function Hero({ live, total }: { live: number; total: number }) {
  return (
    <section className="hero">
      <div className="wrap">
        <h1>오늘의 핫딜</h1>
        <p>{SITE.tagline}</p>
        <div className="hero-stats">
          <span>
            <b>{live}</b>개 진행 중
          </span>
          <span>
            <b>{total}</b>개 누적
          </span>
        </div>
        <p className="disclosure">
          <span>ℹ️</span>
          <span>{SITE.disclosure}</span>
        </p>
      </div>
    </section>
  );
}
