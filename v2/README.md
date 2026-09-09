# 핫딜 사이트 v2 — Next.js · Supabase · Firebase · Cloudflare

스크린샷에서 본 "무료 배포 조합"을 실제로 돌아가는 사이트 하나에 전부 붙여 본 것입니다.
루트에 있는 v1(정적 HTML) 사이트는 그대로 살아 있고, 이 폴더는 따로 돕니다.

## 다섯 개 도구가 각자 맡은 일

| 도구 | 이 프로젝트에서 하는 일 | 해당 파일 |
|---|---|---|
| **Next.js** | 프레임워크. 서버에서 딜을 읽어 HTML로 그리고, 관리자 화면의 폼 처리까지 | `src/app/**` |
| **Supabase** | Postgres에 딜 저장 + 관리자 로그인 + 권한(RLS) | `supabase/schema.sql`, `src/lib/supabase/**` |
| **Firebase** | 방문자 행동 분석. 어떤 딜이 실제로 눌렸는지 | `src/lib/firebase.ts` |
| **Cloudflare** | 배포. Workers 위에서 이 앱이 돕니다 | `wrangler.jsonc`, `open-next.config.ts` |
| **Vercel** | 이번엔 안 씁니다 — 이유와 대안 경로는 아래 「Vercel로 올리려면」 | — |

### 왜 Cloudflare **또는** Vercel인가

목록에 다섯 개가 나란히 있지만 **자리는 세 개**입니다. Cloudflare와 Vercel은
"Next.js 앱을 올리는 곳"이라는 같은 자리를 놓고 겨루는 후보라서, 보통 하나만 씁니다.

이 사이트에서 Cloudflare를 고른 이유는 하나입니다. **Vercel 무료(Hobby) 플랜은
비상업적 용도 한정**인데, 이 사이트는 제휴 링크로 수수료를 받습니다. 규정상 맞지
않습니다. Cloudflare Workers 무료 플랜에는 그 제한이 없습니다.

### 왜 Supabase와 Firebase를 같이 쓰나

둘 다 "DB + 인증"을 파는 회사라 보통은 둘 중 하나만 씁니다. 여기서는 역할을 갈랐습니다.

- **Supabase** — 딜 데이터와 로그인. SQL을 그대로 쓸 수 있고 RLS로 권한을 DB 안에서 막습니다.
- **Firebase** — **Analytics만.** 방문자 행동 분석은 Google Analytics 쪽이 훨씬 좋고 무료입니다.

Firebase의 Firestore·Authentication은 **일부러 쓰지 않습니다.** 같은 일을 하는 것을
두 개 붙이면 "이 데이터는 어디에 있더라"가 바로 시작됩니다.

---

## 따라하기

### 0. 준비

```bash
cd v2
npm install
```

### 1. Supabase — 딜 저장소와 로그인

1. [supabase.com](https://supabase.com) 가입 → **New project**. 리전은 **Northeast Asia (Seoul)**
   이 가장 가깝습니다. DB 비밀번호는 따로 적어 두세요(나중에 볼 방법이 없습니다).
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run**.
   딜 테이블, 권한 정책, 클릭 카운터가 한 번에 만들어집니다.
3. **Authentication → Users → Add user** 로 내 이메일/비밀번호 계정을 만듭니다.
   **Auto Confirm User를 켜세요** — 안 켜면 확인 메일을 기다려야 합니다.
4. 다시 **SQL Editor** 에서, 이메일만 내 것으로 바꿔 아래를 실행합니다.

   ```sql
   insert into public.admins (user_id, note)
   select id, '나' from auth.users where email = '내메일@example.com'
   on conflict (user_id) do nothing;
   ```

5. **Project Settings → API** 에서 **Project URL** 과 **anon (publishable) 키**를 복사합니다.

> `anon` 키는 브라우저로 그대로 나가는 공개용 키입니다. 숨길 필요가 없고 숨길 수도 없습니다.
> 대신 3단계에서 넣은 RLS 정책이 "읽기는 누구나, 쓰기는 admins 표에 있는 사람만"을 DB
> 안에서 강제합니다. `service_role` 키는 이 프로젝트 어디에도 쓰지 않습니다 —
> 그 키는 RLS를 통째로 무시하기 때문에 브라우저로 나가는 앱에 두면 안 됩니다.

### 2. Firebase — 어떤 딜이 눌렸는지 보기

1. [console.firebase.google.com](https://console.firebase.google.com) → **프로젝트 추가**.
   중간에 **Google 애널리틱스 사용 설정을 켜야 합니다.** 끄면 Analytics를 못 씁니다.
2. 프로젝트 개요 → **</> (웹)** 아이콘으로 웹 앱을 등록합니다.
3. 나오는 `firebaseConfig` 값을 복사합니다. **`measurementId`(G-로 시작)가 있어야** 합니다.
   없으면 1번에서 애널리틱스를 안 켠 것입니다.

### 3. 키 채우기

```bash
cp .env.example .env.local
```

`.env.local`을 열어 1·2단계에서 복사한 값을 붙여넣습니다.
이 파일은 `.gitignore`에 걸려 있어 커밋되지 않습니다.

### 4. 로컬에서 띄우기

```bash
npm run dev          # http://localhost:3000
```

- `/` — 딜 목록 (아직 비어 있습니다)
- `/admin` — 로그인하면 딜을 올릴 수 있습니다
- 딜을 하나 올리고 목록에서 **최저가 보러가기**를 눌러 보세요. `/go/<id>`를 거쳐
  쇼핑몰로 넘어가고, 관리 화면의 클릭 수가 올라갑니다.

키가 아직 없으면 하얀 화면 대신 **"설정이 아직 끝나지 않았습니다"** 안내가 나옵니다.

### 5. Cloudflare에 배포

```bash
npx wrangler login    # 브라우저가 열립니다
npm run deploy
```

끝나면 `https://hotdeal-v2.<내계정>.workers.dev` 주소가 나옵니다.

> **`npm run deploy`는 내 컴퓨터에서 빌드합니다.** `NEXT_PUBLIC_*` 값은 빌드할 때 코드에
> 박혀 들어가므로, 배포 직전에 `.env.local`이 채워져 있어야 합니다. 비어 있으면
> 배포는 성공하는데 사이트에는 "설정이 아직 끝나지 않았습니다"가 뜹니다.
>
> 이 프로젝트에는 서버 전용 비밀 키가 없어서 `wrangler secret`으로 넣을 것도 없습니다.

---

## 파일 지도

```
v2/
├── supabase/schema.sql        딜 테이블 · RLS 정책 · 클릭 카운터  ← 여기부터 읽으세요
├── wrangler.jsonc             Cloudflare 배포 설정
├── open-next.config.ts        Next.js를 Workers용으로 변환하는 설정
├── src/
│   ├── proxy.ts               /admin 들어올 때 로그인 토큰 갱신
│   ├── app/
│   │   ├── page.tsx           딜 목록 (서버에서 Supabase 읽기)
│   │   ├── about/page.tsx     채널 소개 · 수수료 고지
│   │   ├── go/[id]/route.ts   클릭 세고 쇼핑몰로 보내기
│   │   └── admin/             로그인 · 딜 등록 · 마감 · 삭제
│   ├── components/            화면 조각 (딜 카드, 목록, 폼)
│   └── lib/                   Supabase · Firebase · 포맷 함수
└── .env.example               채워야 할 키 목록
```

## 설계에서 알아 둘 것

몇 가지는 "원래 그렇게 하는 것"과 다르게 했습니다. 이유가 있습니다.

**비밀 키가 하나도 없습니다.** 환경변수가 전부 `NEXT_PUBLIC_`입니다. 즉 전부 브라우저로
나갑니다. 이게 가능한 이유는 권한 판정을 앱이 아니라 **DB가** 하기 때문입니다(RLS).
앱 코드에 버그가 있어도 남이 딜을 지울 수 없습니다.

**딜 링크는 `/go/<id>`를 거칩니다.** 이유가 둘입니다. (1) Firebase Analytics는 광고
차단기에 곧잘 막혀서, 막힌 방문자의 클릭은 0으로 잡힙니다. 서버에서 세는 숫자는 안
막힙니다. (2) 나중에 링크가 바뀌어도 이미 카톡방에 뿌린 주소는 그대로 살아 있습니다.
집계 때문에 사용자를 기다리게 하지 않으려고 Cloudflare의 `waitUntil`을 씁니다 —
"응답은 먼저 보내고 이 작업은 끝까지 실행해 줘"라는 뜻입니다.

**모든 페이지가 `force-dynamic`입니다.** 딜은 수시로 바뀌니 매번 새로 읽습니다. 방문자가
늘어 요청 수가 부담되면 아래 「더 해 볼 것」의 캐시를 붙이세요.

**`next/image` 대신 `<img>`를 씁니다.** 상품 이미지는 쇼핑몰 도메인에서 오는데, Next의
이미지 최적화를 Cloudflare에서 켜려면 별도 바인딩이 필요하고 무료 한도도 따로 붙습니다.
쇼핑몰이 이미 적당한 크기로 주는 이미지라 얻는 게 적습니다.

**빌드할 때 경고가 하나 뜹니다.**

```
WARN Node.js middleware support is experimental in cloudflare,
     and not officially maintained by OpenNext maintainers.
```

`src/proxy.ts` 때문입니다. Next 16부터 이 파일은 **항상 Node.js 런타임에서 돌고**
(런타임을 지정하면 빌드가 실패합니다), OpenNext의 Cloudflare 지원은 아직 실험적입니다.
Next 16 + Cloudflare 조합이면 누구나 보는 경고입니다.

실제로 Workers 런타임에 올려서 확인해 봤고, 로그인 판정·리다이렉트 모두 정상 동작합니다.
그리고 이 파일은 `/admin` 경로에서만 돌게 걸어 두었습니다(`src/proxy.ts` 맨 아래 `matcher`).
혹시 이게 말썽을 부려도 **방문자가 보는 딜 목록은 영향을 받지 않고**, 관리자 로그인만
영향을 받습니다.

## Vercel로 올리려면

이 사이트는 수수료를 받아서 Vercel 무료 플랜에 맞지 않지만, 연습용으로 올려 보는 것은
됩니다. 코드는 **하나도 고칠 필요가 없습니다** — Next.js 앱 그대로입니다.

1. [vercel.com](https://vercel.com)에 GitHub으로 로그인 → 이 저장소를 Import
2. **Root Directory를 `v2`로** 지정 (저장소 루트에는 v1 정적 사이트가 있습니다)
3. Environment Variables에 `.env.local`의 값들을 그대로 붙여넣기
4. Deploy

`wrangler.jsonc`와 `open-next.config.ts`는 Vercel에서 그냥 무시됩니다. 양쪽에 다 올려
두고 속도나 로그를 비교해 봐도 됩니다.

## 더 해 볼 것

- **캐시 붙이기** — R2 버킷을 만들고 `wrangler.jsonc`에 `NEXT_INC_CACHE_R2_BUCKET`
  바인딩과 자기참조 서비스 바인딩을 추가하면 페이지를 캐시할 수 있습니다.
  `node_modules/@opennextjs/cloudflare/templates/wrangler.jsonc`에 완성된 예시가 있습니다.
- **내 도메인 붙이기** — Cloudflare 대시보드 → Workers → 해당 Worker → Custom Domains.
- **v1의 이슈 자동화 잇기** — 루트의 `.github/workflows/deal.yml`은 지금 `data/deals.js`
  파일을 고칩니다. 이걸 Supabase에 넣도록 바꾸면 폰에서 이슈만 올려도 v2에 딜이 뜹니다.
- **클릭 수로 정렬** — `clicks` 컬럼은 이미 쌓이고 있습니다. 정렬 기준만 추가하면 됩니다.

## 무료 플랜에서 걸리는 것들

숫자는 자주 바뀌니 각 회사 요금 페이지를 확인하는 편이 정확합니다. 성격만 적어 둡니다.

- **Supabase** — 일정 기간(대략 일주일) 아무 접속이 없으면 프로젝트가 일시정지됩니다.
  대시보드에서 바로 되살릴 수 있지만, 그동안 사이트는 딜을 못 읽습니다.
- **Cloudflare Workers** — 무료 플랜은 하루 요청 수 상한이 있습니다. 개인 채널 규모에서
  넘길 일은 잘 없습니다. 상업적 사용 제한은 없습니다.
- **Vercel** — 무료(Hobby) 플랜은 비상업적 용도 한정입니다.
- **Firebase Analytics** — 표준 이벤트 집계는 무료입니다. 유료로 넘어가는 것은
  Firestore·Functions 같은 다른 제품이고, 이 프로젝트는 안 씁니다.

## v1은 어떻게 되나

루트의 정적 사이트는 **그대로 둡니다.** 빌드도 서버도 DB도 없이 GitHub Pages에서 도는
사이트에는 그 나름의 장점이 있습니다 — 고장 날 것이 없습니다.

v2는 v1이 못 하는 것을 합니다. 폰에서 로그인해서 딜을 올리고, 어떤 딜이 실제로 눌렸는지
봅니다. 둘을 얼마간 같이 굴려 보고, v2가 손에 익으면 그때 갈아타면 됩니다.
