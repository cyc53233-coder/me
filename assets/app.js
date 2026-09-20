/* 핫딜 사이트 공용 스크립트 — data/site.js, data/deals.js 를 읽어 화면을 그립니다. */

const SITE = window.SITE || {};
const GRADES = Array.isArray(SITE.grades) ? SITE.grades : [];
const MAX_DEALS = Number(SITE.maxDeals) > 0 ? Number(SITE.maxDeals) : 50;
const MALLS = {
  toss: { label: "토스", emoji: "💎" },
  coupang: { label: "쿠팡", emoji: "🚀" },
  naver: { label: "네이버", emoji: "🟢" },
  "11st": { label: "11번가", emoji: "🔴" },
  gmarket: { label: "지마켓", emoji: "🟡" },
};

/* ── 유틸 ─────────────────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";

const discountRate = (d) =>
  d.listPrice && d.price && d.listPrice > d.price
    ? Math.round((1 - d.price / d.listPrice) * 100)
    : 0;

function mallOf(deal) {
  if (deal.mall) return deal.mall;
  const u = String(deal.url || "");
  if (u.includes("toss.im")) return "toss";
  if (u.includes("coupang")) return "coupang";
  if (u.includes("naver")) return "naver";
  return "";
}

const mallLabel = (key) => (MALLS[key] ? MALLS[key].label : key || "");
const mallEmoji = (key) => (MALLS[key] ? MALLS[key].emoji : "💎");

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

/* ── 등급 — 🔥 개수가 곧 등급입니다 (data/site.js 의 grades) ── */
const fires = (n) => "🔥".repeat(Math.max(0, Math.min(5, Number(n) || 0)));

const TOP_FIRE = GRADES.length ? Math.max(...GRADES.map((g) => g.fire)) : 0;

/* 등급표를 줄이기 전에 올린 딜(예전 5단계, 옛 hot: true)도 배지가 사라지지 않게
   지금 등급표의 맨 위로 올려 붙입니다. */
function gradeOf(deal) {
  let n = Number(deal.grade) || (deal.hot ? TOP_FIRE : 0);
  if (n > TOP_FIRE) n = TOP_FIRE;
  return GRADES.find((g) => g.fire === n) || null;
}

const gradeText = (g) => (g ? `${g.label} ${fires(g.fire)}` : "");

/* 카톡방에 그대로 붙여넣는 문구 */
function kakaoText(deal) {
  const g = gradeOf(deal);
  const mall = mallOf(deal);
  const rate = discountRate(deal);
  const lines = [];
  if (g) lines.push(`${fires(g.fire)} ${g.label}`);
  lines.push(`${mallEmoji(mall)} ${mall ? `[${mallLabel(mall)}] ` : ""}${deal.title}`);
  lines.push(
    `💰 ${won(deal.price)}` +
      (deal.listPrice ? ` (평소 ${won(deal.listPrice)}${rate ? `, ${rate}%↓` : ""})` : "")
  );
  if (deal.note) lines.push(`📝 ${deal.note}`);
  lines.push(`👉 ${deal.url}`);
  const notes = (SITE.shareNotes || []).map((n) => `- ${n}`);
  if (notes.length || SITE.shareDisclosure) lines.push("");
  lines.push(...notes);
  if (SITE.shareDisclosure) lines.push(SITE.shareDisclosure);
  return lines.join("\n");
}

/* 클립보드 — https 가 아니어도 동작하도록 폴백을 둡니다 (딜 올리기 페이지에서 씁니다) */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* 폴백으로 내려갑니다 */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  ta.remove();
  return ok;
}

let toastTimer;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), 1800);
}

/* ── 카드 — 카드 전체가 상품 링크입니다 ───────────────────── */
function dealCardHTML(deal) {
  const g = gradeOf(deal);
  const thumb = deal.image
    ? `<img class="thumb" src="${esc(deal.image)}" alt="" loading="lazy">`
    : `<div class="thumb thumb-empty">${mallEmoji(mallOf(deal))}</div>`;
  const inner = `
      ${thumb}
      <div class="deal-body">
        <div class="deal-time">${esc(timeAgo(deal.postedAt))}${deal.sample ? " · 샘플" : ""}</div>
        <h2 class="deal-title">${esc(deal.title)}</h2>
        <div class="deal-price">
          ${g ? `<span class="grade">${esc(g.label)}${fires(g.fire)}</span>` : ""}
          <span class="price-now">${won(deal.price)}</span>
        </div>
        ${deal.listPrice ? `<div class="price-was">평소가 ${won(deal.listPrice)}</div>` : ""}
      </div>
      <span class="chevron" aria-hidden="true">›</span>`;
  return deal.sample
    ? `<div class="deal is-sample">${inner}</div>`
    : `<a class="deal" href="${esc(deal.url)}" target="_blank" rel="nofollow sponsored noopener">${inner}</a>`;
}

/* 이미지가 깨지면 기본 아이콘 칸으로 바꿉니다 (error 는 캡처 단계에서만 잡힙니다) */
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || !img.classList.contains("thumb")) return;
    const div = document.createElement("div");
    div.className = "thumb thumb-empty";
    div.textContent = "🛍️";
    img.replaceWith(div);
  },
  true
);

/* ── 목록 화면 ────────────────────────────────────────────── */
function chipsHTML(items, key, pressed) {
  return items
    .map(
      (it) =>
        `<button type="button" class="chip" aria-pressed="${it.value === pressed}" data-${key}="${esc(it.value)}"` +
        (it.hint ? ` title="${esc(it.hint)}"` : "") +
        `><span>${esc(it.label)}</span>${it.sub ? `<span class="chip-sub">${esc(it.sub)}</span>` : ""}</button>`
    )
    .join("");
}

function bindChips(box, onPick) {
  box.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    box.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
    onPick(btn);
  });
}

function initDealList() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  // 마감된 딜은 파일에는 남지만 화면에는 안 나옵니다
  const all = (window.DEALS || []).filter((d) => !d.ended);
  const state = { cat: "전체", grade: 0 };

  const gradeBox = document.getElementById("grade-chips");
  gradeBox.innerHTML = chipsHTML(
    [
      { value: "0", label: "전체" },
      ...GRADES.map((g) => ({ value: String(g.fire), label: g.label, sub: fires(g.fire), hint: g.hint })),
    ],
    "grade",
    "0"
  );
  if (!GRADES.length) gradeBox.hidden = true;

  // 설정해 둔 카테고리는 딜이 없어도 늘 보이고, 목록에만 있는 카테고리는 뒤에 붙입니다
  const catBox = document.getElementById("chips");
  const configured = Array.isArray(SITE.categories) ? SITE.categories : [];
  const extra = [...new Set(all.map((d) => d.category).filter(Boolean))].filter(
    (c) => !configured.includes(c)
  );
  const cats = ["전체", ...configured, ...extra];
  catBox.innerHTML = chipsHTML(cats.map((c) => ({ value: c, label: c })), "cat", "전체");
  if (cats.length < 2) catBox.hidden = true;

  function visible() {
    return all
      .filter((d) => !state.grade || (gradeOf(d) || {}).fire === state.grade)
      .filter((d) => state.cat === "전체" || d.category === state.cat)
      .sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0))
      .slice(0, MAX_DEALS);
  }

  function render() {
    const list = visible();
    grid.innerHTML = list.length
      ? list.map(dealCardHTML).join("")
      : `<div class="empty"><div class="empty-emoji">🕳️</div>${
          all.length ? "이 조건에 맞는 딜이 없어요" : "아직 올라온 딜이 없어요"
        }</div>`;
    document.getElementById("caption").textContent = `최신 등록순 · 최대 ${MAX_DEALS}개`;
  }

  bindChips(gradeBox, (btn) => {
    state.grade = Number(btn.dataset.grade) || 0;
    render();
  });
  bindChips(catBox, (btn) => {
    state.cat = btn.dataset.cat;
    render();
  });

  render();
}

/* ── 오픈채팅 입장 버튼 (화면 아래 고정) ─────────────────────── */
function initOpenChat() {
  const bar = document.getElementById("cta");
  if (!bar) return;
  if (!SITE.openChatUrl) return bar.remove();
  const a = bar.querySelector("a");
  a.href = SITE.openChatUrl;
  a.textContent = SITE.openChatLabel || "오픈채팅방 입장하기";
  document.body.classList.add("has-cta");
}

/* ── 카톡 안에서 열렸을 때 안내 ──────────────────────────────
   카톡 인앱 브라우저는 다른 앱(토스·쿠팡) 열기와 복사가 막힐 때가 있습니다.
   kakaotalk://web/openExternal 은 카톡이 지원하는 "외부 브라우저로 열기" 주소입니다. */
function initKakaoNotice() {
  const box = document.getElementById("kakao-notice");
  if (!box) return;
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (!/KAKAOTALK/i.test(ua)) return;
  box.hidden = false;
  const btn = box.querySelector("button");
  if (btn) {
    btn.addEventListener("click", () => {
      location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
    });
  }
}

/* ── 헤더 ☰ 메뉴 ──────────────────────────────────────────
   「딜 올리기」는 여기에 넣지 않습니다 — 관리자 전용 도구입니다. */
function initMenu() {
  const btn = document.getElementById("menu-btn");
  const menu = document.getElementById("menu");
  if (!btn || !menu) return;
  const set = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    set(menu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target)) set(false);
  });
  menu.addEventListener("click", () => set(false));
}

/* ── 공통 채우기 ──────────────────────────────────────────── */
function initChrome() {
  document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = SITE.name || ""));
  document.querySelectorAll("[data-site-emoji]").forEach((el) => (el.textContent = SITE.emoji || ""));
  document.querySelectorAll("[data-site-tagline]").forEach((el) => (el.textContent = SITE.tagline || ""));
  document
    .querySelectorAll("[data-site-disclosure]")
    .forEach((el) => (el.textContent = SITE.disclosure || ""));
  document
    .querySelectorAll("[data-site-share-disclosure]")
    .forEach((el) => (el.textContent = SITE.shareDisclosure || SITE.disclosure || ""));
  document.querySelectorAll("[data-site-notes]").forEach((el) => {
    el.innerHTML = (SITE.shareNotes || []).map((n) => `<li>${esc(n)}</li>`).join("");
  });
  if (SITE.name) document.title = document.title.replace("{site}", SITE.name);
  document.querySelectorAll("[data-issue-link]").forEach((el) => {
    if (!SITE.repo) return el.remove();
    el.href = `https://github.com/${SITE.repo}/issues/new?template=${el.dataset.issueLink}`;
  });
}

/* ── 채널 소개 화면 ───────────────────────────────────────── */
function initAbout() {
  const intro = document.querySelector("[data-site-intro]");
  if (intro && Array.isArray(SITE.intro)) {
    intro.innerHTML = SITE.intro.map((p) => `<p>${esc(p)}</p>`).join("");
  }
  const grades = document.querySelector("[data-site-grades]");
  if (grades) {
    grades.innerHTML = GRADES.map(
      (g) =>
        `<li><span class="grade">${esc(g.label)}${fires(g.fire)}</span>` +
        (g.hint ? ` <span class="grade-hint">${esc(g.hint)}</span>` : "") +
        `</li>`
    ).join("");
  }
  const chat = document.querySelector("[data-site-openchat]");
  if (chat) {
    chat.innerHTML = SITE.openChatUrl
      ? `<a class="btn btn-cta" href="${esc(SITE.openChatUrl)}" target="_blank" rel="noopener">${esc(
          SITE.openChatLabel || "오픈채팅방 입장하기"
        )}</a>`
      : `<p>오픈채팅방을 준비하고 있습니다. 열리면 이 자리에 입장 링크가 걸립니다.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initMenu();
  initKakaoNotice();
  initDealList();
  initOpenChat();
  initAbout();
});
