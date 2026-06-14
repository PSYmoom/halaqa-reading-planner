// Domain model — one source of truth for the shapes the engine, hooks, and
// components share.

/** An availability tier; `members[0]` is the rotation front. */
export interface Bucket {
  id: string;
  members: string[];
}

/** Intro/outro text wrapped around the generated reading list. */
export interface Templates {
  intro: string;
  outro: string;
}

/** Persisted app configuration (localStorage). */
export interface Config {
  buckets: Bucket[];
  weights: Record<string, number>;
  surah: number;
  startAyah: number;
  wordBudget: number;
  readingWpm: number;
  budgetMin: number;
  budgetMax: number;
  templates: Templates;
}

/** A unit of tafsir: a titled (or default-titled) span over an ayah range. */
export interface Section {
  title: string;
  words: number;
  ayahStart: number;
  ayahEnd: number;
}

/** One reader's contiguous portion of the week. */
export interface Assignment {
  name: string;
  sections: Section[];
  words: number;
  ayahStart: number | null;
  ayahEnd: number | null;
}

/** An assignment in a positional slot; `ord` is the original member index (stable colour). */
export interface PositionedAssignment extends Assignment {
  ord: number;
}

/** Where next week begins (rolls over to the next surah at a surah's end). */
export interface NextStart {
  surah: number;
  ayah: number;
  rollOver: boolean;
}

/** A budget-slider tick at `at` cumulative words; `headed` lands on a subheading. */
export interface BudgetMark {
  at: number;
  headed: boolean;
}

/** A searchable Combobox option. */
export interface ComboOption {
  value: number | string;
  label: string;
  hint?: string;
  key?: string | number;
}

/** A transient toast notification with an optional action button. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}
export interface Toast {
  message: string;
  action: ToastAction | null;
}

/** Async fetch lifecycle as a tagged union — no impossible loading+error states. */
export type FetchStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string };

/** Return shape of `useReaders`. */
export interface Readers {
  reading: Set<string>;
  members: string[];
  weights: number[];
  offCount: number;
  togglesActive: boolean;
  toggleReader: (name: string) => void;
  clearReaderToggles: () => void;
  rotateBuckets: () => Bucket[];
  resetWeek: () => void;
}

/** Return shape of `useWeekPlan`. */
export interface WeekPlan {
  weekSections: Section[];
  assignments: PositionedAssignment[];
  totalWords: number;
  weekStart: number | undefined;
  weekEnd: number | undefined;
  splits: number[];
  setSplits: (next: number[]) => void;
  manualSplits: boolean;
  setOrder: (next: number[]) => void;
  reordered: boolean;
  resetSplits: () => void;
  snapBudget: (value: number) => number;
  maxBudget: number;
  remainingWords: number;
  budgetMarks: BudgetMark[];
}
