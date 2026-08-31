-- ═══════════════════════════════════════════════════════════
--  핫딜 사이트 v2 — Supabase 스키마
--
--  Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전하도록 짰습니다 (if not exists / or replace).
--
--  설계 원칙: 앱에는 비밀 키가 없습니다.
--  브라우저에 나가는 anon(publishable) 키 하나만 쓰고, "누가 무엇을 할 수
--  있는지"는 전부 아래 RLS 정책이 DB 안에서 막습니다. 그래서 키가 유출돼도
--  남이 딜을 올리거나 지울 수 없습니다.
-- ═══════════════════════════════════════════════════════════

-- ── 1. 딜 테이블 ──────────────────────────────────────────
create table if not exists public.deals (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  url         text        not null,          -- 내 쉐어링크 / 파트너스 링크
  price       integer     not null check (price >= 0),
  list_price  integer              check (list_price >= 0),
  mall        text        not null default 'toss',
  image       text,
  category    text        not null default '기타',
  note        text,
  hot         boolean     not null default false,
  ended       boolean     not null default false,
  clicks      integer     not null default 0,
  posted_at   timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

-- 목록은 "안 끝난 딜 먼저, 최신순"으로 읽으니 그 순서로 인덱스를 답니다.
create index if not exists deals_posted_at_idx on public.deals (ended, posted_at desc);

-- ── 2. 관리자 명단 ────────────────────────────────────────
--  로그인한 사람 전부가 아니라, 이 표에 있는 사람만 딜을 건드릴 수 있습니다.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note    text,
  added_at timestamptz not null default now()
);

-- auth.uid() 가 관리자인지 판정합니다.
-- security definer 라서 admins 테이블의 RLS를 우회합니다 — 이게 없으면
-- "정책을 확인하려고 정책이 걸린 표를 읽는" 무한 재귀에 빠집니다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;

-- ── 3. RLS 정책 ───────────────────────────────────────────
alter table public.deals  enable row level security;
alter table public.admins enable row level security;

-- 딜 목록은 누구나 읽습니다 (로그인 안 한 방문자 포함).
drop policy if exists "deals: 누구나 읽기" on public.deals;
create policy "deals: 누구나 읽기"
  on public.deals for select
  to anon, authenticated
  using (true);

-- 쓰기는 관리자만. insert 는 with check, update/delete 는 using 으로 겁니다.
drop policy if exists "deals: 관리자만 추가" on public.deals;
create policy "deals: 관리자만 추가"
  on public.deals for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "deals: 관리자만 수정" on public.deals;
create policy "deals: 관리자만 수정"
  on public.deals for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "deals: 관리자만 삭제" on public.deals;
create policy "deals: 관리자만 삭제"
  on public.deals for delete
  to authenticated
  using (public.is_admin());

-- 관리자 명단은 본인 줄만 보입니다. 추가·삭제는 클라이언트로 열지 않고
-- Supabase 대시보드에서만 합니다 (아래 5번).
drop policy if exists "admins: 본인 줄만 읽기" on public.admins;
create policy "admins: 본인 줄만 읽기"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- ── 4. 클릭 카운터 ────────────────────────────────────────
--  방문자가 링크를 누르면 /go/<id> 를 거쳐 갑니다. 그때 이 함수로 1 올립니다.
--  update 권한이 없는 anon 도 부를 수 있어야 하므로 security definer 입니다.
--  올릴 수 있는 값이 clicks 하나뿐이라, 남용해도 카운터가 부풀 뿐입니다.
create or replace function public.register_click(deal_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.deals set clicks = clicks + 1 where id = deal_id
$$;

revoke execute on function public.register_click(uuid) from public;
grant  execute on function public.register_click(uuid) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
--  5. 여기까지 Run 한 뒤, 나를 관리자로 등록하는 두 단계
--
--  (1) Authentication → Users → Add user 로 내 이메일/비밀번호 계정을 만듭니다
--      ("Auto Confirm User"를 켜야 메일 확인 없이 바로 로그인됩니다).
--  (2) 아래 줄의 이메일을 내 것으로 바꾸고 이 줄만 다시 Run 합니다.
--
--     insert into public.admins (user_id, note)
--     select id, '나' from auth.users where email = '내메일@example.com'
--     on conflict (user_id) do nothing;
--
--  회원가입 페이지를 따로 만들지 않은 것은 의도입니다. 관리자가 나 하나뿐인
--  사이트에서 가입 폼은 공격 표면만 늘립니다.
-- ═══════════════════════════════════════════════════════════
