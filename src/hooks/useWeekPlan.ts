import { useState, useMemo } from "react";
import { pickWeek, computeSplits, buildAssignments } from "../utils/engine.ts";
import { sectionHeading } from "../utils/message.ts";
import type { BudgetMark, Config, Section, WeekPlan } from "../types.ts";

interface ManualSplits {
  key: string;
  splits: number[];
}
interface ManualOrder {
  key: string;
  order: number[];
}

/**
 * Derives one week's plan: sections → weekSections → splits → assignments.
 * Hand-tuned splits are stored against a key of the inputs they were tuned for;
 * once the inputs change the key stops matching and the algorithm takes over.
 */
export function useWeekPlan(
  sections: Section[],
  config: Config,
  members: string[],
  weights: number[],
): WeekPlan {
  const [manual, setManual] = useState<ManualSplits | null>(null);
  const [order, setOrderState] = useState<ManualOrder | null>(null);

  const weekSections = useMemo(() => {
    return pickWeek(sections, config.startAyah, config.wordBudget);
  }, [sections, config.startAyah, config.wordBudget]);

  // Cumulative word totals at each boundary, so the slider can snap onto a section.
  const budgetStops = useMemo(() => {
    let start = sections.findIndex((s) => s.ayahEnd >= config.startAyah);
    if (start < 0) start = 0;
    const stops: number[] = [];
    let sum = 0;
    for (let i = start; i < sections.length; i++) {
      sum += sections[i].words;
      stops.push(sum);
    }
    return stops;
  }, [sections, config.startAyah]);

  const budgetMarks = useMemo<BudgetMark[]>(() => {
    let start = sections.findIndex((s) => s.ayahEnd >= config.startAyah);
    if (start < 0) start = 0;
    const marks: BudgetMark[] = [];
    let before = 0;
    for (let i = start; i < sections.length; i++) {
      if (i > start)
        marks.push({ at: before, headed: sectionHeading(sections[i]) !== "Translation" });
      before += sections[i].words;
    }
    return marks;
  }, [sections, config.startAyah]);

  const snapBudget = (value: number): number => {
    if (!budgetStops.length) return value;
    let best = budgetStops[0];
    for (const stop of budgetStops) {
      if (Math.abs(stop - value) < Math.abs(best - value)) best = stop;
    }
    return Math.min(config.budgetMax, Math.max(config.budgetMin, best));
  };

  // remainingWords = words left to the surah's end; maxBudget = the slider's reach.
  const remainingWords = budgetStops.length
    ? budgetStops[budgetStops.length - 1]
    : config.budgetMax;
  const maxBudget = Math.min(config.budgetMax, Math.max(config.budgetMin, remainingWords));

  const algoSplits = useMemo(() => computeSplits(weekSections, weights), [weekSections, weights]);

  // Manual splits apply only while this key (week + algorithmic answer) matches.
  const splitsKey = `${weekSections.length}:${algoSplits.join(",")}`;
  const manualSplits = manual != null && manual.key === splitsKey;
  const splits = manualSplits ? manual.splits : algoSplits;

  const setSplits = (next: number[]) => setManual({ key: splitsKey, splits: next });

  // Who reads which positional portion. Keyed to the member set, so toggling a
  // reader drops a now-meaningless arrangement; portions themselves are untouched.
  const orderKey = members.join(" ");
  const reordered = order != null && order.key === orderKey;
  const memberOrder = useMemo(
    () => (reordered && order ? order.order : members.map((_, i) => i)),
    [reordered, order, members],
  );
  const setOrder = (next: number[]) => setOrderState({ key: orderKey, order: next });

  // Single undo for both kinds of hand-tuning — back to the weighted algorithm.
  const resetSplits = () => {
    setManual(null);
    setOrderState(null);
  };

  // Portions are positional; `memberOrder` fills each, and `ord` is the member's
  // original index so their colour stays put as they move across the bar.
  const orderedMembers = useMemo(() => memberOrder.map((i) => members[i]), [memberOrder, members]);
  const assignments = useMemo(
    () =>
      buildAssignments(weekSections, orderedMembers, splits).map((a, p) => ({
        ...a,
        ord: memberOrder[p],
      })),
    [weekSections, orderedMembers, splits, memberOrder],
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
    setOrder,
    reordered,
    resetSplits,
    snapBudget,
    maxBudget,
    remainingWords,
    budgetMarks,
  };
}
