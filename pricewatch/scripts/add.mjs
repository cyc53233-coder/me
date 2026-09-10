/**
 * 이슈 폼으로 들어온 상품을 감시 목록에 넣습니다.
 * 넣는 김에 한 번 읽어서 이름과 첫 가격을 채웁니다.
 */
import fs from "node:fs";
import path from "node:path";
import { readProduct } from "./meta.mjs";
import { ROOT, loadConfig, saveWatchList, loadHistory, saveHistory, won } from "./store.mjs";

const COMMENT_PATH = path.join(ROOT, "..", ".pricewatch-comment.md");
const comment = (md) => fs.writeFileSync(COMMENT_PATH, md.trimStart() + "\n", "utf8");

function fail(md) {
  comment(`❌ **추가하지 못했습니다.**\n\n${md}`);
  process.exit(1);
}

function parseForm(body) {
  const out = new Map();
  for (const part of String(body).replace(/\r\n/g, "\n").split(/^### +/m).slice(1)) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    let value = part.slice(nl + 1).trim();
    if (value === "_No response_") value = "";
    out.set(part.slice(0, nl).trim(), value);
  }
  return out;
}

const form = parseForm(process.env.ISSUE_BODY || "");
const url = (form.get("상품 주소") || "").trim();
if (!/^https:\/\/\S+$/i.test(url)) fail("상품 주소는 `https://` 로 시작하는 주소여야 합니다.");

const cfg = loadConfig();
if (cfg.watch.some((w) => w.url === url)) fail("이미 감시하고 있는 상품입니다.");

const read = await readProduct(url);
const name = (form.get("이름") || "").trim() || read.title || url;

const history = loadHistory();
const entry = (history[url] ??= { name, points: [] });
entry.name = name;
if (read.price) entry.points.push({ t: new Date().toISOString(), p: read.price });

saveWatchList([...cfg.watch, { name, url }]);
saveHistory(history);

comment(`
✅ **감시 목록에 넣었습니다** — ${name}

${read.price ? `지금 가격은 **${won(read.price)}** 입니다.` : "지금 가격은 못 읽었습니다. 몇 번 더 시도해 보고 계속 안 되면 알려 주세요."}

가격은 6시간마다 확인합니다. ${cfg.alert.minDays}일쯤 지켜보면 그때부터
"평소보다 ${cfg.alert.dropPercent}% 이상 싸졌는지"를 판단해서 이슈로 알려 드립니다.
`);
