/**
 * 이슈 폼으로 들어온 도구를 idea-hub/data/tools.js 에 반영합니다.
 * GitHub Actions(.github/workflows/hub.yml)에서 실행되고,
 * 이슈에 남길 답글을 .hub-comment.md 로, 커밋 메시지를 .hub-commit-message 로 남깁니다.
 *
 * 환경변수
 *   MODE          preview | publish | retire
 *                 preview — 이슈가 열리면 검사하고 미리보기 답글만 (사이트에는 안 올라감)
 *                 publish — 운영자가 "게시" 라벨을 붙이면 사이트에 올림
 *                 retire  — "도구 내리기" 이슈로 내림 처리
 *   ISSUE_BODY ISSUE_NUMBER ISSUE_AUTHOR SITE_URL
 */
import fs from "node:fs";
import path from "node:path";
import { HUB_ROOT, readTools, writeTools, loadBrowserContext, nowKST } from "./tools-file.mjs";

const MODE = ["preview", "publish", "retire"].includes(process.env.MODE) ? process.env.MODE : "preview";
const BODY = process.env.ISSUE_BODY || "";
const ISSUE = Number(process.env.ISSUE_NUMBER) || 0;
const AUTHOR = process.env.ISSUE_AUTHOR || "";
const SITE_URL = process.env.SITE_URL || "";
const REPO_ROOT = path.resolve(HUB_ROOT, "..");
const COMMENT_PATH = path.join(REPO_ROOT, ".hub-comment.md");
const MESSAGE_PATH = path.join(REPO_ROOT, ".hub-commit-message");

const MAX = { title: 80, summary: 200, prompt: 12000, howto: 4000, author: 40, org: 60 };

/* ── 이슈 폼 파싱 ─────────────────────────────────────────── */
/* "### 라벨" 로 나뉜 칸을 읽되, ``` 코드 울타리 안의 "###" 는 제목으로 보지 않습니다. */
function parseForm(body) {
  const out = new Map();
  let key = null;
  let buf = [];
  let fence = false;
  const flush = () => {
    if (key === null) return;
    let value = buf.join("\n").trim();
    /* render: text 로 받은 칸은 ```text … ``` 로 감싸여 옵니다 */
    const m = value.match(/^```[\w-]*\n([\s\S]*?)\n?```$/);
    if (m) value = m[1].trim();
    if (value === "_No response_" || value === "_없음_" || value === "None") value = "";
    out.set(key, value);
  };
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence;
    const h = !fence && line.match(/^### +(.+?)\s*$/);
    if (h) {
      flush();
      key = h[1].trim();
      buf = [];
    } else if (key !== null) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

const field = (form, name) => (form.get(name) || "").trim();
const checkedCount = (form, name) => ((form.get(name) || "").match(/^- \[x\]/gim) || []).length;
const splitList = (s) => String(s || "").split(/[,、\n]\s*/).map((x) => x.trim()).filter(Boolean);

/* ── 답글 ─────────────────────────────────────────────────── */
function comment(md) {
  fs.writeFileSync(COMMENT_PATH, md.trimStart() + "\n", "utf8");
}

function fail(md) {
  comment(`❌ **아직 올릴 수 없습니다.**\n\n${md}\n\n이슈 본문을 고쳐서 저장하면 다시 검사합니다.`);
  process.exit(1);
}

function finish(changed, message) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `changed=${changed ? "true" : "false"}\n`);
  fs.writeFileSync(MESSAGE_PATH, message || "허브 갱신", "utf8");
}

/* ── 폼 → 도구 ────────────────────────────────────────────── */
function typeKeyOf(label) {
  const types = loadBrowserContext().window.HUB?.types || {};
  const hit = Object.entries(types).find(([k, t]) => t.label === label || k === label);
  return hit ? hit[0] : "other";
}

function buildTool(form) {
  const errors = [];
  const title = field(form, "도구 이름");
  const summary = field(form, "한 줄 설명");
  const url = field(form, "도구 주소");
  const prompt = field(form, "프롬프트 본문");
  const howto = field(form, "사용 방법");
  const author = field(form, "작성자 표시 이름") || AUTHOR;
  const rules = loadBrowserContext().window.HUB?.rules || [];

  if (!title) errors.push("**도구 이름**을 적어 주세요.");
  if (!summary) errors.push("**한 줄 설명**을 적어 주세요.");
  if (!url && !prompt) errors.push("**도구 주소**와 **프롬프트 본문** 중 하나는 있어야 합니다.");
  if (url && !/^https:\/\/\S+$/i.test(url)) errors.push("**도구 주소**는 `https://` 로 시작하는 주소여야 합니다.");
  if (url && /example\.com/i.test(url)) errors.push("**도구 주소**에 샘플 주소(example.com)가 들어 있습니다.");
  if (!howto) errors.push("**사용 방법**을 적어 주세요. 처음 보는 사람이 따라 할 수 있게요.");
  for (const [k, v] of Object.entries({ title, summary, prompt, howto, author, org: field(form, "소속") })) {
    if (v.length > MAX[k]) errors.push(`**${k}** 칸이 너무 깁니다 (${v.length}자, 최대 ${MAX[k]}자).`);
  }
  if (rules.length && checkedCount(form, "확인 사항") < rules.length) {
    errors.push("**확인 사항**에 모두 체크해 주세요. 개인정보·비공개 정보가 없고, 공유할 권한이 있다는 확인입니다.");
  }
  if (errors.length) fail(errors.map((e) => `- ${e}`).join("\n"));

  return {
    id: `t${ISSUE}`,
    title,
    summary,
    area: field(form, "업무 분야") || "기타",
    type: typeKeyOf(field(form, "도구 유형")),
    platforms: splitList(field(form, "쓰는 곳")),
    url: url || undefined,
    prompt: prompt || undefined,
    howto,
    author,
    org: field(form, "소속") || undefined,
    license: field(form, "이용 조건") || undefined,
    tags: splitList(field(form, "태그")),
    postedAt: nowKST(),
    issue: ISSUE || undefined,
  };
}

function cardSummary(tool) {
  const types = loadBrowserContext().window.HUB?.types || {};
  const typeLabel = types[tool.type]?.label || tool.type;
  const who = [tool.author, tool.org].filter(Boolean).join(" · ");
  return [
    `| | |`,
    `|---|---|`,
    `| 이름 | **${tool.title}** |`,
    `| 설명 | ${tool.summary} |`,
    `| 분야 · 유형 | ${tool.area} · ${typeLabel} |`,
    tool.platforms.length ? `| 쓰는 곳 | ${tool.platforms.join(", ")} |` : "",
    tool.url ? `| 주소 | ${tool.url} |` : "",
    tool.prompt ? `| 프롬프트 | ${tool.prompt.length}자 (카드에서 복사 가능) |` : "",
    who ? `| 만든 사람 | ${who} |` : "",
    tool.license ? `| 이용 조건 | ${tool.license} |` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ── preview: 검사만 하고 미리보기 답글 ───────────────────── */
function preview(form) {
  const tool = buildTool(form);
  comment(`
✅ **형식 검사를 통과했습니다.** 운영자가 내용을 확인한 뒤 \`게시\` 라벨을 붙이면 사이트에 올라갑니다.

${cardSummary(tool)}

> 고칠 것이 있으면 이슈 본문을 그대로 수정하세요. 저장할 때마다 다시 검사합니다.
`);
  finish(false);
}

/* ── publish: 사이트에 올리기 ─────────────────────────────── */
function publish(form) {
  const tool = buildTool(form);
  const tools = readTools();
  const dupeAt = tools.findIndex((t) => t.id === tool.id);
  if (dupeAt !== -1) {
    /* 같은 이슈를 다시 게시하면 원래 등록일과 추천 표시는 유지합니다 */
    tool.postedAt = tools[dupeAt].postedAt || tool.postedAt;
    if (tools[dupeAt].featured) tool.featured = true;
    tools.splice(dupeAt, 1);
  }
  tools.unshift(tool);
  writeTools(tools);

  const ctx = loadBrowserContext();
  const link = ctx.hubLink(tool, SITE_URL);
  comment(`
🎉 **사이트에 올렸습니다.** ${dupeAt !== -1 ? "(같은 이슈로 올린 도구가 있어 최신 내용으로 바꿨습니다)" : ""}

${SITE_URL ? `도구 페이지: ${link}` : ""}

메신저·게시판에 붙여넣을 소개 문구입니다 — 상자 오른쪽 위 복사 버튼을 누르세요.

\`\`\`
${ctx.shareText(tool, SITE_URL)}
\`\`\`

내용을 고치려면 이 이슈 본문을 수정한 뒤 운영자에게 \`게시\` 라벨을 다시 붙여 달라고 하세요. 도구에 대한 질문과 의견은 이 이슈에 답글로 남기면 됩니다.
`);
  finish(true, `허브: ${tool.title} 게시 (#${ISSUE})`);
}

/* ── retire: 내리기 ───────────────────────────────────────── */
function retire(form) {
  const key = field(form, "내릴 도구");
  if (!key) fail("어떤 도구를 내릴지 이름, 이슈 번호, 또는 공유 링크를 적어 주세요.");

  const issueNo = key.match(/(?:#|issues\/|t=t?)(\d+)/)?.[1] || (/^\d+$/.test(key) ? key : "");
  const tools = readTools();
  const hit = tools.find(
    (t) =>
      (issueNo && (t.id === `t${issueNo}` || String(t.issue) === issueNo)) ||
      t.id === key ||
      (t.title || "").includes(key)
  );
  if (!hit) fail(`\`${key}\` 에 해당하는 도구를 찾지 못했습니다.`);
  if (hit.retired) {
    comment(`ℹ️ **${hit.title}** 은(는) 이미 내려져 있습니다.`);
    return finish(false);
  }
  hit.retired = true;
  writeTools(tools);
  comment(`✅ **${hit.title}** 을(를) 내렸습니다. 목록에서는 "내린 도구 포함"을 켜야 보이고, 기록은 남습니다.`);
  finish(true, `허브: ${hit.title} 내림`);
}

/* ── 실행 ─────────────────────────────────────────────────── */
const form = parseForm(BODY);
if (MODE === "retire") retire(form);
else if (MODE === "publish") publish(form);
else preview(form);
