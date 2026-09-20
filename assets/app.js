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

/* 카테고리 설정은 {name, icon} 이지만, 예전처럼 문자열만 써 둔 설정도 그대로 받습니다 */
const catOf = (c) =>
  typeof c === "string" ? { name: c, icon: "" } : { name: c.name || "", icon: c.icon || "" };

/* 카톡방에 그대로 붙여넣는 문구.
   고지 → 상품 → 안내 순서입니다. 고지를 맨 위에 두는 것은 공정위 표시가
   스크롤 없이 먼저 보여야 하기 때문이고, 카톡은 긴 글을 접어 버립니다. */
function kakaoText(deal) {
  const g = gradeOf(deal);
  const rate = discountRate(deal);
  const lines = [];
  const intro = SITE.shareIntro || SITE.disclosure;
  if (intro) lines.push(intro, "");
  lines.push(`✅ ${deal.title}`);
  lines.push(` ┗ ${g ? `${g.label} ${fires(g.fire)} ` : ""}${won(deal.price)}`);
  if (deal.listPrice) {
    lines.push(` ┗ 평소가 ${won(deal.listPrice)}${rate ? ` (${rate}%↓)` : ""}`);
  }
  if (deal.note) lines.push(` ┗ ${deal.note}`);
  lines.push(deal.url);
  const notes = (SITE.shareNotes || []).map((n) => `- ${n}`);
  if (notes.length) lines.push("", ...notes);
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

/* ── 카드 ──────────────────────────────────────────────────
   카드 전체가 여전히 상품 링크입니다. 다만 공유 버튼을 함께 놓아야 해서
   <a> 로 카드를 통째로 감싸는 대신, 카드를 꽉 덮는 <a> 를 맨 뒤에 깔고
   공유 버튼만 그 위로 띄웁니다. <a> 안에 <button> 을 넣을 수는 없습니다. */
function dealCardHTML(deal, i) {
  // i 가 없으면(관리자 미리보기) 공유 버튼을 달지 않습니다 —
  // 목록 밖에서는 누를 대상을 찾지 못해 아무 일도 안 일어납니다.
  const shareable = Number.isInteger(i);
  const g = gradeOf(deal);
  const rate = discountRate(deal);
  const thumb = deal.image
    ? `<img class="thumb" src="${esc(deal.image)}" alt="" loading="lazy">`
    : `<div class="thumb thumb-empty">${mallEmoji(mallOf(deal))}</div>`;
  const body = `
      ${thumb}
      <div class="deal-body">
        <div class="deal-time">${
          deal.ended ? `<span class="tag-ended">마감</span> ` : ""
        }${esc(timeAgo(deal.postedAt))}${deal.sample ? " · 샘플" : ""}</div>
        <h2 class="deal-title">${esc(deal.title)}</h2>
        <div class="deal-price">
          ${g ? `<span class="grade">${esc(g.label)}${fires(g.fire)}</span>` : ""}
          <span class="price-now">${won(deal.price)}</span>
        </div>
        ${
          deal.listPrice
            ? `<div class="price-was">평소가 ${won(deal.listPrice)}${
                rate ? `<span class="rate">${rate}%↓</span>` : ""
              }</div>`
            : ""
        }
        ${deal.note ? `<div class="deal-note">${esc(deal.note)}</div>` : ""}
      </div>`;
  if (deal.sample) return `<div class="deal is-sample">${body}</div>`;
  const cls = "deal" + (deal.ended ? " is-ended" : "");
  // 마감된 딜에는 공유 버튼을 달지 않습니다 — 죽은 딜을 카톡방에 뿌리면
  // "평소보다 확실히 싼 것만 올린다" 는 약속이 그 자리에서 깨집니다.
  return (
    `<div class="${cls}">${body}` +
    (deal.ended || !shareable
      ? ""
      : `<button type="button" class="share" data-share="${i}" aria-label="공유하기">` +
        `<span aria-hidden="true">↗</span><span class="share-text">공유</span></button>`) +
    `<a class="deal-link" href="${esc(deal.url)}" target="_blank" rel="nofollow sponsored noopener"` +
    ` aria-label="${esc(deal.title)} 보러 가기"></a></div>`
  );
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

/* 정렬 — 기본은 최신순입니다.
   "가격 낮은순" 은 배송비가 따로 붙는 미끼상품을 맨 위로 올려 줄 수 있어서,
   카드에 한 줄 메모(배송비 조건이 적혀 있습니다)가 함께 보이는 것을 전제로 둡니다. */
const SORTS = [
  { value: "new", label: "최신순", cmp: (a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0) },
  { value: "grade", label: "등급순", cmp: (a, b) => ((gradeOf(b) || {}).fire || 0) - ((gradeOf(a) || {}).fire || 0) },
  { value: "rate", label: "할인율순", cmp: (a, b) => discountRate(b) - discountRate(a) },
  { value: "cheap", label: "가격 낮은순", cmp: (a, b) => (a.price || 0) - (b.price || 0) },
];
/* 어떤 정렬을 골라도 마감된 딜은 맨 아래로 내립니다. 잠깐 남겨 두는 이유는
   "놓쳤구나" 를 보여 주려는 것이지, 죽은 딜을 첫 카드로 내밀려는 게 아닙니다. */
const sortBy = (key) => {
  const cmp = (SORTS.find((s) => s.value === key) || SORTS[0]).cmp;
  return (a, b) => (a.ended ? 1 : 0) - (b.ended ? 1 : 0) || cmp(a, b);
};

/* 마감된 딜도 잠깐은 남깁니다 — 놓친 딜이 보여야 알림방에 들어올 이유가 생깁니다.
   언제 마감됐는지 모르는 예전 딜(endedAt 이 없는 것)은 그대로 숨깁니다. */
function stillShown(d) {
  if (!d.ended) return true;
  const hours = Number(SITE.endedHours);
  if (!(hours > 0) || !d.endedAt) return false;
  const t = new Date(d.endedAt).getTime();
  return !Number.isNaN(t) && Date.now() - t < hours * 3600e3;
}

/* 마지막 방문 시각 — 사생활 보호 모드에서는 저장이 막히므로 전부 감쌉니다 */
const VISIT_KEY = "hotdeal:lastVisit";
function readLastVisit() {
  try {
    const v = Number(localStorage.getItem(VISIT_KEY));
    return v > 0 ? v : 0;
  } catch (e) {
    return 0;
  }
}
function writeLastVisit() {
  try {
    localStorage.setItem(VISIT_KEY, String(Date.now()));
  } catch (e) {
    /* 저장이 막혀도 화면은 그대로 동작합니다 */
  }
}

function initDealList() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const all = (window.DEALS || []).filter(stillShown);
  const state = { cat: "전체", grade: 0, sort: "new" };

  // "지난 방문 이후 새 딜 N개" — 처음 온 사람에게는 띄우지 않습니다
  const since = readLastVisit();
  const badge = document.getElementById("new-badge");
  if (badge) {
    const fresh = since
      ? all.filter((d) => !d.ended && new Date(d.postedAt || 0).getTime() > since).length
      : 0;
    if (fresh > 0) {
      badge.textContent = `지난 방문 이후 새 딜 ${fresh}개`;
      badge.hidden = false;
    }
  }
  writeLastVisit();

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
  const configured = (Array.isArray(SITE.categories) ? SITE.categories : []).map(catOf);
  const names = configured.map((c) => c.name);
  const extra = [...new Set(all.map((d) => d.category).filter(Boolean))]
    .filter((c) => !names.includes(c))
    .map((c) => ({ name: c, icon: "" }));
  const cats = [{ name: "전체", icon: "" }, ...configured, ...extra];
  // 아이콘을 이름 옆이 아니라 위에 얹습니다 — 옆에 두면 칩 5개가 폰 폭을 넘어
  // 뒤쪽 카테고리가 화면 밖으로 밀려납니다.
  catBox.innerHTML = chipsHTML(
    cats.map((c) => (c.icon ? { value: c.name, label: c.icon, sub: c.name } : { value: c.name, label: c.name })),
    "cat",
    "전체"
  );
  if (cats.length < 2) catBox.hidden = true;

  // 정렬은 목록 아래 안내문 자리를 그대로 씁니다 — 칩을 한 줄 더 늘리면
  // 폰에서 상품이 화면 밖으로 밀려납니다.
  const sortSel = document.getElementById("sort");
  if (sortSel) {
    sortSel.innerHTML = SORTS.map(
      (s) => `<option value="${esc(s.value)}">${esc(s.label)}</option>`
    ).join("");
    sortSel.value = state.sort;
    sortSel.addEventListener("change", () => {
      state.sort = sortSel.value;
      render();
    });
  }

  let shown = [];

  function visible() {
    return all
      .filter((d) => !state.grade || (gradeOf(d) || {}).fire === state.grade)
      .filter((d) => state.cat === "전체" || d.category === state.cat)
      .slice()
      .sort(sortBy(state.sort))
      .slice(0, MAX_DEALS);
  }

  function render() {
    shown = visible();
    grid.innerHTML = shown.length
      ? shown.map((d, i) => dealCardHTML(d, i)).join("")
      : `<div class="empty"><div class="empty-emoji">🕳️</div>${
          all.length ? "이 조건에 맞는 딜이 없어요" : "아직 올라온 딜이 없어요"
        }</div>`;
    const cap = document.getElementById("count");
    if (cap) cap.textContent = `${shown.length}개`;
  }

  /* 공유 — 폰은 기본 공유창이 뜨고, 안 되면 문구를 클립보드에 넣습니다.
     어느 쪽이든 수수료 고지가 들어간 kakaoText 를 그대로 보냅니다. */
  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".share");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const deal = shown[Number(btn.dataset.share)];
    if (!deal) return;
    const text = kakaoText(deal);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // 사용자가 공유창을 닫은 것
    }
    toast((await copyText(text)) ? "문구를 복사했어요" : "복사하지 못했어요");
  });

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
  // 카톡·인스타는 og:image 가 절대주소여야 미리보기를 그립니다.
  const og = document.querySelector('meta[property="og:image"]');
  if (og && SITE.ogImage) og.setAttribute("content", new URL(SITE.ogImage, location.href).href);
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute("content", location.href.split("#")[0]);
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
