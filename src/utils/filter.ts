import type { ComboOption } from "../types.ts";

/** Pure option filter for the Combobox — matches query against label, value and hint. */
export function filterOptions(options: ComboOption[], query: string): ComboOption[] {
  const s = query.trim().toLowerCase();
  if (!s) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(s) ||
      String(o.value).includes(s) ||
      (o.hint && o.hint.toLowerCase().includes(s)),
  );
}
