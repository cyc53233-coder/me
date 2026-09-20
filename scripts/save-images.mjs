/* 딜 사진을 저장소 안으로 내려받습니다.
 *
 * 쇼핑몰이 주는 사진 주소는 대개 임시 보관함(토스는 /live/temp/…)이라
 * 쇼핑몰이 지우면 사이트의 사진이 한꺼번에 깨집니다. 등록할 때 한 번 받아
 * assets/deals/ 에 두면 그 뒤로는 우리 것입니다.
 *
 * 이 환경(에이전트 컨테이너)에서는 쇼핑몰이 막혀 있어 받지 못합니다.
 * 그래서 GitHub Actions 러너에서 돌립니다 — 거기는 인터넷이 열려 있습니다.
 *
 *   node scripts/save-images.mjs          이미 받은 건 건너뛰고 남은 것만
 *   node scripts/save-images.mjs --dry    무엇을 받을지 보기만
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT, readDeals, writeDeals } from "./deals-file.mjs";

const DIR = path.join(ROOT, "assets", "deals");
const REL = "assets/deals";
const MAX_BYTES = 5 * 1024 * 1024; // 한 장이 이보다 크면 받지 않습니다
const EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const isRemote = (u) => /^https?:\/\//i.test(String(u || ""));

/* 파일 이름은 주소의 해시입니다 — 같은 사진을 두 번 받지 않고,
   상품명이 무엇이든 경로를 벗어나는 이름이 나올 수 없습니다. */
const nameFor = (url, ext) =>
  crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + ext;

async function fetchImage(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (compatible; hotdeal-site/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // 큰 파일은 다 받고 나서 버리면 아까우니 헤더로 먼저 거릅니다
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_BYTES) throw new Error(`${Math.round(declared / 1024)}KB 로 너무 큼`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = EXT[type] || (path.extname(new URL(url).pathname).match(/^\.(jpg|jpeg|png|webp|gif|avif)$/i) || [])[0];
  if (!ext) throw new Error(`사진이 아닌 응답: ${type || "형식 모름"}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("빈 응답");
  if (buf.length > MAX_BYTES) throw new Error(`${Math.round(buf.length / 1024)}KB 로 너무 큼`);
  return { buf, ext: ext.toLowerCase().replace(".jpeg", ".jpg") };
}

export async function saveImages({ dry = false } = {}) {
  const deals = readDeals();
  const todo = deals.filter((d) => isRemote(d.image));
  if (!todo.length) return { saved: 0, failed: 0, skipped: deals.length };

  fs.mkdirSync(DIR, { recursive: true });
  let saved = 0, failed = 0, reused = 0;

  for (const deal of todo) {
    const url = deal.image;
    const label = String(deal.title).slice(0, 30);
    if (dry) { console.log(`받을 것: ${label} ← ${url.slice(0, 70)}`); continue; }
    try {
      const { buf, ext } = await fetchImage(url);
      const name = nameFor(url, ext);
      const dest = path.join(DIR, name);
      if (fs.existsSync(dest)) reused++;
      else { fs.writeFileSync(dest, buf); saved++; }
      deal.image = `${REL}/${name}`;
      console.log(`받음 ${String(Math.round(buf.length / 1024)).padStart(5)}KB  ${name}  ${label}`);
    } catch (e) {
      failed++;
      // 못 받으면 원래 주소를 그대로 둡니다 — 깨진 사진이라도 없는 것보다 낫고,
      // 다음 실행에서 다시 시도합니다.
      console.log(`실패        ${label} — ${e.message}`);
    }
  }
  if (!dry && (saved || reused)) writeDeals(deals);
  return { saved, reused, failed, todo: todo.length };
}

const RUN_DIRECTLY =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;

if (RUN_DIRECTLY) {
  const r = await saveImages({ dry: process.argv.includes("--dry") });
  console.log(`\n받음 ${r.saved ?? 0} · 이미 있던 것 ${r.reused ?? 0} · 실패 ${r.failed ?? 0} (대상 ${r.todo ?? 0})`);
  // 몇 장 못 받아도 워크플로를 세우지는 않습니다 — 나머지는 다음에 다시 받습니다.
}
