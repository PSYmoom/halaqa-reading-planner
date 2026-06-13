import { useState, useMemo } from "react";
import { pickWeek, computeSplits, buildAssignments } from "../utils/engine.js";
import { sectionHeading } from "../utils/message.js";

/**
 * The derivation pipeline for one week's plan:
 *   sections → weekSections → splits → assignments (+ coverage totals).
 * Consumers only see the end results, never the intermediate steps.
 *
 * Splits are derived, not synced: the algorithmic split applies unless the
 * user has hand-tuned this exact week. Manual splits are stored together with
 * a key of the inputs they were tuned against; when the inputs change, the
 * key stops matching and the algorithmic split takes over — no effect, no
 * stale frame.
 */
export function useWeekPlan(sections, config, members, weights) {
  const [manual, setManual] = useState(null); // { key, splits } | null

  // The sections this week covers, given the start ayah and word budget.
  const weekSections = useMemo(() => {
    if (!sections) return [];
    return pickWeek(sections, config.startAyah, config.wordBudget, Math.max(1, members.length));
  }, [sections, config.startAyah, config.wordBudget, members.length]);

  // Cumulative word totals at each section boundary from the start ayah, so the budget
  // slider can snap to land coverage exactly on a section (instead of mid-section).
  const budgetStops = useMemo(() => {
    if (!sections) return [];
    let start = sections.findIndex((s) => s.ayahEnd >= config.startAyah);
    if (start < 0) start = 0;
    const stops = [];
    let sum = 0;
    for (let i = start; i < sections.length; i++) {
      sum += sections[i].words;
      stops.push(sum);
    }
    return stops;
  }, [sections, config.startAyah]);

  const budgetMarks = useMemo(() => {
    if (!sections) return [];
    let start = sections.findIndex((s) => s.ayahEnd >= config.startAyah);
    if (start < 0) start = 0;
    const marks = [];
    let before = 0; // cumulative words before the current section
    for (let i = start; i < sections.length; i++) {
      if (i > start)
        marks.push({ at: before, headed: sectionHeading(sections[i]) !== "Translation" });
      before += sections[i].words;
    }
    return marks;
  }, [sections, config.startAyah]);

  const snapBudget = (value) => {
    if (!budgetStops.length) return value;
    let best = budgetStops[0];
    for (const stop of budgetStops) {
      if (Math.abs(stop - value) < Math.abs(best - value)) best = stop;
    }
    return Math.min(config.budgetMax, Math.max(config.budgetMin, best));
  };

  // Two distinct ceilings, kept separate on purpose:
  //  • remainingWords — words left to the END OF THE SURAH from this start ayah.
  //  • maxBudget      — how far the slider can travel
  const remainingWords = budgetStops.length
    ? budgetStops[budgetStops.length - 1]
    : config.budgetMax;
  const maxBudget = Math.min(config.budgetMax, Math.max(config.budgetMin, remainingWords));

  const algoSplits = useMemo(() => computeSplits(weekSections, weights), [weekSections, weights]);

  // Identifies "the same week with the same algorithmic answer". Hand-tuned
  // splits only apply while this key matches the one they were saved under.
  const splitsKey = `${weekSections.length}:${algoSplits.join(",")}`;
  const manualSplits = manual != null && manual.key === splitsKey;
  const splits = manualSplits ? manual.splits : algoSplits;

  const setSplits = (next) => setManual({ key: splitsKey, splits: next });
  const resetSplits = () => setManual(null);

  const assignments = useMemo(
    () => buildAssignments(weekSections, members, splits),
    [weekSections, members, splits],
  );

  const totalWords = weekSections.reduce((sum, s) => sum + s.words, 0);
  const weekStart = weekSections[0]?.ayahStart;
  const weekEnd = weekSections[weekSections.length - 1]?.ayahEnd;

  return {
    weekSections,
    assignments,
    totalWords,
    weekStart,
    weekEnd,
    splits,
    setSplits,
    manualSplits,
    resetSplits,
    snapBudget,
    maxBudget,
    remainingWords,
    budgetMarks,
  };
}
