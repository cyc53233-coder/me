/* 공공 아이디어 허브 공용 스크립트 — data/site.js, data/tools.js 를 읽어 화면을 그립니다. */

const HUB = window.HUB || {};
const TYPES = HUB.types || {};

/* ── 유틸 ─────────────────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const typeMeta = (key) => TYPES[key] || { label: key || "기타", emoji: "🛠️" };
const typeLabel = (key) => typeMeta(key).label;
const typeEmoji = (key) => typeMeta(key).emoji;
const list = (v) => (Array.isArray(v) ? v : v ? String(v).split(/[,、]\s*/).filter(Boolean) : []);

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const day = Math.floor((Date.now() - t) / 86400000);
  if (day < 1) return "오늘";
  if (day < 7) return `${day}일 전`;
  if (day < 30) return `${Math.floor(day / 7)}주 전`;
  return new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function fullDate(iso) {
  const t = new Date(iso || "").getTime();
  return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

/* 도구 하나를 가리키는 주소 — base 를 주면 그 주소 기준 (Actions 에서 씁니다) */
function hubLink(tool, base) {
  const root =
    base ||
    (typeof location !== "undefined" ? location.href.split("#")[0] : "");
  return `${root}#t=${encodeURIComponent(tool.id || "")}`;
}

const issueLink = (tool) =>
  HUB.repo && tool.issue ? `https://github.com/${HUB.repo}/issues/${tool.issue}` : "";

/* 메신저·게시판에 그대로 붙여넣는 문구 */
function shareText(tool, base) {
  const lines = [];
  lines.push(`${typeEmoji(tool.type)} [${HUB.name || "아이디어 허브"}] ${tool.title}`);
  if (tool.summary) lines.push(` ┗ ${tool.summary}`);
  const bits = [tool.area, typeLabel(tool.type), list(tool.platforms).join("/")].filter(Boolean);
  if (bits.length) lines.push(` ┗ ${bits.join(" · ")}`);
  if (tool.author || tool.org) lines.push(` ┗ 만든 사람: ${[tool.author, tool.org].filter(Boolean).join(" · ")}`);
  lines.push(hubLink(tool, base));
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

/* 버튼 하나에 복사 동작을 붙입니다 */
function bindCopy(btn, getText, okMsg) {
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const ok = await copyText(getText());
    toast(ok ? okMsg : "복사에 실패했어요");
    if (!ok) return;
    const was = btn.textContent;
    btn.classList.add("is-done");
    btn.textContent = "✓ 복사됨";
    setTimeout(() => {
      btn.classList.remove("is-done");
      btn.textContent = was;
    }, 1600);
  });
}

/* ── 카드 ─────────────────────────────────────────────────── */
function badgesHTML(tool, opts = {}) {
  return [
    tool.featured && !tool.retired ? `<span class="badge badge-star">⭐ 추천</span>` : "",
    tool.area ? `<span class="badge badge-area">${esc(tool.area)}</span>` : "",
    `<span class="badge badge-type">${esc(typeLabel(tool.type))}</span>`,
    ...list(tool.platforms).map((p) => `<span class="badge">${esc(p)}</span>`),
    opts.license && tool.license ? `<span class="badge badge-license">${esc(tool.license)}</span>` : "",
    tool.retired ? `<span class="badge badge-retired">내림</span>` : "",
    tool.sample ? `<span class="badge badge-sample">샘플</span>` : "",
  ].join("");
}

function toolCardHTML(tool) {
  const who = [tool.author, tool.org].filter(Boolean).join(" · ");
  const primary = tool.prompt
    ? `<button class="btn btn-sm js-copy-prompt" type="button">프롬프트 복사</button>`
    : tool.url && !tool.sample
    ? `<a class="btn btn-sm" href="${esc(tool.url)}" target="_blank" rel="noopener">도구 열기 ↗</a>`
    : `<button class="btn btn-sm" type="button" disabled>${tool.sample ? "샘플" : "주소 없음"}</button>`;

  return `
    <article class="tool ${tool.retired ? "is-retired" : ""} ${tool.sample ? "is-sample" : ""}"
             data-id="${esc(tool.id)}" tabindex="0" role="button" aria-label="${esc(tool.title)} 자세히 보기">
      <div class="tool-head">
        <div class="tool-icon t-${esc(tool.type || "other")}">${typeEmoji(tool.type)}</div>
        <div>
          <h2 class="tool-title">${esc(tool.title)}</h2>
          ${who ? `<p class="tool-sub">${esc(who)}</p>` : ""}
        </div>
      </div>
      <p class="tool-summary">${esc(tool.summary)}</p>
      <div class="badges">${badgesHTML(tool)}</div>
      <div class="tool-foot">
        <span>${esc(timeAgo(tool.postedAt))}</span>
        <span class="spacer"></span>
        <div class="tool-actions">
          ${primary}
          <button class="btn btn-sm btn-ghost js-open" type="button">자세히</button>
        </div>
      </div>
    </article>`;
}

/* ── 상세 창 ──────────────────────────────────────────────── */
function detailHTML(tool) {
  const who = [tool.author, tool.org].filter(Boolean).join(" · ");
  const lic = tool.license ? `${tool.license}${HUB.licenses?.[tool.license] ? ` — ${HUB.licenses[tool.license]}` : ""}` : "";
  const issue = issueLink(tool);
  const open = tool.url
    ? tool.sample
      ? `<button class="btn" type="button" disabled>샘플 (주소 없음)</button>`
      : `<a class="btn" href="${esc(tool.url)}" target="_blank" rel="noopener">도구 열기 ↗</a>`
    : "";

  return `
    <div class="detail-inner">
      <div class="detail-top">
        <div class="tool-icon t-${esc(tool.type || "other")}">${typeEmoji(tool.type)}</div>
        <div>
          <h2>${esc(tool.title)}</h2>
          ${who ? `<p class="tool-sub">${esc(who)}</p>` : ""}
        </div>
        <button class="detail-close" type="button" aria-label="닫기">✕</button>
      </div>
      <p class="detail-summary">${esc(tool.summary)}</p>
      <div class="badges">${badgesHTML(tool, { license: true })}</div>

      <div class="detail-actions">
        ${open}
        ${tool.prompt ? `<button class="btn ${open ? "btn-ghost" : ""} js-copy-prompt" type="button">프롬프트 복사</button>` : ""}
        <button class="btn btn-ghost js-copy-link" type="button">링크 복사</button>
        <button class="btn btn-ghost js-copy-share" type="button">공유 문구 복사</button>
      </div>

      ${tool.prompt ? `
      <div class="detail-section">
        <div class="out-head"><h3>프롬프트</h3></div>
        <pre class="out">${esc(tool.prompt)}</pre>
      </div>` : ""}

      ${tool.howto ? `
      <div class="detail-section">
        <h3>사용 방법</h3>
        <p>${esc(tool.howto)}</p>
      </div>` : ""}

      <dl class="detail-meta">
        ${lic ? `<div><dt>이용 조건</dt><dd>${esc(lic)}</dd></div>` : ""}
        ${tool.postedAt ? `<div><dt>등록일</dt><dd>${esc(fullDate(tool.postedAt))}</dd></div>` : ""}
        ${list(tool.tags).length ? `<div><dt>태그</dt><dd>${list(tool.tags).map(esc).join(", ")}</dd></div>` : ""}
        ${issue ? `<div><dt>의견 · 질문</dt><dd><a href="${esc(issue)}" target="_blank" rel="noopener">등록 이슈에 남기기 ↗</a></dd></div>` : ""}
      </dl>

      ${HUB.notice ? `<p class="notice"><span>ℹ️</span><span>${esc(HUB.notice)}</span></p>` : ""}
    </div>`;
}

function initDetail(all) {
  const dlg = document.getElementById("detail");
  if (!dlg) return { open() {} };
  const byId = new Map(all.map((t) => [t.id, t]));
  let current = null;

  function clearHash() {
    if (location.hash.startsWith("#t=")) history.replaceState(null, "", location.pathname + location.search);
  }

  function open(id, { push = true } = {}) {
    const tool = byId.get(id);
    if (!tool) return;
    current = tool;
    dlg.innerHTML = detailHTML(tool);
    dlg.querySelector(".detail-close").addEventListener("click", () => dlg.close());
    bindCopy(dlg.querySelector(".js-copy-prompt"), () => tool.prompt, "프롬프트를 복사했어요");
    bindCopy(dlg.querySelector(".js-copy-link"), () => hubLink(tool), "링크를 복사했어요");
    bindCopy(dlg.querySelector(".js-copy-share"), () => shareText(tool), "공유 문구를 복사했어요");
    if (push && location.hash !== `#t=${encodeURIComponent(id)}`) {
      history.pushState(null, "", `#t=${encodeURIComponent(id)}`);
    }
    if (!dlg.open) dlg.showModal();
    dlg.querySelector(".detail-inner").scrollTop = 0;
  }

  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener("close", () => {
    current = null;
    clearHash();
  });
  window.addEventListener("hashchange", () => {
    const m = location.hash.match(/^#t=(.+)$/);
    if (m) open(decodeURIComponent(m[1]), { push: false });
    else if (dlg.open) dlg.close();
  });

  const m = location.hash.match(/^#t=(.+)$/);
  if (m) open(decodeURIComponent(m[1]), { push: false });
  return { open };
}

/* ── 목록 화면 ────────────────────────────────────────────── */
function initToolList() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const all = (window.TOOLS || []).slice();
  const detail = initDetail(all);
  const state = { q: "", area: "전체", type: "전체", sort: "new", showRetired: false };

  const areaBox = document.getElementById("chips-area");
  const areas = ["전체", ...(HUB.areas || []).filter((a) => all.some((t) => t.area === a))];
  for (const t of all) if (t.area && !areas.includes(t.area)) areas.push(t.area);
  areaBox.innerHTML = areas
    .map((c) => `<button class="chip" type="button" aria-pressed="${c === "전체"}" data-v="${esc(c)}">${esc(c)}</button>`)
    .join("");

  const typeBox = document.getElementById("chips-type");
  const types = ["전체", ...Object.keys(TYPES).filter((k) => all.some((t) => t.type === k))];
  typeBox.innerHTML = types
    .map(
      (k) =>
        `<button class="chip" type="button" aria-pressed="${k === "전체"}" data-v="${esc(k)}">${
          k === "전체" ? "모든 유형" : `${typeEmoji(k)} ${esc(typeLabel(k))}`
        }</button>`
    )
    .join("");

  function haystack(t) {
    return [t.title, t.summary, t.area, typeLabel(t.type), t.author, t.org, t.howto, ...list(t.tags), ...list(t.platforms)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function visible() {
    const q = state.q.trim().toLowerCase();
    return all
      .filter((t) => (state.showRetired ? true : !t.retired))
      .filter((t) => state.area === "전체" || t.area === state.area)
      .filter((t) => state.type === "전체" || t.type === state.type)
      .filter((t) => !q || haystack(t).includes(q))
      .sort((a, b) => {
        const star = (b.featured && !b.retired ? 1 : 0) - (a.featured && !a.retired ? 1 : 0);
        if (star) return star;
        return state.sort === "name"
          ? String(a.title).localeCompare(String(b.title), "ko")
          : new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
      });
  }

  function render() {
    const rows = visible();
    grid.innerHTML = rows.length
      ? rows.map(toolCardHTML).join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="empty-emoji">🔍</div>찾는 도구가 없어요.<br>직접 만든 도구가 있다면 <a href="submit.html" style="text-decoration:underline">등록해 주세요</a>.</div>`;

    grid.querySelectorAll(".tool").forEach((card, i) => {
      const tool = rows[i];
      const openIt = () => detail.open(tool.id);
      card.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        openIt();
      });
      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === card) {
          e.preventDefault();
          openIt();
        }
      });
      card.querySelector(".js-open").addEventListener("click", (e) => {
        e.stopPropagation();
        openIt();
      });
      bindCopy(card.querySelector(".js-copy-prompt"), () => tool.prompt, "프롬프트를 복사했어요");
    });

    const live = all.filter((t) => !t.retired);
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("stat-tools", live.length);
    set("stat-areas", new Set(live.map((t) => t.area).filter(Boolean)).size);
    set("stat-people", new Set(live.map((t) => t.org || t.author).filter(Boolean)).size);
    set("stat-shown", rows.length);
  }

  document.getElementById("q").addEventListener("input", (e) => {
    state.q = e.target.value;
    render();
  });
  const bindChips = (box, key) =>
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      state[key] = btn.dataset.v;
      box.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
      render();
    });
  bindChips(areaBox, "area");
  bindChips(typeBox, "type");

  const sortBtn = document.getElementById("sort");
  sortBtn.addEventListener("click", () => {
    state.sort = state.sort === "new" ? "name" : "new";
    sortBtn.textContent = state.sort === "new" ? "최신순" : "이름순";
    render();
  });
  const retiredBtn = document.getElementById("retired");
  retiredBtn.addEventListener("click", () => {
    state.showRetired = !state.showRetired;
    retiredBtn.setAttribute("aria-pressed", String(state.showRetired));
    retiredBtn.textContent = state.showRetired ? "내린 도구 포함 ✓" : "내린 도구 포함";
    render();
  });

  render();
}

/* ── 공통 채우기 ──────────────────────────────────────────── */
function initChrome() {
  const fill = (attr, value) =>
    document.querySelectorAll(`[${attr}]`).forEach((el) => (el.textContent = value || ""));
  fill("data-hub-name", HUB.name);
  fill("data-hub-emoji", HUB.emoji);
  fill("data-hub-tagline", HUB.tagline);
  fill("data-hub-notice", HUB.notice);
  if (HUB.name) document.title = document.title.replace("{hub}", HUB.name);

  document.querySelectorAll("[data-issue-link]").forEach((el) => {
    if (!HUB.repo) return el.remove();
    el.href = `https://github.com/${HUB.repo}/issues/new?template=${el.dataset.issueLink}`;
  });
  document.querySelectorAll("[data-repo-link]").forEach((el) => {
    if (!HUB.repo) return el.remove();
    el.href = `https://github.com/${HUB.repo}`;
  });
  document.querySelectorAll("[data-hub-rules]").forEach((el) => {
    el.innerHTML = (HUB.rules || []).map((r) => `<li>${esc(r)}</li>`).join("");
  });
}

/* ── 소개 화면 ────────────────────────────────────────────── */
function initAbout() {
  const intro = document.querySelector("[data-hub-intro]");
  if (intro && Array.isArray(HUB.intro)) intro.innerHTML = HUB.intro.map((p) => `<p>${esc(p)}</p>`).join("");

  const contact = document.querySelector("[data-hub-contact]");
  if (contact && HUB.contact) contact.innerHTML = `<a href="mailto:${esc(HUB.contact)}">${esc(HUB.contact)}</a>`;

  const lic = document.querySelector("[data-hub-licenses]");
  if (lic) {
    lic.innerHTML = Object.entries(HUB.licenses || {})
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initToolList();
  initAbout();
});
