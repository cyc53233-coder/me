// process.env.NEXT_PUBLIC_* 는 빌드할 때 문자열로 박혀 들어갑니다.
// 그래서 반드시 이렇게 통째로 적어야 하고, env["NEXT_" + x] 같은 조립은 안 됩니다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** 키가 아직 안 채워졌으면 사이트는 "설정이 필요합니다" 화면을 보여 줍니다. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
