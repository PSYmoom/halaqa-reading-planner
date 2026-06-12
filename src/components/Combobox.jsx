import { useState, useRef, useMemo, useEffect } from "react";
import { filterOptions } from "../filter.js";

/**
 * Searchable, scrollable, keyboard-navigable select.
 * `options`: [{ value, label, hint?, key? }] — filtered on label, value and hint.
 * `allowNumber` + `onNumber` let the user commit a typed number with no matching option.
 */
export function Combobox({ options, display, placeholder, onSelect, allowNumber, onNumber }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => filterOptions(options, q), [q, options]);

  useEffect(() => { setHi(0); }, [q, open]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const close = () => { setOpen(false); setQ(""); inputRef.current?.blur(); };
  const choose = (o) => { onSelect(o.value); close(); };
  const commitNumber = () => {
    if (allowNumber && /^\d+$/.test(q.trim())) { onNumber(+q.trim()); close(); return true; }
    return false;
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[hi]) choose(filtered[hi]); else commitNumber(); }
    else if (e.key === "Escape") { close(); }
  };

  return (
    <div className="combo" ref={ref}>
      <input
        ref={inputRef}
        type="text"
        value={open ? q : display}
        placeholder={open ? (display || placeholder) : placeholder}
        onFocus={() => { setOpen(true); setQ(""); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={onKey}
      />
      {open && (
        <div className="comboList">
          {filtered.length ? (
            filtered.slice(0, 500).map((o, i) => (
              <div
                key={o.key ?? `${o.value}|${o.hint || ""}`}
                className={"comboItem" + (i === hi ? " hi" : "")}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(ev) => { ev.preventDefault(); choose(o); }}
              >
                <span className="comboLabel">{o.label}</span>
                {o.hint && <span className="comboHint">{o.hint}</span>}
              </div>
            ))
          ) : allowNumber && /^\d+$/.test(q.trim()) ? (
            <div className="comboItem" onMouseDown={(ev) => { ev.preventDefault(); commitNumber(); }}>
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
