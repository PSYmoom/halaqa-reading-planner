// localStorage persistence: config + lightweight per-surah section cache.
import { DEFAULT_CONFIG, EDITION } from "./constants.js";

export const LS_KEY = "halaqa-config-v1";
export const secCacheKey = (s) => `halaqa-sections-${EDITION}-${s}`;

// Guard against malformed or old-schema configs (stale storage, imported files): every
// bucket must have a unique id and a members array. Otherwise readersByBucket / bucketsOff —
// both keyed by bucket id — collapse onto one key, making every reader identical and every
// on/off toggle move together.
export function normalizeConfig(cfg) {
  const seen = new Set();
  const src = Array.isArray(cfg.buckets) && cfg.buckets.length ? cfg.buckets : DEFAULT_CONFIG.buckets;
  const buckets = src.map((b, i) => {
    let id = b && typeof b.id === "string" ? b.id : "";
    if (!id || seen.has(id)) id = `b${i}_${Math.random().toString(36).slice(2, 8)}`;
    seen.add(id);
    return { id, members: Array.isArray(b?.members) ? b.members : [], ptr: b?.ptr || 0 };
  });
  return { ...DEFAULT_CONFIG, ...cfg, buckets };
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeConfig(JSON.parse(raw));
  } catch (e) {}
  return DEFAULT_CONFIG;
}

export function saveConfig(config) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch (e) {}
}

export function loadCachedSections(surah) {
  try {
    const raw = localStorage.getItem(secCacheKey(surah));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function cacheSections(surah, sections) {
  try { localStorage.setItem(secCacheKey(surah), JSON.stringify(sections)); } catch (e) {}
}
