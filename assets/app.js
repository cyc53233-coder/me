/* 핫딜 사이트 공용 스크립트 — data/site.js, data/deals.js 를 읽어 화면을 그립니다. */

const SITE = window.SITE || {};
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

/* 카톡방에 그대로 붙여넣는 문구 */
function kakaoText(deal) {
  const mall = mallOf(deal);
  const lines = [];
  lines.push(`${mallEmoji(mall)} ${mall ? `[${mallLabel(mall)}] ` : ""}${deal.title}`);
  lines.push(` ┗ ${deal.hot ? "대박 🔥🔥🔥 " : ""}${won(deal.price)}`);
  const rate = discountRate(deal);
  if (deal.listPrice) lines.push(` ┗ 평소가 ${won(deal.listPrice)}${rate ? ` (${rate}% 싸요)` : ""}`);
  if (deal.note) lines.push(` ┗ ${deal.note}`);
  lines.push(deal.url);
  if (SITE.shareDisclosure) lines.push("", SITE.shareDisclosure);
  return lines.join("\n");
}

/* 클립보드 — https 가 아니어도 동작하도록 폴백을 둡니다 */
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

/* ── 카드 ─────────────────────────────────────────────────── */
function dealCardHTML(deal) {
  const rate = discountRate(deal);
  const mall = mallOf(deal);
  const badges = [
    rate ? `<span class="badge badge-off">${rate}%</span>` : "",
    deal.hot && !deal.ended ? `<span class="badge badge-hot">🔥 대박</span>` : "",
    mall ? `<span class="badge badge-mall">${esc(mallLabel(mall))}</span>` : "",
    deal.ended ? `<span class="badge badge-ended">마감</span>` : "",
    deal.sample ? `<span class="badge badge-sample">샘플</span>` : "",
  ].join("");

  const thumb = deal.image
    ? `<img src="${esc(deal.image)}" alt="" loading="lazy">`
    : `<div class="thumb-fallback">${mall ? mallEmoji(mall) : "🛍️"}</div>`;

  const buy = deal.sample
    ? `<button class="btn" disabled>샘플 딜</button>`
    : deal.ended
    ? `<button class="btn" disabled>마감된 딜</button>`
    : `<a class="btn" href="${esc(deal.url)}" target="_blank" rel="nofollow sponsored noopener">
         최저가 보러가기</a>`;

  return `
    <article class="deal ${deal.ended ? "is-ended" : ""} ${deal.sample ? "is-sample" : ""}">
      <div class="thumb ${deal.image ? "" : "is-empty"}">${thumb}<div class="badges">${badges}</div></div>
      <div class="deal-body">
        ${deal.category ? `<div class="deal-cat">${esc(deal.category)}</div>` : ""}
        <h2 class="deal-title">${esc(deal.title)}</h2>
        ${deal.note ? `<p class="deal-note">${esc(deal.note)}</p>` : ""}
        <div class="deal-price">
          <span class="price-now">${won(deal.price)}</span>
          ${deal.listPrice ? `<span class="price-was">${won(deal.listPrice)}</span>` : ""}
        </div>
        <div class="deal-meta">${esc(timeAgo(deal.postedAt))}</div>
      </div>
      <div class="deal-actions">
        ${buy}
        <button class="btn btn-ghost js-copy" title="카톡용 문구 복사" aria-label="카톡용 문구 복사">💬</button>
      </div>
    </article>`;
}

/* 이미지가 깨진 딜은 기본 아이콘으로 되돌립니다 (error 는 캡처 단계에서만 잡힙니다) */
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!img || img.tagName !== "IMG") return;
    const thumb = img.closest(".thumb");
    if (!thumb) return;
    img.remove();
    thumb.classList.add("is-empty");
    if (!thumb.querySelector(".thumb-fallback")) {
      const div = document.createElement("div");
      div.className = "thumb-fallback";
      div.textContent = "🛍️";
      thumb.prepend(div);
    }
  },
  true
);

/* ── 목록 화면 ────────────────────────────────────────────── */
function initDealList() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const all = (window.DEALS || []).slice();
  const state = { q: "", cat: "전체", sort: "new", showEnded: false };

  const catBox = document.getElementById("chips");
  const cats = ["전체", ...[...new Set(all.map((d) => d.category).filter(Boolean))]];
  catBox.innerHTML = cats
    .map(
      (c) =>
        `<button class="chip" aria-pressed="${c === "전체"}" data-cat="${esc(c)}">${esc(c)}</button>`
    )
    .join("");

  function visible() {
    const q = state.q.trim().toLowerCase();
    return all
      .filter((d) => (state.showEnded ? true : !d.ended))
      .filter((d) => state.cat === "전체" || d.category === state.cat)
      .filter(
        (d) =>
          !q ||
          (d.title || "").toLowerCase().includes(q) ||
          (d.note || "").toLowerCase().includes(q) ||
          (d.category || "").toLowerCase().includes(q)
      )
      .sort((a, b) =>
        state.sort === "off"
          ? discountRate(b) - discountRate(a)
          : new Date(b.postedAt || 0) - new Date(a.postedAt || 0)
      );
  }

  function render() {
    const list = visible();
    grid.innerHTML = list.length
      ? list.map(dealCardHTML).join("")
      : `<div class="empty" style="grid-column:1/-1">
           <div class="empty-emoji">🕳️</div>찾는 딜이 없어요</div>`;
    grid.querySelectorAll(".js-copy").forEach((btn, i) => {
      btn.addEventListener("click", async () => {
        const ok = await copyText(kakaoText(list[i]));
        toast(ok ? "카톡용 문구를 복사했어요" : "복사에 실패했어요");
        if (ok) {
          btn.classList.add("is-done");
          btn.textContent = "✓";
          setTimeout(() => {
            btn.classList.remove("is-done");
            btn.textContent = "💬";
          }, 1600);
        }
      });
    });
    const live = all.filter((d) => !d.ended).length;
    document.getElementById("stat-live").textContent = live;
    document.getElementById("stat-total").textContent = all.length;
  }

  document.getElementById("q").addEventListener("input", (e) => {
    state.q = e.target.value;
    render();
  });
  catBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    catBox.querySelectorAll(".chip").forEach((c) =>
      c.setAttribute("aria-pressed", String(c === btn))
    );
    render();
  });
  const sortBtn = document.getElementById("sort");
  sortBtn.addEventListener("click", () => {
    state.sort = state.sort === "new" ? "off" : "new";
    sortBtn.textContent = state.sort === "new" ? "최신순" : "할인율순";
    render();
  });
  const endedBtn = document.getElementById("ended");
  endedBtn.addEventListener("click", () => {
    state.showEnded = !state.showEnded;
    endedBtn.textContent = state.showEnded ? "마감 포함 ✓" : "마감 포함";
    render();
  });

  render();
}

/* ── 공통 채우기 ──────────────────────────────────────────── */
function initChrome() {
  document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = SITE.name || ""));
  document.querySelectorAll("[data-site-emoji]").forEach((el) => (el.textContent = SITE.emoji || ""));
  document.querySelectorAll("[data-site-tagline]").forEach((el) => (el.textContent = SITE.tagline || ""));
  document
    .querySelectorAll("[data-site-disclosure]")
    .forEach((el) => (el.textContent = SITE.disclosure || ""));
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
  const contact = document.querySelector("[data-site-contact]");
  if (contact && SITE.contact) {
    contact.innerHTML = `<a href="mailto:${esc(SITE.contact)}">${esc(SITE.contact)}</a>`;
  }
  const box = document.querySelector("[data-site-channels]");
  if (box) {
    const rows = (SITE.channels || []).filter((c) => c.url);
    box.innerHTML = rows.length
      ? rows
          .map(
            (c) =>
              `<li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a></li>`
          )
          .join("")
      : `<li>이 사이트에서만 운영합니다.</li>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initDealList();
  initAbout();
});
