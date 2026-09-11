"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "이메일이나 비밀번호가 맞지 않습니다."
          : signInError.message,
      );
      setPending(false);
      return;
    }

    // refresh() 를 먼저 불러야 서버 컴포넌트가 새 쿠키를 보고 다시 그립니다.
    router.refresh();
    router.push("/admin");
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="login">
        <h1>설정이 아직 끝나지 않았습니다</h1>
        <p className="sub">
          <code>.env.local</code> 에 Supabase 주소와 키를 채워 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="login">
      <h1>관리자 로그인</h1>
      <p className="sub">딜을 올리고 마감하는 화면입니다. 방문자는 볼 일이 없습니다.</p>

      <form className="form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}

        <div className="field">
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "확인 중…" : "로그인"}
        </button>
      </form>

      <p className="sub" style={{ marginTop: 18 }}>
        계정은 Supabase 대시보드 → Authentication → Users 에서 만듭니다. 가입 폼을 두지 않은 것은
        일부러입니다 — 관리자가 한 명뿐인 사이트에서는 공격 표면만 늘어납니다.
      </p>
    </div>
  );
}
