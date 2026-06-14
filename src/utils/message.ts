import { surahName, tafsirLink, READING_WPM } from "../config/constants.ts";
import type { Section, Assignment, Templates } from "../types.ts";

/** Aloud-reading time for a word count, e.g. "~8 min" or "~1 h 5 min". */
export function readingTime(words: number, wpm: number = READING_WPM): string {
  const min = Math.max(1, Math.round(words / wpm));
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60),
    m = min % 60;
  return m ? `~${h} h ${m} min` : `~${h} h`;
}

/** A reader's portion as prose with WhatsApp-bold (*…*) anchors; `prev` gives continuity. */
export function describe(a: Assignment, prev?: Assignment): string {
  if (!a.sections.length) return "(no sections assigned)";
  const firstTitle = a.sections[0].title;
  const lastTitle = a.sections[a.sections.length - 1].title;
  const cleanStart = !prev || (a.ayahStart ?? 0) > (prev.ayahEnd ?? 0);
  // A lone section picked up mid-shared-ayah: just name the topic.
  if (a.sections.length === 1 && !cleanStart) return `*${firstTitle}*`;
  const startAnchor = cleanStart ? `Ayat ${a.ayahStart}` : firstTitle;
  return `Start of *${startAnchor}* till the end of *${lastTitle}*`;
}

/** Compact ayah range, e.g. "Ayat 130" or "Ayat 130–142". */
export function ayahRange(a: { ayahStart: number | null; ayahEnd: number | null }): string {
  if (a.ayahStart == null) return "—";
  return a.ayahStart === a.ayahEnd ? `Ayat ${a.ayahStart}` : `Ayat ${a.ayahStart}–${a.ayahEnd}`;
}

/** A section's subheading, or "Translation" for default-titled ("Ayat …") sections. */
export const sectionHeading = (s: Section): string =>
  /^Ayat \d/.test(s.title || "") ? "Translation" : s.title;

/** The full WhatsApp message: intro, one line per reader, outro. */
export function generateMessage(
  surah: number,
  assignments: Assignment[],
  templates: Templates,
): string {
  const intro = templates.intro.replace(/\{surah\}/g, `Surah ${surahName(surah)}`);
  const active = assignments.filter((a) => a.sections.length);
  const lines = active.map(
    (a, i) => `- ${a.name}: ${describe(a, active[i - 1])} | ${tafsirLink(surah, a.ayahStart)}`,
  );
  return [intro, "", ...lines, "", templates.outro].join("\n");
}
