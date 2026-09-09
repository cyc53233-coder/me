import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * 관리자 화면에 들어올 때마다 로그인 토큰을 갱신합니다.
 *
 * Next 15까지 middleware.ts 였던 파일입니다. Next 16에서 proxy.ts 로 이름이
 * 바뀌었고, 내보내는 함수 이름도 proxy 여야 합니다.
 * 이걸 빼면 한 시간쯤 뒤 토큰이 만료돼 갑자기 로그아웃된 것처럼 보입니다.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() 를 불러야 토큰이 실제로 갱신됩니다. getSession() 은 쿠키를
  // 그대로 믿기 때문에 서버에서 신뢰하면 안 됩니다.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
