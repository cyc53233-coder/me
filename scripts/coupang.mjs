/**
 * 쿠팡 파트너스 Open API 클라이언트.
 * 서명 규격: message = signed-date + METHOD + path + query(물음표 제외),
 * HMAC-SHA256(secretKey) 를 hex 로, Authorization 헤더는
 * "CEA algorithm=HmacSHA256, access-key=…, signed-date=…, signature=…".
 */
import crypto from "node:crypto";

const HOST = "https://api-gateway.coupang.com";
const BASE = "/v2/providers/affiliate_open_api/apis/openapi";

export const hasKeys = () =>
  Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY);

function signedDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    String(now.getUTCFullYear()).slice(2) +
    p(now.getUTCMonth() + 1) +
    p(now.getUTCDate()) +
    "T" +
    p(now.getUTCHours()) +
    p(now.getUTCMinutes()) +
    p(now.getUTCSeconds()) +
    "Z"
  );
}

/** 테스트할 수 있도록 시각과 키를 인자로 받습니다. */
export function authorization(method, pathWithQuery, accessKey, secretKey, now) {
  const [path, query = ""] = pathWithQuery.split("?");
  const date = signedDate(now);
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(date + method + path + query)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`;
}

async function call(method, pathWithQuery, body) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!accessKey || !secretKey) throw new Error("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다.");

  const res = await fetch(HOST + pathWithQuery, {
    method,
    headers: {
      Authorization: authorization(method, pathWithQuery, accessKey, secretKey),
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`쿠팡 응답을 읽지 못했습니다 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok || (json.rCode && json.rCode !== "0")) {
    throw new Error(`쿠팡 API 오류 (HTTP ${res.status}, rCode ${json.rCode}): ${json.rMessage || text.slice(0, 300)}`);
  }
  return json.data ?? json;
}

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

/** 골드박스(오늘의 특가) 목록 */
export function goldbox({ subId, imageSize } = {}) {
  const query = qs({ subId, imageSize });
  return call("GET", `${BASE}/products/goldbox${query ? `?${query}` : ""}`);
}

/** 키워드 검색 */
export function search(keyword, { limit = 20, subId, imageSize } = {}) {
  return call("GET", `${BASE}/products/search?${qs({ keyword, limit, subId, imageSize })}`);
}

/** 쿠팡 상품 주소를 내 제휴 링크로 바꿉니다. */
export function deeplink(coupangUrls, subId) {
  return call("POST", `${BASE}/v1/deeplink`, { coupangUrls, subId: subId || "" });
}
