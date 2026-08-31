/**
 * 커뮤니티 핫딜판을 훑어 "오늘 볼 만한 후보"를 GitHub 이슈 하나로 보내 줍니다.
 * 링크를 대신 만들어 주지는 못합니다 — 토스 쉐어링크는 앱에서만 만들 수 있습니다.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./deals-file.mjs";
import { loadConfig } from "./config.mjs";
import { unescapeHtml } from "./meta.mjs";

const cfg = loadConfig().scout;
const SEEN_PATH = path.join(ROOT, "data", "seen.json");
const ISSUE_PATH = path.join(ROOT, ".scout-issue.md");
const lines = [];
const say = (l) => { lines.push(l); console.log(l); };

function finish(changed) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `changed=${changed ? "true" : "false"}\n`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || "/dev/null", lines.join("\n") + "\n");
}

if (!cfg.enabled) {
  say("automation.json 에서 scout.enabled 가 꺼져 있습니다.");
  finish(false);
  process.exit(0);
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return unescapeHtml(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim();
};

/** RSS 2.0 과 Atom 을 둘 다 읽습니다. */
function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => {
    let link = tag(b, "link");
    if (!link) {
      const href = b.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = href ? href[1] : "";
    }
    return { title: tag(b, "title"), link: link.trim(), date: tag(b, "pubDate") || tag(b, "updated") };
  });
}

async function readSource(src) {
  try {
    const res = await fetch(src.rss, {
      headers: {
        "user-agent": "hotdeal-site-scout/1.0 (+github actions; personal use)",
        accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { src, error: `HTTP ${res.status}`, items: [] };
    return { src, items: parseFeed(await res.text()) };
  } catch (e) {
    return { src, error: String(e.message || e), items: [] };
  }
}

let seen = [];
try {
  seen = JSON.parse(fs.readFileSync(SEEN_PATH, "utf8"));
} catch (e) {
  seen = [];
}
const seenSet = new Set(seen);
const bad = (cfg.excludeKeywords || []).filter(Boolean);

const results = await Promise.all((cfg.sources || []).map(readSource));
const fresh = [];
for (const r of results) {
  const ok = r.items.filter(
    (it) => it.title && it.link && !seenSet.has(it.link) && !bad.some((w) => it.title.includes(w))
  );
  say(
    r.error
      ? `- ❌ ${r.src.name}: ${r.error}`
      : `- ✅ ${r.src.name}: ${r.items.length}건 중 새 글 ${ok.length}건`
  );
  for (const it of ok.slice(0, cfg.maxPerRun)) fresh.push({ ...it, source: r.src.name });
}

if (!fresh.length) {
  say("\n새 후보가 없습니다.");
  finish(false);
  process.exit(0);
}

const picks = fresh.slice(0, cfg.maxPerRun);
const body = [
  "오늘의 딜 후보입니다. 괜찮은 게 있으면 **토스 앱에서 그 상품을 찾아 쉐어링크를 복사**한 뒤,",
  "[「딜 올리기」 이슈](../../issues/new?template=deal-add.yml)에 붙여넣으세요.",
  "",
  ...picks.map((p) => `- [ ] **[${p.source}]** [${p.title}](${p.link})`),
  "",
  "---",
  "",
  "이 목록은 커뮤니티 핫딜 게시판의 공개 RSS를 하루 한 번 읽어 만든 것입니다.",
  "가격·재고는 확인하지 않았으니, 올리기 전에 실제 가격을 꼭 보세요.",
  "이 이슈는 읽고 그냥 닫으시면 됩니다.",
].join("\n");

fs.writeFileSync(ISSUE_PATH, body + "\n", "utf8");
fs.writeFileSync(
  SEEN_PATH,
  JSON.stringify([...picks.map((p) => p.link), ...seen].slice(0, cfg.keepSeen), null, 0) + "\n",
  "utf8"
);
say(`\n후보 ${picks.length}건을 이슈로 보냅니다.`);
finish(true);
