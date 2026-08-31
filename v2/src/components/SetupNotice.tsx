/** 환경변수가 아직 안 채워졌을 때 하얀 화면 대신 보여 주는 안내입니다. */
export function SetupNotice({ error }: { error?: string }) {
  return (
    <section className="wrap">
      <div className="setup">
        <h2>⚙️ 설정이 아직 끝나지 않았습니다</h2>
        {error ? (
          <p className="error" style={{ marginBottom: 14 }}>
            {error}
          </p>
        ) : null}
        <p>
          <code>v2/.env.example</code> 을 <code>v2/.env.local</code> 로 복사하고 Supabase 주소와 키를
          채운 뒤 다시 실행하세요.
        </p>
        <ol>
          <li>
            Supabase에서 프로젝트를 만들고 <code>supabase/schema.sql</code> 을 SQL Editor에 붙여넣어
            실행합니다.
          </li>
          <li>
            Project Settings → API 에서 <b>URL</b> 과 <b>anon(publishable) 키</b>를 복사해
            <code>.env.local</code> 에 넣습니다.
          </li>
          <li>
            <code>npm run dev</code> 를 다시 시작합니다.
          </li>
        </ol>
        <p>
          자세한 절차는 <code>v2/README.md</code> 에 단계별로 적어 두었습니다.
        </p>
      </div>
    </section>
  );
}
