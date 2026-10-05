#!/usr/bin/env node
/**
 * Netlify Drop에 끌어다 놓을 배포용 zip을 만든다 — 앱에 필요한 파일만 (테스트·스크립트·문서 제외).
 * 만들기 전에 sw.js의 VERSION을 앱 파일 내용으로 다시 찍는다: 앱이 바뀌면 sw.js도 바뀌어야
 * 이미 설치된 앱이 "새 버전이 있어요"를 띄울 수 있다.
 *
 *   node ledger/build-zip.mjs           → sw.js 버전 갱신 + ledger/dist/ledger-pwa.zip
 *   node ledger/build-zip.mjs --check   → sw.js 버전이 최신인지만 확인 (테스트·CI용, 아무것도 안 씀)
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 배포물 — 이 목록이 유일한 기준이다. 새 파일을 앱이 쓰면 여기에도 넣는다. */
export const FILES = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

/** sw.js를 뺀 앱 파일 내용의 지문 — sw.js의 VERSION이 이 값이어야 한다. */
export function appVersion() {
  const h = createHash("sha256");
  for (const f of FILES) if (f !== "sw.js") h.update(f).update(readFileSync(join(HERE, f)));
  return h.digest("hex").slice(0, 10);
}
const VERSION_RE = /const VERSION = "([0-9a-f]*)";/;

/* ---- 의존성 없는 최소 zip 작성기 (deflate, UTF-8 이름, 날짜 고정 → 같은 입력이면 같은 zip) ---- */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(entries) {
  const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;   // 2026-01-01 00:00
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, packed);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const swPath = join(HERE, "sw.js");
  const sw = readFileSync(swPath, "utf-8");
  const want = appVersion();
  const have = (sw.match(VERSION_RE) || [])[1];
  if (process.argv.includes("--check")) {
    if (have !== want) {
      console.error(`sw.js VERSION이 앱 파일과 맞지 않아요 (${have} ≠ ${want}) — node ledger/build-zip.mjs 로 다시 찍어 주세요.`);
      process.exit(1);
    }
    console.log(`sw.js VERSION OK (${want})`);
  } else {
    if (have !== want) { writeFileSync(swPath, sw.replace(VERSION_RE, `const VERSION = "${want}";`)); console.log(`sw.js VERSION: ${have} → ${want}`); }
    const out = join(HERE, "dist", "ledger-pwa.zip");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, zip(FILES.map(name => ({ name, data: readFileSync(join(HERE, name)) }))));
    console.log(`생성: ${out} (${FILES.length}개 파일)`);
  }
}
