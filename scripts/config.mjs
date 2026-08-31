/** automation.json 을 읽습니다. 없거나 깨졌으면 기본값으로 돕니다. */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./deals-file.mjs";

const DEFAULTS = {
  coupang: { enabled: false, maxPerRun: 3, minDiscountRate: 25, minPrice: 0, maxPrice: 10000000, excludeKeywords: [], category: "쿠팡 골드박스" },
  watch: { enabled: false, risePercent: 5, maxChecks: 40 },
  scout: { enabled: false, maxPerRun: 8, keepSeen: 400, excludeKeywords: [], sources: [] },
};

export function loadConfig() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(ROOT, "automation.json"), "utf8"));
  } catch (e) {
    console.warn("automation.json 을 읽지 못해 기본값으로 돕니다:", e.message);
  }
  return {
    coupang: { ...DEFAULTS.coupang, ...(raw.coupang || {}) },
    watch: { ...DEFAULTS.watch, ...(raw.watch || {}) },
    scout: { ...DEFAULTS.scout, ...(raw.scout || {}) },
  };
}
