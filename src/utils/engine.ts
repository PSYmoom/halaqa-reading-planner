import { SMALL, CDNS } from "../config/constants.ts";
import type { Section, Assignment, NextStart } from "../types.ts";

/** A raw ayah record as delivered by the tafsir CDN. */
export interface RawAyah {
  ayah: number;
  text?: string;
}

// A section mid-assembly: title is null until a heading appears; words set at flush.
interface DraftSection {
  title: string | null;
  body: string;
  ayahStart: number;
  ayahEnd: number;
  words?: number;
}

// Arabic Unicode blocks as code-point ranges (not literal glyphs) so intent reads clearly.
const ARABIC_BLOCK = "؀-ۿ"; // Arabic
const ARABIC_SUPPLEMENT = "ݐ-ݿ"; // Arabic Supplement
const PRESENTATION_FORMS_A = "ﭐ-﷿"; // Presentation Forms-A (incl. ﷺ, U+FDFA)
const PRESENTATION_FORMS_B = "ﹰ-ﻼ"; // Presentation Forms-B

// Any Arabic character — used to reject Arabic-script lines.
const ARABIC = new RegExp(
  `[${ARABIC_BLOCK}${ARABIC_SUPPLEMENT}${PRESENTATION_FORMS_A}${PRESENTATION_FORMS_B}]`,
);

// A trailing honorific like "(ﷺ)"; the parens must contain Arabic, sparing English asides.
const TRAILING_ARABIC_PARENS = new RegExp(
  `\\s*\\([^)]*[${ARABIC_BLOCK}${PRESENTATION_FORMS_A}][^)]*\\)$`,
);

const MAX_HEADING_LENGTH = 100; // longer lines read as prose
const MIN_HEADING_WORDS = 2; // a lone word isn't a heading
const MIN_TITLECASE_RATIO = 0.8; // share of significant words that must be capitalised

/** Heuristic: is this line a Title-Case section heading (vs. prose, quote, or Arabic)? */
export function isHeading(line: string): boolean {
  // Strip a trailing honorific so its ")" isn't read as prose punctuation.
  const s = line.trim().replace(TRAILING_ARABIC_PARENS, "").trim();
  if (!s || s.length > MAX_HEADING_LENGTH) return false;
  if (ARABIC.test(s)) return false;
  if (/[.:;,"”’)]$/.test(s)) return false;
  if (/^[(«"]/.test(s)) return false; // quote/translation line
  const words = s.match(/[A-Za-z][A-Za-z'’-]*/g);
  if (!words || words.length < MIN_HEADING_WORDS) return false;
  const sig = words.filter((w) => !SMALL.has(w.toLowerCase()));
  if (!sig.length) return false;
  const cap = sig.filter((w) => /[A-Z]/.test(w[0])).length;
  return cap / sig.length >= MIN_TITLECASE_RATIO;
}

/** Count of whitespace-separated words. */
export const wordCount = (s: string): number => (s.match(/\S+/g) || []).length;

/** Turn raw surah JSON into a flat, ordered list of sections with word counts. */
export function buildSections(rawAyahs: RawAyah[]): Section[] {
  const ayahs = rawAyahs.slice().sort((a, b) => a.ayah - b.ayah);
  // Collapse consecutive identical commentary into blocks spanning an ayah range.
  const blocks: { ayahStart: number; ayahEnd: number; text: string }[] = [];
  for (const a of ayahs) {
    const text = (a.text || "").trim();
    if (!text) continue;
    const prev = blocks[blocks.length - 1];
    if (prev && prev.text === text) prev.ayahEnd = a.ayah;
    else blocks.push({ ayahStart: a.ayah, ayahEnd: a.ayah, text });
  }
  // Split each block at heading lines.
  const sections: DraftSection[] = [];
  for (const b of blocks) {
    let cur: DraftSection | null = null;
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
  return sections.map((s) => ({
    title:
      s.title ||
      (s.ayahStart === s.ayahEnd ? `Ayat ${s.ayahStart}` : `Ayat ${s.ayahStart}–${s.ayahEnd}`),
    words: s.words ?? 0,
    ayahStart: s.ayahStart,
    ayahEnd: s.ayahEnd,
  }));
}

/** Fetch and section a surah's tafsir, trying each CDN in order. Abortable via `signal`. */
export async function fetchSurahSections(
  surah: number,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Section[]> {
  let lastErr: unknown;
  for (const url of CDNS.map((f) => f(surah))) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json: unknown = await res.json();
      const ayahs = (json as { ayahs?: unknown }).ayahs ?? json;
      if (!Array.isArray(ayahs)) throw new Error("unexpected JSON shape");
      return buildSections(ayahs as RawAyah[]);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e; // cancelled — don't try the fallback
      lastErr = e;
    }
  }
  throw lastErr || new Error("fetch failed");
}

/**
 * This week's sections, from startAyah until the word budget is met. The budget
 * is a hard cap: sections are never added past it to seat extra readers, so an
 * over-subscribed week leaves some readers with an empty part. At least one
 * section is always returned (a single section may exceed the budget).
 */
export function pickWeek(sections: Section[], startAyah: number, wordBudget: number): Section[] {
  let start = sections.findIndex((s) => s.ayahEnd >= startAyah);
  if (start < 0) start = 0;
  const out: Section[] = [];
  let words = 0;
  for (let i = start; i < sections.length; i++) {
    out.push(sections[i]);
    words += sections[i].words;
    if (words >= wordBudget) break;
  }
  return out;
}

/**
 * Split indices for a contiguous, weight-proportional division of the week.
 * A DP over sections × readers minimises total squared deviation from each
 * reader's target word-count; solving it globally (not greedily) keeps the
 * allocation monotonic in weight — a heavier reader never gets fewer words.
 */
export function computeSplits(weekSections: Section[], weights: number[]): number[] {
  const n = weights.length;
  if (n <= 1) return [];
  const m = weekSections.length;
  if (m === 0) return new Array(n - 1).fill(0);

  const pre = [0];
  weekSections.forEach((s) => pre.push(pre[pre.length - 1] + s.words));
  const totalWords = pre[m];
  const W = weights.reduce((a, b) => a + b, 0) || n;
  const target = weights.map((w) => (totalWords * w) / W);

  // Each reader gets a section when there are enough; empty only if readers outnumber sections.
  const minEach = m >= n ? 1 : 0;

  // dp[i][k] = least squared-deviation cost of placing readers 0..i-1 over sections 0..k-1.
  const INF = Infinity;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
  const back = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(-1));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let k = i * minEach; k <= m; k++) {
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

  // Walk the boundaries back; the interior cuts are the splits.
  const bounds = new Array<number>(n + 1);
  bounds[n] = m;
  for (let i = n; i >= 1; i--) bounds[i - 1] = back[i][bounds[i]];
  return bounds.slice(1, n);
}

/** Materialise each member's contiguous portion (sections, words, ayah range) from the cuts. */
export function buildAssignments(
  weekSections: Section[],
  members: string[],
  splits: number[],
): Assignment[] {
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

/**
 * Where next week begins: the ayah after `weekEnd`, rolling over to the next
 * surah past a surah's final ayah (wrapping 114 → 1). A null `surahLastAyah`
 * (sections not loaded) never rolls over.
 */
export function nextStart(
  surah: number,
  startAyah: number,
  weekEnd: number | null | undefined,
  surahLastAyah: number | null,
): NextStart {
  const ayah = (weekEnd || startAyah) + 1;
  if (surahLastAyah != null && ayah > surahLastAyah) {
    return { surah: surah >= 114 ? 1 : surah + 1, ayah: 1, rollOver: true };
  }
  return { surah, ayah, rollOver: false };
}
