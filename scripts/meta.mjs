/** 링크를 열어 상품 정보를 읽어 오는 곳. 여러 스크립트가 같이 씁니다. */

export const toNumber = (v) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;

export const unescapeHtml = (s) =>
  String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");

export function metaFrom(html, prop) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i"));
  if (!tag) return "";
  const content = tag[0].match(/content=["']([^"']*)["']/i);
  return content ? unescapeHtml(content[1]).trim() : "";
}

/** JSON-LD 안의 price / availability 도 찾아봅니다. */
function fromJsonLd(html) {
  const out = {};
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const seen = [JSON.parse(m[1].trim())];
      while (seen.length) {
        const node = seen.pop();
        if (Array.isArray(node)) { seen.push(...node); continue; }
        if (!node || typeof node !== "object") continue;
        if (node.offers) seen.push(node.offers);
        if (node["@graph"]) seen.push(node["@graph"]);
        if (!out.price && (node.price || node.lowPrice)) out.price = toNumber(node.price || node.lowPrice);
        if (!out.availability && node.availability) out.availability = String(node.availability);
        if (!out.title && node.name && typeof node.name === "string") out.title = node.name;
      }
    } catch (e) {
      /* 깨진 JSON-LD 는 무시합니다 */
    }
  }
  return out;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/**
 * 링크를 열어 { title, image, price, availability, finalUrl } 을 돌려줍니다.
 * 실패는 던지지 않고 { error } 로 알려 줍니다 — 실패했다고 딜을 함부로 건드리면 안 됩니다.
 */
export async function fetchMeta(url, { timeout = 15000 } = {}) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return { error: `링크 응답이 ${res.status} 입니다`, status: res.status };
    const html = (await res.text()).slice(0, 400000);
    const ld = fromJsonLd(html);
    return {
      finalUrl: res.url,
      title: metaFrom(html, "og:title") || metaFrom(html, "twitter:title") || ld.title || "",
      image: metaFrom(html, "og:image") || metaFrom(html, "twitter:image") || "",
      price: toNumber(metaFrom(html, "product:price:amount")) || ld.price || 0,
      availability: metaFrom(html, "product:availability") || ld.availability || "",
      soldOut: /품절|일시\s*품절|SoldOut|OutOfStock/i.test(
        metaFrom(html, "product:availability") + " " + (ld.availability || "")
      ),
    };
  } catch (e) {
    return {
      error: e.name === "TimeoutError" ? "링크를 여는 데 시간이 너무 걸렸습니다" : String(e.message || e),
    };
  }
}
