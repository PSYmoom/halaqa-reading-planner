// localStorage persistence: config + lightweight per-surah section cache.
import { DEFAULT_CONFIG, EDITION, CACHE_VERSION } from "./constants.js";

export const LS_KEY = "halaqa-config-v1";

export const secCacheKey = (s) => `halaqa-sections-v${CACHE_VERSION}-${EDITION}-${s}`;

/**
 * Guard against malformed or old-schema configs (stale storage, imported files): every
 * bucket must have a unique id and a members array. Otherwise readersByBucket / bucketsOff —
 * both keyed by bucket id — collapse onto one key, making every reader identical and every
 * on/off toggle move together.
 */
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

/** Saved config, normalized — or the defaults when storage is empty or corrupt. */
export function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeConfig(JSON.parse(raw));
  } catch {
    /* corrupt JSON or storage unavailable — fall through to defaults */
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    /* storage full or unavailable — config just won't persist this session */
  }
}

// Parsed JSON from storage isn't trusted until the shape checks out — one corrupt
// entry would otherwise break its surah until manually cleared.
const isSection = (s) =>
  s != null &&
  typeof s.title === "string" &&
  typeof s.words === "number" &&
  typeof s.ayahStart === "number" &&
  typeof s.ayahEnd === "number";

/** Cached sections for a surah, or null on a miss (absent, corrupt, or wrong shape). */
export function loadCachedSections(surah) {
  try {
    const raw = localStorage.getItem(secCacheKey(surah));
    if (!raw) return null;
    const sections = JSON.parse(raw);
    if (Array.isArray(sections) && sections.length && sections.every(isSection)) {
      return sections;
    }
  } catch {
    /* corrupt JSON or storage unavailable — treat as a cache miss */
  }
  return null;
}

export function cacheSections(surah, sections) {
  try {
    localStorage.setItem(secCacheKey(surah), JSON.stringify(sections));
  } catch {
    /* storage full or unavailable — next load refetches */
  }
}
