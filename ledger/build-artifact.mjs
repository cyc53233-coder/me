#!/usr/bin/env node
/**
 * index.html(정식 HTML 문서) → claude.ai 아티팩트 발행용 변형.
 *
 * 아티팩트는 발행 도구가 문서 스켈레톤을 대신 씌우므로 그 태그들을 빼야 하고,
 * Firebase SDK는 아티팩트 CSP가 gstatic을 막아 어차피 로드되지 않으므로 뺀다
 * (빠지면 `typeof firebase === "undefined"` 가 되어 앱이 내장 공유 저장소로 붙는다).
 *
 *   node ledger/build-artifact.mjs            → ledger/artifact.html 생성
 *   node ledger/build-artifact.mjs --check    → 생성만 검증하고 쓰지 않음 (CI용)
 *   node ledger/build-artifact.mjs -o <path>  → 다른 경로로 출력
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "index.html");

/** 아티팩트 변형에서 빠져야 하는 줄 (공백 제거 후 정확히 일치). */
const DROP = [
  "<!doctype html>",
  '<html lang="ko">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "</head>",
  "<body>",
  "</body>",
  "</html>",
  "<!-- Firebase (외부 호스팅에서만 동작 — claude.ai 아티팩트에서는 내장 공유 저장소를 사용) -->",
  '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>',
  '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>',
  '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>',
];

export function buildArtifact(html) {
  const drop = new Set(DROP);
  const lines = html.split("\n");
  const kept = lines.filter((l) => !drop.has(l.trim()));
  const removed = lines.length - kept.length;
  if (removed !== drop.size) {
    throw new Error(
      `아티팩트 변형: ${drop.size}줄을 지워야 하는데 ${removed}줄만 지워졌습니다 — ` +
        "index.html의 문서 스켈레톤이나 Firebase 스크립트 줄이 바뀌었는지 확인하고, " +
        "바뀌었다면 build-artifact.mjs의 DROP 목록을 맞춰 주세요.",
    );
  }
  if (/<script[^>]+gstatic\.com/.test(kept.join("\n"))) {
    throw new Error("아티팩트 변형에 외부 스크립트가 남아 있습니다 (아티팩트 CSP에서 차단됨).");
  }
  return kept.join("\n").replace(/^\n+/, "");
}

const args = process.argv.slice(2);
const out = args.includes("-o") ? args[args.indexOf("-o") + 1] : join(HERE, "artifact.html");
const built = buildArtifact(readFileSync(SRC, "utf-8"));

if (args.includes("--check")) {
  console.log(`아티팩트 변형 OK (${built.split("\n").length}줄)`);
} else {
  writeFileSync(out, built);
  console.log(`생성: ${out} (${built.split("\n").length}줄)`);
}
