/**
 * idea-hub/data/tools.js 를 읽고 쓰는 곳. 파일을 정규식으로 헤집지 않고,
 * 브라우저가 읽는 그대로 실행해서 배열을 얻은 뒤 통째로 다시 씁니다.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const HUB_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TOOLS_PATH = path.join(HUB_ROOT, "data", "tools.js");
const MARK = "window.TOOLS = [";

/** 브라우저 파일(site.js / tools.js / app.js)을 Node 안에서 그대로 실행합니다. */
export function loadBrowserContext() {
  const ctx = {
    console,
    window: {},
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    navigator: {},
  };
  vm.createContext(ctx);
  for (const rel of ["data/site.js", "data/tools.js", "assets/app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(HUB_ROOT, rel), "utf8"), ctx, { filename: rel });
  }
  return ctx;
}

export function readTools() {
  return loadBrowserContext().window.TOOLS || [];
}

const KEY_ORDER = [
  "id", "title", "summary", "area", "type", "platforms", "url", "prompt", "howto",
  "author", "org", "license", "tags", "postedAt", "issue", "featured", "retired", "sample",
];

/* JSON 으로 쓰되, 스크립트 파일 안에서 문제될 수 있는 문자는 이스케이프합니다. */
const json = (v) =>
  JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function serialize(tool) {
  const lines = ["  {"];
  const keys = [...KEY_ORDER, ...Object.keys(tool).filter((k) => !KEY_ORDER.includes(k))];
  const body = [];
  for (const key of keys) {
    const v = tool[key];
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    body.push(`    ${json(key)}: ${json(v)}`);
  }
  lines.push(body.join(",\n"));
  lines.push("  }");
  return lines.join("\n");
}

/** 파일 맨 위 설명 주석은 그대로 두고 배열만 다시 씁니다. */
export function writeTools(tools) {
  const src = fs.readFileSync(TOOLS_PATH, "utf8");
  const at = src.indexOf(MARK);
  if (at === -1) throw new Error(`data/tools.js 에서 "${MARK}" 를 찾지 못했습니다.`);
  const header = src.slice(0, at);
  fs.writeFileSync(TOOLS_PATH, `${header}${MARK}\n${tools.map(serialize).join(",\n")}\n];\n`, "utf8");
}

/** 등록 시각을 한국 시간(+09:00)으로 찍습니다. GitHub 러너는 UTC 라서 직접 계산합니다. */
export function nowKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}+09:00`;
}
