/**
 * "평소보다 싸졌는가"를 판정하는 곳. 이 파일이 이 프로그램의 핵심입니다.
 *
 * 기준은 그 상품 자신입니다 — 남이 써 붙인 정가가 아니라, 최근 며칠 동안
 * 이 상품이 실제로 달고 있던 가격. 세일 가격표를 믿지 않으려는 것입니다.
 *
 * 기록은 "가격이 바뀐 순간"만 남깁니다. 그래서 그대로 중앙값을 내면
 * 한 달 내내 붙어 있던 가격과 하루짜리 반짝 가격이 똑같은 한 표가 됩니다.
 * 그걸 막으려고, 기록을 하루 단위로 펴서(그날 실제로 붙어 있던 가격) 셉니다.
 */

export const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const DAY = 86400000;

/** 창 안의 날짜마다 "그날 붙어 있던 가격"을 하루에 하나씩 만듭니다. */
export function dailyPrices(points, baselineDays, now) {
  const sorted = [...points]
    .map((p) => ({ t: Date.parse(p.t), p: p.p }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (!sorted.length) return [];

  const start = Math.max(sorted[0].t, now - baselineDays * DAY);
  const out = [];
  let i = 0;
  let current = null;

  for (let t = start; t <= now; t += DAY) {
    while (i < sorted.length && sorted[i].t <= t) current = sorted[i++].p;
    if (current === null) current = sorted[0].p; // 창이 첫 기록보다 앞설 때
    out.push(current);
  }
  return out;
}

/**
 * 이번에 읽은 가격이 알릴 만한 하락인지 봅니다.
 * points 는 "이번 관측을 넣기 전"의 기록이어야 합니다.
 *
 * 반환: { alert, reason, baseline, dropPct, isLowest }
 */
export function judge(points, price, cfg, { now = Date.now(), lastAlert } = {}) {
  const days = dailyPrices(points, cfg.baselineDays, now);

  if (days.length < cfg.minDays) {
    return { alert: false, reason: `지켜본 지 ${days.length}일째 (${cfg.minDays}일은 봐야 판단)` };
  }

  const baseline = median(days);
  if (!baseline) return { alert: false, reason: "기준가를 낼 수 없음" };

  const dropPct = Math.round(((baseline - price) / baseline) * 100);
  const isLowest = price <= Math.min(...days);

  if (dropPct < cfg.dropPercent) {
    return { alert: false, reason: `${dropPct}% 하락 (기준 ${cfg.dropPercent}%)`, baseline, dropPct, isLowest };
  }

  // 같은 가격대로 최근에 이미 알렸으면 다시 알리지 않습니다.
  if (lastAlert && Date.parse(lastAlert.t) >= now - cfg.cooldownDays * DAY && price >= lastAlert.p) {
    return { alert: false, reason: "최근에 같은 가격으로 이미 알림", baseline, dropPct, isLowest };
  }

  return { alert: true, reason: `${dropPct}% 하락`, baseline, dropPct, isLowest };
}
