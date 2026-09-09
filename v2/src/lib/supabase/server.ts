import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * 서버(서버 컴포넌트 · 서버 액션 · 라우트 핸들러)에서 쓰는 클라이언트.
 * 로그인 세션은 쿠키에 들어 있으므로 쿠키를 읽고 쓸 수 있게 넘겨 줍니다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없습니다. 세션 갱신은
          // middleware.ts 가 대신 해 주므로 여기서는 조용히 넘어갑니다.
        }
      },
    },
  });
}
