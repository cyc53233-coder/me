import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 딜 링크는 /go/<id> 를 거쳐 쇼핑몰로 넘어갑니다.
 * 이렇게 한 덕에 얻는 것:
 *   1. 서버에서 세는 클릭 수 (Firebase Analytics는 광고 차단기에 막히면 0이 됩니다)
 *   2. 링크가 바뀌어도 이미 뿌린 주소는 그대로 살아 있음
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const home = new URL("/", request.url);

  if (!isSupabaseConfigured || !UUID.test(id)) {
    return NextResponse.redirect(home, 302);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("url, ended")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.redirect(home, 302);

  // DB에 들어간 주소라도 그대로 믿고 리다이렉트하지 않습니다.
  // http/https 가 아니면 (javascript:, data: …) 열린 리다이렉트가 됩니다.
  let target: URL;
  try {
    target = new URL(data.url);
    if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("bad scheme");
  } catch {
    return NextResponse.redirect(home, 302);
  }

  await countClick(supabase, id);

  return NextResponse.redirect(target, 302);
}

/**
 * 집계 때문에 사용자를 기다리게 하지 않습니다.
 * Cloudflare Workers 에는 "응답은 먼저 보내고 이 약속은 끝까지 실행해 줘" 라는
 * waitUntil 이 있습니다. 그게 없는 환경이면 그냥 기다렸다 보냅니다.
 */
async function countClick(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<void> {
  const job = supabase.rpc("register_click", { deal_id: id });

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(Promise.resolve(job));
    return;
  } catch {
    // Cloudflare 밖(예: next start)에서는 waitUntil 이 없습니다.
  }

  // 집계 실패가 링크 이동을 막아서는 안 됩니다.
  await job.then(
    () => undefined,
    () => undefined,
  );
}
