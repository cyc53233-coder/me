import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DealForm } from "@/components/DealForm";
import { SetupNotice } from "@/components/SetupNotice";
import { won } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Deal } from "@/lib/types";
import { deleteDeal, setEnded, signOut } from "./actions";

export const metadata: Metadata = { title: "딜 관리", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const supabase = await createClient();

  // getUser() 는 Supabase 서버에 토큰을 확인시킵니다.
  // getSession() 은 쿠키 내용을 그대로 믿기 때문에 권한 판정에 쓰면 안 됩니다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("posted_at", { ascending: false });
  const deals = (data ?? []) as Deal[];

  return (
    <section className="wrap">
      <div className="admin-head">
        <h1>딜 관리</h1>
        <div className="spacer" />
        <span style={{ fontSize: 13, color: "var(--dim)" }}>{user.email}</span>
        <form action={signOut}>
          <button className="btn btn-sm" type="submit">
            로그아웃
          </button>
        </form>
      </div>

      {!adminRow && (
        <p className="error" style={{ marginBottom: 16 }}>
          로그인은 됐지만 <b>admins 표에 없는 계정</b>입니다. 딜을 올리면 거절됩니다.
          <br />
          <code>supabase/schema.sql</code> 맨 아래 5번 안내대로 내 계정을 등록하세요.
        </p>
      )}

      <DealForm />

      <h2 style={{ fontSize: 16, margin: "10px 0 0" }}>올라간 딜 {deals.length}개</h2>
      <div className="admin-list">
        {deals.length === 0 && <p style={{ color: "var(--dim)", fontSize: 14 }}>아직 없습니다.</p>}

        {deals.map((deal) => (
          <div key={deal.id} className={`admin-row ${deal.ended ? "is-ended" : ""}`}>
            <div className="t">
              <b>{deal.title}</b>
              <span>
                {won(deal.price)} · {deal.category} · {deal.clicks.toLocaleString("ko-KR")}번 눌림
              </span>
            </div>

            <form action={setEnded}>
              <input type="hidden" name="id" value={deal.id} />
              <input type="hidden" name="ended" value={String(!deal.ended)} />
              <button className="btn btn-sm" type="submit">
                {deal.ended ? "되살리기" : "마감"}
              </button>
            </form>

            <form action={deleteDeal}>
              <input type="hidden" name="id" value={deal.id} />
              <button className="btn btn-sm btn-danger" type="submit">
                삭제
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
