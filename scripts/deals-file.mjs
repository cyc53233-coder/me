/**
 * data/deals.js 를 읽고 쓰는 곳. 파일을 정규식으로 헤집지 않고,
 * 브라우저가 읽는 그대로 실행해서 배열을 얻은 뒤 통째로 다시 씁니다.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEALS_PATH = path.join(ROOT, "data", "deals.js");
const MARK = "window.DEALS = [";

/** 브라우저 파일(site.js / deals.js / app.js)을 Node 안에서 그대로 실행합니다. */
export function loadBrowserContext() {
  const ctx = {
    console,
    window: {},
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    navigator: {},
  };
  vm.createContext(ctx);
  for (const rel of ["data/site.js", "data/deals.js", "assets/app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx, { filename: rel });
  }
  return ctx;
}

export function readDeals() {
  return loadBrowserContext().window.DEALS || [];
}

/** 파일 맨 위 설명 주석은 그대로 두고 배열만 다시 씁니다. */
export function writeDeals(deals) {
  const src = fs.readFileSync(DEALS_PATH, "utf8");
  const at = src.indexOf(MARK);
  if (at === -1) throw new Error(`data/deals.js 에서 "${MARK}" 를 찾지 못했습니다.`);
  const header = src.slice(0, at);
  fs.writeFileSync(DEALS_PATH, `${header}${MARK}\n${deals.map(serialize).join("\n")}\n];\n`, "utf8");
}

const KEY_ORDER = [
  "title", "url", "price", "listPrice", "mall", "image",
  "category", "note", "postedAt", "hot", "ended", "sample",
];

const js = (v) =>
  typeof v === "string"
    ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`
    : String(v);

function serialize(deal) {
  const lines = ["  {"];
  for (const key of KEY_ORDER) {
    const v = deal[key];
    if (v === undefined || v === null || v === "" || v === false) continue;
    lines.push(`    ${key}: ${js(v)},`);
  }
  lines.push("  },");
  return lines.join("\n");
}

/** 올린 시각을 한국 시간(+09:00)으로 찍습니다. GitHub 러너는 UTC 라서 직접 계산합니다. */
export function nowKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}+09:00`;
}
