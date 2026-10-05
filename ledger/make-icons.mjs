#!/usr/bin/env node
/**
 * 앱 아이콘 PNG를 그린다 — 노란 바탕에 바코드 영수증 (마트 컨셉).
 * 빌드 도구 없이 Chromium(Playwright)으로 SVG를 찍어 PNG로 저장한다. 디자인을 바꿀 때만 다시 돌린다.
 *
 *   node ledger/make-icons.mjs   → ledger/icons/*.png
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "icons");

/** 512 좌표계의 영수증. scale은 가운데를 기준으로 줄이는 비율. */
function svg(size, scale) {
  const x0 = 120, x1 = 392, top = 72, bottom = 424, tooth = 17, dip = 18;
  let edge = `M${x0 + 16} ${top} H${x1 - 16} A16 16 0 0 1 ${x1} ${top + 16} V${bottom}`;
  for (let x = x1, i = 1; x > x0; i++) { x -= tooth; edge += ` L${x} ${i % 2 ? bottom - dip : bottom}`; }
  edge += ` V${top + 16} A16 16 0 0 1 ${x0 + 16} ${top} Z`;
  const bars = [10, 5, 5, 14, 5, 10, 5, 5, 14, 10, 5, 14, 5, 5, 10];
  let bx = 158, barcode = "";
  bars.forEach((w, i) => { if (i % 2 === 0) barcode += `<rect x="${bx}" y="292" width="${w}" height="70" fill="#191919"/>`; bx += w + 4; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" fill="#FFD23F"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -248)">
    <path d="${edge}" fill="#FFFFFF" stroke="#191919" stroke-width="14" stroke-linejoin="round"/>
    <rect x="158" y="128" width="196" height="16" rx="8" fill="#191919"/>
    <rect x="158" y="170" width="120" height="16" rx="8" fill="#BDBDBD"/>
    <rect x="158" y="212" width="196" height="26" rx="8" fill="#191919"/>
    ${barcode}
  </g>
</svg>`;
}

const ICONS = [
  ["icon-192.png", 192, 0.92],           // 일반 아이콘 — 여백 조금
  ["icon-512.png", 512, 0.92],
  ["maskable-512.png", 512, 0.74],       // 안드로이드가 동그랗게 잘라도 안전 영역(지름 80%) 안에
  ["apple-touch-icon.png", 180, 0.86],   // iOS는 모서리만 둥글게 깎는다
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
for (const [name, size, scale] of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg(size, scale)}</body></html>`);
  await page.screenshot({ path: join(OUT, name), clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  console.log("아이콘: icons/" + name + " (" + size + "px)");
}
await browser.close();
