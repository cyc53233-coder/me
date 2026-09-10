/** 설정과 가격 기록을 읽고 씁니다. 기록은 저장소 안의 JSON 파일 하나입니다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "config.json");
const HISTORY_PATH = path.join(ROOT, "data", "history.json");

const DEFAULTS = {
  check: { maxChecks: 60, requestDelayMs: 1500 },
  alert: { baselineDays: 30, dropPercent: 15, minSamples: 3, cooldownDays: 3, maxPoints: 200 },
  watch: [],
};

export function loadConfig() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    console.warn("config.json 을 읽지 못해 기본값으로 돕니다:", e.message);
  }
  return {
    check: { ...DEFAULTS.check, ...(raw.check || {}) },
    alert: { ...DEFAULTS.alert, ...(raw.alert || {}) },
    watch: Array.isArray(raw.watch) ? raw.watch.filter((w) => w && w.url) : [],
  };
}

export function saveWatchList(watch) {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  raw.watch = watch;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(raw, null, 2) + "\n", "utf8");
}

export function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  } catch (e) {
    return {};
  }
}

export function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n", "utf8");
}

export const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
