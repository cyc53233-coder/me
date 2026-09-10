/** 상품 페이지를 열어 지금 가격을 읽어 옵니다. */

export const toNumber = (v) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;

const unescapeHtml = (s) =>
  String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");

function metaTag(html, prop) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i"));
  if (!tag) return "";
  const content = tag[0].match(/content=["']([^"']*)["']/i);
  return content ? unescapeHtml(content[1]).trim() : "";
}

/** 상품 페이지는 대개 JSON-LD 에 정가를 넣어 둡니다. OG 태그보다 정확할 때가 많습니다. */
function fromJsonLd(html) {
  const out = {};
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const stack = [JSON.parse(m[1].trim())];
      while (stack.length) {
        const node = stack.pop();
        if (Array.isArray(node)) { stack.push(...node); continue; }
        if (!node || typeof node !== "object") continue;
        if (node.offers) stack.push(node.offers);
        if (node["@graph"]) stack.push(node["@graph"]);
        if (!out.price && (node.price || node.lowPrice)) out.price = toNumber(node.price || node.lowPrice);
        if (!out.availability && node.availability) out.availability = String(node.availability);
        if (!out.title && typeof node.name === "string") out.title = node.name;
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
 * { title, price, soldOut } 를 돌려줍니다.
 * 실패는 던지지 않고 { error } 로 알려 줍니다 — 못 읽은 것과 값이 바뀐 것은 다릅니다.
 */
export async function readProduct(url, { timeout = 15000 } = {}) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return { error: `응답이 ${res.status} 입니다` };

    const html = (await res.text()).slice(0, 400000);
    const ld = fromJsonLd(html);
    const availability = metaTag(html, "product:availability") || ld.availability || "";

    return {
      title: metaTag(html, "og:title") || ld.title || "",
      price: toNumber(metaTag(html, "product:price:amount")) || ld.price || 0,
      soldOut: /품절|일시\s*품절|SoldOut|OutOfStock/i.test(availability),
    };
  } catch (e) {
    return {
      error: e.name === "TimeoutError" ? "여는 데 시간이 너무 걸렸습니다" : String(e.message || e),
    };
  }
}
