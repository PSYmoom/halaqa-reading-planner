// Formatting helpers and the WhatsApp message builder.
import { surahName, quranLink, READING_WPM } from "../config/constants.js";

/** Rough aloud-reading time for a word count, e.g. "~8 min" or "~1 h 5 min". */
export function readingTime(words, wpm = READING_WPM) {
  const min = Math.max(1, Math.round(words / wpm));
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60),
    m = min % 60;
  return m ? `~${h} h ${m} min` : `~${h} h`;
}

/**
 * Human description of a reader's portion, with WhatsApp-bold (*…*) start/end anchors.
 * `prev` is the previous reader (for continuity). The start anchor is the ayah number when
 * the reader begins cleanly at a fresh ayah, or the first section's title when they pick up
 * partway through an ayah-block that's shared with the previous reader. A single section is
 * just named outright.
 */
export function describe(a, prev) {
  if (!a.sections.length) return "(no sections assigned)";
  const firstTitle = a.sections[0].title;
  const lastTitle = a.sections[a.sections.length - 1].title;
  const cleanStart = !prev || a.ayahStart > prev.ayahEnd;
  // A lone section picked up mid-shared-ayah: just name the topic.
  if (a.sections.length === 1 && !cleanStart) return `*${firstTitle}*`;
  const startAnchor = cleanStart ? `Ayat ${a.ayahStart}` : firstTitle;
  return `Start of *${startAnchor}* till the end of *${lastTitle}*`;
}

/** Compact ayah range for a section or assignment, e.g. "Ayat 130" or "Ayat 130–142". */
export function ayahRange(a) {
  if (a.ayahStart == null) return "—";
  return a.ayahStart === a.ayahEnd ? `Ayat ${a.ayahStart}` : `Ayat ${a.ayahStart}–${a.ayahEnd}`;
}

/**
 * A section's subheading, or "Translation" for plain (untitled) sections —
 * which carry a default "Ayat …" title in any of its cached generations.
 */
export const sectionHeading = (s) => (/^Ayat \d/.test(s.title || "") ? "Translation" : s.title);

/** The full WhatsApp message: intro, one line + link per reader, outro. */
export function generateMessage(surah, assignments, templates) {
  const intro = templates.intro.replace(/\{surah\}/g, `Surah ${surahName(surah)}`);
  const active = assignments.filter((a) => a.sections.length);
  const lines = active.map(
    (a, i) => `- ${a.name}: ${describe(a, active[i - 1])}\n  ${quranLink(surah, a.ayahStart)}`,
  );
  return [intro, "", ...lines, "", templates.outro].join("\n");
}
