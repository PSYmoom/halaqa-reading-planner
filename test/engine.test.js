// Unit tests for the pure engine. Run with `npm test` (node --test, no deps).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isHeading, wordCount, buildSections, pickWeek, computeSplits, buildAssignments,
} from "../src/utils/engine.js";

// Fixture: n sections, one ayah each (ayah i+1), with the given word counts.
const secs = (words) =>
  words.map((w, i) => ({ title: `s${i}`, words: w, ayahStart: i + 1, ayahEnd: i + 1 }));

describe("isHeading", () => {
  test("accepts Title-Case headings", () => {
    assert.equal(isHeading("Virtues of Surat Al-Kahf"), true);
    assert.equal(isHeading("The Story of the People of the Cave"), true);
  });
  test("rejects prose (ends with punctuation)", () => {
    assert.equal(isHeading("Allah tells us about the people of the cave."), false);
  });
  test("rejects lowercase lines", () => {
    assert.equal(isHeading("the story of the cave"), false);
  });
  test("accepts headings with a trailing honorific, e.g. (ﷺ)", () => {
    // The honorific's ")" must not be mistaken for prose-ending punctuation.
    assert.equal(isHeading("Comforting the Messenger of Allah (ﷺ)"), true);
    assert.equal(isHeading("The Story of Musa (عليه السلام)"), true);
  });
  test("still rejects an English parenthetical aside (no Arabic inside)", () => {
    assert.equal(isHeading("Well-Acquainted with all that you do.)"), false);
  });
  test("rejects Arabic, quotes, empty, single-word, and over-long lines", () => {
    assert.equal(isHeading("بسم الله الرحمن الرحيم"), false);
    assert.equal(isHeading('"And They Stayed In Their Cave"'), false);
    assert.equal(isHeading(""), false);
    assert.equal(isHeading("   "), false);
    assert.equal(isHeading("Introduction"), false);
    assert.equal(isHeading("Very Long Heading ".repeat(8)), false);
  });
});

describe("wordCount", () => {
  test("counts whitespace-separated tokens", () => {
    assert.equal(wordCount("one two three"), 3);
    assert.equal(wordCount("  a   b  "), 2);
    assert.equal(wordCount(""), 0);
  });
});

describe("buildSections", () => {
  test("sorts ayahs, collapses identical commentary, splits at headings", () => {
    const sections = buildSections([
      { ayah: 2, text: "Shared commentary text" },
      { ayah: 1, text: "Shared commentary text" },
      { ayah: 3, text: "Which was Revealed in Makkah\nSome plain prose follows here." },
    ]);
    assert.equal(sections.length, 2);
    // identical text on ayahs 1–2 collapses into one block; the default title spans the range
    assert.equal(sections[0].title, "Ayat 1–2");
    assert.equal(sections[0].ayahStart, 1);
    assert.equal(sections[0].ayahEnd, 2);
    assert.equal(sections[0].words, 3);
    // the heading line becomes the section title; the body is counted
    assert.equal(sections[1].title, "Which was Revealed in Makkah");
    assert.equal(sections[1].words, 5);
  });
  test("splits at a heading carrying a trailing honorific", () => {
    const sections = buildSections([
      { ayah: 176, text: "...all that you do.)\nComforting the Messenger of Allah (ﷺ)\nAllah said to His Prophet." },
    ]);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].title, "Ayat 176");          // the translation, untitled
    assert.equal(sections[1].title, "Comforting the Messenger of Allah (ﷺ)");
  });
  test("skips empty ayah texts", () => {
    assert.deepEqual(buildSections([{ ayah: 1, text: "  " }]), []);
  });
  test("single-ayah untitled section gets a single-ayah title", () => {
    const [s] = buildSections([{ ayah: 5, text: "Lone commentary words here" }]);
    assert.equal(s.title, "Ayat 5");
  });
});

describe("pickWeek", () => {
  test("stops once the word budget is met", () => {
    assert.equal(pickWeek(secs([100, 100, 100]), 1, 150, 1).length, 2);
  });
  test("includes at least minSections even under a tiny budget", () => {
    assert.equal(pickWeek(secs([100, 100, 100]), 1, 50, 3).length, 3);
  });
  test("returns everything when minSections exceeds what's available", () => {
    assert.equal(pickWeek(secs([100, 100, 100]), 1, 50, 5).length, 3);
  });
  test("starts at the section containing startAyah", () => {
    const week = pickWeek(secs([100, 100, 100]), 2, 1000, 1);
    assert.equal(week[0].ayahStart, 2);
    assert.equal(week.length, 2);
  });
  test("falls back to the first section when startAyah is past the end", () => {
    const week = pickWeek(secs([100, 100]), 99, 100, 1);
    assert.equal(week[0].ayahStart, 1);
  });
});

describe("computeSplits", () => {
  test("single reader → no cuts", () => {
    assert.deepEqual(computeSplits(secs([100, 100]), [5]), []);
  });
  test("zero sections → all cuts at 0", () => {
    assert.deepEqual(computeSplits([], [1, 1]), [0]);
  });
  test("equal weights split evenly", () => {
    assert.deepEqual(computeSplits(secs([100, 100, 100, 100]), [1, 1]), [2]);
  });
  test("weights split proportionally (3:1 over 400 words → cut at 3)", () => {
    assert.deepEqual(computeSplits(secs([100, 100, 100, 100]), [3, 1]), [3]);
  });
  test("everyone gets a section when sections ≥ readers", () => {
    assert.deepEqual(computeSplits(secs([100, 100, 100]), [1, 1, 1]), [1, 2]);
  });
  test("readers > sections: cuts stay valid and all sections are assigned once", () => {
    const week = secs([100, 100]);
    const splits = computeSplits(week, [1, 1, 1]);
    assert.equal(splits.length, 2);
    let prev = 0;
    for (const s of splits) {
      assert.ok(s >= prev && s <= week.length, `cut ${s} out of order or range`);
      prev = s;
    }
    const total = buildAssignments(week, ["A", "B", "C"], splits)
      .reduce((sum, a) => sum + a.words, 0);
    assert.equal(total, 200);
  });
  test("monotonic in weight: heavier never reads less", () => {
    const week = secs(new Array(10).fill(100));
    const splits = computeSplits(week, [1, 9]);
    const [light, heavy] = buildAssignments(week, ["L", "H"], splits);
    assert.ok(heavy.words > light.words, `expected ${heavy.words} > ${light.words}`);
  });
});

describe("buildAssignments", () => {
  test("contiguous portions with correct words and ayah ranges", () => {
    const [a, b] = buildAssignments(secs([10, 20, 30]), ["A", "B"], [1]);
    assert.equal(a.words, 10);
    assert.equal(a.ayahStart, 1);
    assert.equal(a.ayahEnd, 1);
    assert.equal(b.words, 50);
    assert.equal(b.ayahStart, 2);
    assert.equal(b.ayahEnd, 3);
  });
  test("empty portion → null range, zero words", () => {
    const [a, b] = buildAssignments(secs([10, 20]), ["A", "B"], [0]);
    assert.equal(a.words, 0);
    assert.equal(a.ayahStart, null);
    assert.equal(b.words, 30);
  });
});
