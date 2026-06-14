import { useState, useRef, useMemo, useEffect } from "react";
import { filterOptions } from "../utils/filter.ts";
import type { ComboOption } from "../types.ts";

interface ComboboxProps {
  options: ComboOption[];
  value: number | string | null | undefined;
  display: string;
  placeholder: string;
  onSelect: (value: number | string) => void;
  allowNumber?: boolean;
  onNumber?: (n: number) => void;
}

/**
 * Searchable, keyboard-navigable select over `options` (filtered on label,
 * value, hint). `allowNumber`/`onNumber` commit a typed number with no match.
 */
export function Combobox({
  options,
  value,
  display,
  placeholder,
  onSelect,
  allowNumber,
  onNumber,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const opening = useRef(false); // highlight came from opening, not arrowing

  const filtered = useMemo(() => filterOptions(options, q), [q, options]);

  // With no query, highlight the selected option and pull it to the top of the list.
  useEffect(() => {
    if (!open) return;
    if (q) {
      setHi(0);
      return;
    }
    let idx = filtered.findIndex((o) => o.value === value);
    if (idx < 0 && typeof value === "number") {
      // no exact match (e.g. a mid-section ayah) — land on the last option at/below it
      for (let i = 0; i < filtered.length; i++) {
        if (typeof filtered[i].value === "number" && (filtered[i].value as number) <= value)
          idx = i;
      }
    }
    if (idx < 0) idx = 0;
    setHi(idx);
    opening.current = true;
    // Scroll the list only (scrollIntoView would scroll the page too).
    const list = listRef.current,
      el = list?.children[idx];
    if (list && el)
      list.scrollTop += el.getBoundingClientRect().top - list.getBoundingClientRect().top;
  }, [q, open, filtered, value]);

  // Keep the highlighted row visible while arrowing, without fighting the on-open alignment.
  useEffect(() => {
    if (!open) return;
    if (opening.current) {
      opening.current = false;
      return;
    }
    const list = listRef.current,
      el = list?.children[hi];
    if (!list || !el) return;
    const lr = list.getBoundingClientRect(),
      er = el.getBoundingClientRect();
    if (er.top < lr.top) list.scrollTop += er.top - lr.top;
    else if (er.bottom > lr.bottom) list.scrollTop += er.bottom - lr.bottom;
  }, [hi, open]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const close = () => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  };
  const choose = (o: ComboOption) => {
    onSelect(o.value);
    close();
  };
  const commitNumber = (): boolean => {
    if (allowNumber && onNumber && /^\d+$/.test(q.trim())) {
      onNumber(+q.trim());
      close();
      return true;
    }
    return false;
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[hi]) choose(filtered[hi]);
      else commitNumber();
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <div className="combo" ref={ref}>
      <input
        ref={inputRef}
        type="text"
        value={open ? q : display}
        placeholder={open ? display || placeholder : placeholder}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKey}
      />
      {open && (
        <div className="comboList" ref={listRef}>
          {filtered.length ? (
            filtered.slice(0, 500).map((o, i) => (
              <div
                key={o.key ?? `${o.value}|${o.hint || ""}`}
                className={"comboItem" + (i === hi ? " hi" : "")}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  choose(o);
                }}
              >
                <span className="comboLabel">{o.label}</span>
                {o.hint && <span className="comboHint">{o.hint}</span>}
              </div>
            ))
          ) : allowNumber && /^\d+$/.test(q.trim()) ? (
            <div
              className="comboItem"
              onMouseDown={(ev) => {
                ev.preventDefault();
                commitNumber();
              }}
            >
              <span className="comboLabel">Go to Ayat {q.trim()}</span>
            </div>
          ) : (
            <div className="comboEmpty">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
