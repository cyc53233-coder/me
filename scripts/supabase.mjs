/**
 * Supabase(PostgREST)에 딜을 읽고 씁니다. v2 사이트가 보는 그 표입니다.
 *
 * v2 앱은 anon 키만 쓰고 "누가 무엇을 할 수 있는지"는 RLS가 DB 안에서 막습니다.
 * 이 스크립트는 브라우저가 아니라 GitHub Actions 안에서만 도는 서버 쪽이라
 * service_role 키로 RLS를 건너뜁니다.
 *
 *   ⚠ SUPABASE_SERVICE_ROLE_KEY 는 저장소 Secrets 에만 둡니다.
 *     NEXT_PUBLIC_* 로 넣거나 앱 코드로 가져가면 그 순간 아무나 딜을
 *     지울 수 있게 됩니다.
 */

const baseUrl = () => (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const hasCreds = () => Boolean(baseUrl() && serviceKey());

async function call(path, { method = "GET", body, prefer } = {}) {
  if (!hasCreds()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
  }
  const key = serviceKey();
  const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${path} 실패 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const eq = (value) => `eq.${encodeURIComponent(value)}`;

/** 아직 안 끝난 딜을 최신순으로. 가격 감시가 훑는 목록입니다. */
export function listLiveDeals(limit = 40) {
  return call(`deals?select=id,title,url,price,list_price,mall,note,hot,ended&ended=eq.false&order=posted_at.desc&limit=${limit}`);
}

/** 중복 확인용 — 최근 딜의 제목과 주소만 가볍게 가져옵니다. */
export function listRecentKeys(limit = 200) {
  return call(`deals?select=id,title,url&order=posted_at.desc&limit=${limit}`);
}

export async function findDealByUrl(url) {
  const rows = await call(`deals?select=id,title,url,price,list_price,mall,note,hot,ended&url=${eq(url)}&limit=1`);
  return rows?.[0] || null;
}

/** 상품명 일부로 살아 있는 딜을 찾습니다. 마감 처리에 씁니다. */
export async function findLiveDealByText(text) {
  const pattern = `ilike.*${encodeURIComponent(text)}*`;
  const rows = await call(`deals?select=id,title,url,price,list_price,mall,note,hot,ended&title=${pattern}&ended=eq.false&order=posted_at.desc&limit=1`);
  return rows?.[0] || null;
}

export async function insertDeal(row) {
  const rows = await call("deals", { method: "POST", body: row, prefer: "return=representation" });
  return rows?.[0] || null;
}

export async function updateDeal(id, patch) {
  const rows = await call(`deals?id=${eq(id)}`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation",
  });
  return rows?.[0] || null;
}
