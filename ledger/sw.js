/* 다니랑 생활비 — 서비스 워커
   네트워크 우선: 온라인이면 늘 새 파일을 받고(받은 것은 캐시에 덮어 둔다),
   오프라인일 때만 캐시로 앱 화면을 띄운다. 기록 자체는 Firebase에 있고 여기엔 담지 않는다.

   VERSION은 build-zip.mjs가 index.html·manifest 내용으로 찍는다 — 손으로 고치지 않는다.
   이 파일이 바뀌어야 열려 있는 앱이 "새 버전이 있어요"를 띄울 수 있다. */
const VERSION = "a6ffc2d4eb";
const CACHE = "ledger-" + VERSION;
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", event => {
  // 새 버전은 설치만 해 두고 기다린다 — 쓰는 중인 화면을 갑자기 바꾸지 않고, 사용자가 [새로고침]을 누르면 넘어간다
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("ledger-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

/* 바깥 파일 중 오프라인에서도 앱이 뜨는 데 필요한 것만 담는다: Firebase SDK·글꼴·OCR 스크립트.
   Firebase 연결(실시간 DB·로그인)과 OCR 언어 데이터(수 MB)는 손대지 않는다. */
const CDN = [
  /^https:\/\/www\.gstatic\.com\/firebasejs\//,
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@[^/]+\/dist\/tesseract\.min\.js$/,
];

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (!sameOrigin && !CDN.some(re => re.test(req.url))) return;
  event.respondWith(networkFirst(req, sameOrigin && req.mode === "navigate"));
});

async function networkFirst(req, isPage){
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(isPage ? "./index.html" : req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(isPage ? "./index.html" : req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}
