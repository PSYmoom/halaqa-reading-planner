// The stacked, draggable split bar. Dividers snap to section boundaries.
import { Fragment, useRef, useMemo, useCallback } from "react";
import { COLORS } from "../constants.js";

export function SplitBar({ weekSections, assignments, splits, setSplits }) {
  const ref = useRef(null);
  const pre = useMemo(() => {
    const p = [0];
    weekSections.forEach((s) => p.push(p[p.length - 1] + s.words));
    return p;
  }, [weekSections]);
  const total = pre[pre.length - 1] || 1;

  const onDrag = useCallback((idx, clientX) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const targetWords = frac * total;
    // snap to nearest section boundary, constrained between neighbours
    const lo = idx === 0 ? 0 : splits[idx - 1];
    const hi = idx === splits.length - 1 ? weekSections.length : splits[idx + 1];
    let best = lo, bestD = Infinity;
    for (let k = lo; k <= hi; k++) {
      const d = Math.abs(pre[k] - targetWords);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best !== splits[idx]) {
      const next = splits.slice(); next[idx] = best; setSplits(next);
    }
  }, [splits, pre, total, weekSections.length, setSplits]);

  const startDrag = (idx) => (e) => {
    e.preventDefault();
    const move = (ev) => onDrag(idx, (ev.touches ? ev.touches[0] : ev).clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="bar" ref={ref}>
      {assignments.map((a, i) => {
        const pct = (a.words / total) * 100;
        return (
          <Fragment key={a.name}>
            <div className="seg" style={{ width: pct + "%", background: COLORS[i % COLORS.length] }}
                 title={`${a.name}: ${a.words} words, ${a.sections.length} sections`}>
              {pct > 8 ? `${a.name} · ${a.words}w` : ""}
            </div>
            {i < assignments.length - 1 && (
              <div className="handle" onPointerDown={startDrag(i)} title="Drag to move sections between people" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
