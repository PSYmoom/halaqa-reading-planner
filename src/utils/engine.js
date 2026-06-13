// Pure tafsir-processing engine: fetch → sort → dedup → section-split → assign.
// No React here, so this is trivially unit-testable in Node.
import { SMALL, CDNS } from "../config/constants.js";

// Arabic, Arabic Supplement, and the Presentation Forms blocks (where the
// ﷺ ligature U+FDFA lives) — used to spot Arabic script and honorific glyphs.
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-ﻼ]/;

/** Heuristic: is this line a Title-Case section heading (vs. prose, quote, or Arabic)? */
export function isHeading(line) {
  // Ibn Kathir headings often carry a trailing honorific like "(ﷺ)" or
  // "(عليه السلام)"; drop it first so its closing ")" isn't read as prose
  // punctuation (which would reject the heading). Only strips parentheticals
  // containing Arabic glyphs, so English asides like "...you do.)" are untouched.
  const s = line
    .trim()
    .replace(/\s*\([^)]*[؀-ۿﭐ-﷿][^)]*\)$/, "")
    .trim();
  if (!s || s.length > 100) return false;
  if (ARABIC.test(s)) return false; // Arabic script
  if (/[.!?:;,"”’)]$/.test(s)) return false; // ends like prose
  if (/^[(«"]/.test(s)) return false; // quote/translation line
  const words = s.match(/[A-Za-z][A-Za-z'’-]*/g);
  if (!words || words.length < 2) return false;
  const sig = words.filter((w) => !SMALL.has(w.toLowerCase()));
  if (!sig.length) return false;
  const cap = sig.filter((w) => /[A-Z]/.test(w[0])).length;
  return cap / sig.length >= 0.8;
}

/** Count of whitespace-separated words. */
export const wordCount = (s) => (s.match(/\S+/g) || []).length;

/** Turn a raw surah JSON into a flat, ordered list of sections with word counts. */
export function buildSections(rawAyahs) {
  const ayahs = rawAyahs.slice().sort((a, b) => a.ayah - b.ayah); // array is string-sorted upstream
  // 1) collapse consecutive identical commentary into blocks spanning an ayah range
  const blocks = [];
  for (const a of ayahs) {
    const text = (a.text || "").trim();
    if (!text) continue;
    const prev = blocks[blocks.length - 1];
    if (prev && prev.text === text) prev.ayahEnd = a.ayah;
    else blocks.push({ ayahStart: a.ayah, ayahEnd: a.ayah, text });
  }
  // 2) split each block at heading lines
  const sections = [];
  for (const b of blocks) {
    let cur = null;
    const flush = () => {
      if (cur) {
        cur.words = wordCount(cur.body);
        sections.push(cur);
        cur = null;
      }
    };
    for (const line of b.text.split("\n")) {
      if (isHeading(line)) {
        flush();
        cur = { title: line.trim(), body: "", ayahStart: b.ayahStart, ayahEnd: b.ayahEnd };
      } else {
        if (!cur) cur = { title: null, body: "", ayahStart: b.ayahStart, ayahEnd: b.ayahEnd };
        cur.body += (cur.body ? "\n" : "") + line;
      }
    }
    flush();
  }
  // keep only what the app needs (lightweight, cacheable)
  return sections.map((s) => ({
    title:
      s.title ||
      (s.ayahStart === s.ayahEnd ? `Ayat ${s.ayahStart}` : `Ayat ${s.ayahStart}–${s.ayahEnd}`),
    words: s.words,
    ayahStart: s.ayahStart,
    ayahEnd: s.ayahEnd,
  }));
}

/** Fetch and section a surah's tafsir, trying each CDN in order. Abortable via `signal`. */
export async function fetchSurahSections(surah, { signal } = {}) {
  let lastErr;
  for (const url of CDNS.map((f) => f(surah))) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const ayahs = json.ayahs || json;
      if (!Array.isArray(ayahs)) throw new Error("unexpected JSON shape");
      return buildSections(ayahs);
    } catch (e) {
      if (e.name === "AbortError") throw e; // caller cancelled — don't try the fallback CDN
      lastErr = e;
    }
  }
  throw lastErr || new Error("fetch failed");
}

/**
 * Pick this week's sections starting at startAyah until wordBudget is met
 * (always include at least `minSections` so everyone in the bucket gets a part).
 */
export function pickWeek(sections, startAyah, wordBudget, minSections) {
  let start = sections.findIndex((s) => s.ayahEnd >= startAyah);
  if (start < 0) start = 0;
  const out = [];
  let words = 0;
  for (let i = start; i < sections.length; i++) {
    out.push(sections[i]);
    words += sections[i].words;
    if (words >= wordBudget && out.length >= minSections) break;
  }
  return out;
}

/**
 * Compute split indices (where each subsequent member begins) for a contiguous,
 * weight-proportional division of the week's sections.
 *
 * Each reader's target word-count is proportional to their weight; we then choose
 * the section boundaries that globally minimise the total squared deviation from
 * those targets (a DP over sections × readers). Solving it globally — rather than
 * snapping each cut greedily — is what keeps the allocation monotonic in weight,
 * so a heavier weight never ends up with fewer words than a lighter one.
 */
export function computeSplits(weekSections, weights) {
  const n = weights.length;
  if (n <= 1) return [];
  const m = weekSections.length;
  if (m === 0) return new Array(n - 1).fill(0);

  const pre = [0];
  weekSections.forEach((s) => pre.push(pre[pre.length - 1] + s.words));
  const totalWords = pre[m];
  const W = weights.reduce((a, b) => a + b, 0) || n;
  const target = weights.map((w) => (totalWords * w) / W);

  // Everyone reads, so give each reader at least one section when there are enough
  // to go around; only allow empty assignments when readers outnumber sections.
  const minEach = m >= n ? 1 : 0;

  // dp[i][k] = least cost of assigning readers 0..i-1 across sections 0..k-1, where
  // cost is the squared deviation of each reader's word-count from their target.
  const INF = Infinity;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-1));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let k = i * minEach; k <= m; k++) {
      // reader i-1 covers sections [start, k); leave a section for each earlier reader
      const firstStart = (i - 1) * minEach;
      const lastStart = k - minEach;
      for (let start = firstStart; start <= lastStart; start++) {
        if (dp[i - 1][start] === INF) continue;
        const d = pre[k] - pre[start] - target[i - 1];
        const c = dp[i - 1][start] + d * d;
        if (c < dp[i][k]) {
          dp[i][k] = c;
          back[i][k] = start;
        }
      }
    }
  }

  // walk the boundaries back: bounds[0]=0 … bounds[n]=m; interior cuts are the splits
  const bounds = new Array(n + 1);
  bounds[n] = m;
  for (let i = n; i >= 1; i--) bounds[i - 1] = back[i][bounds[i]];
  return bounds.slice(1, n);
}

/** Materialise each member's contiguous portion (sections, words, ayah range) from the cuts. */
export function buildAssignments(weekSections, members, splits) {
  const bounds = [0, ...splits, weekSections.length];
  return members.map((name, i) => {
    const secs = weekSections.slice(bounds[i], bounds[i + 1]);
    const words = secs.reduce((a, s) => a + s.words, 0);
    const first = secs[0],
      last = secs[secs.length - 1];
    return {
      name,
      sections: secs,
      words,
      ayahStart: first ? first.ayahStart : null,
      ayahEnd: last ? last.ayahEnd : null,
    };
  });
}
