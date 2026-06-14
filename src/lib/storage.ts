import { DEFAULT_CONFIG, EDITION, CACHE_VERSION } from "../config/constants.ts";
import type { Bucket, Config, Section } from "../types.ts";

export const LS_KEY = "halaqa-config-v1";

export const secCacheKey = (s: number) => `halaqa-sections-v${CACHE_VERSION}-${EDITION}-${s}`;

/** Repair untrusted/old-schema config; member names stay unique across the roster. */
export function normalizeConfig(cfg: unknown): Config {
  const c = (cfg ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const seenNames = new Set<string>(); // lowercased member names, for cross-bucket uniqueness
  const src: unknown[] =
    Array.isArray(c.buckets) && c.buckets.length ? c.buckets : DEFAULT_CONFIG.buckets;
  const buckets: Bucket[] = src.map((raw, i) => {
    const b = (raw ?? {}) as { id?: unknown; members?: unknown; ptr?: unknown };
    let id = typeof b.id === "string" ? b.id : "";
    if (!id || seen.has(id)) id = `b${i}_${Math.random().toString(36).slice(2, 8)}`;
    seen.add(id);
    const m: unknown[] = Array.isArray(b.members) ? b.members : [];
    const ptr = typeof b.ptr === "number" ? b.ptr : 0;
    const p = m.length ? ptr % m.length : 0;
    const migrated = p ? [...m.slice(p), ...m.slice(0, p)] : m;
    const members = migrated.map(String).filter((name) => {
      const k = name.trim().toLowerCase();
      if (!k || seenNames.has(k)) return false;
      seenNames.add(k);
      return true;
    });
    return { id, members };
  });
  return { ...DEFAULT_CONFIG, ...c, buckets } as Config;
}

/** Saved config, normalized — or the defaults when storage is empty or corrupt. */
export function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeConfig(JSON.parse(raw));
  } catch {
    /* corrupt or unavailable — use defaults */
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Config): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    /* storage full or unavailable — won't persist this session */
  }
}

// Untrusted JSON — verify shape before trusting a cached section.
function isSection(s: unknown): s is Section {
  if (s == null || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.words === "number" &&
    typeof o.ayahStart === "number" &&
    typeof o.ayahEnd === "number"
  );
}

/** Cached sections for a surah, or null on a miss (absent, corrupt, or wrong shape). */
export function loadCachedSections(surah: number): Section[] | null {
  try {
    const raw = localStorage.getItem(secCacheKey(surah));
    if (!raw) return null;
    const sections: unknown = JSON.parse(raw);
    if (Array.isArray(sections) && sections.length && sections.every(isSection)) {
      return sections;
    }
  } catch {
    /* corrupt or unavailable — treat as a cache miss */
  }
  return null;
}

export function cacheSections(surah: number, sections: Section[]): void {
  try {
    localStorage.setItem(secCacheKey(surah), JSON.stringify(sections));
  } catch {
    /* storage full or unavailable — next load refetches */
  }
}
