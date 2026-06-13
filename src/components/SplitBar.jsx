import { useRef, useMemo, useEffect, useCallback } from "react";
import { COLORS } from "../config/constants.js";
import { ayahRange, sectionHeading } from "../utils/message.js";

/** The stacked, draggable split bar. Dividers snap to section boundaries. */
export function SplitBar({ weekSections, assignments, splits, setSplits }) {
  const ref = useRef(null);
  const pre = useMemo(() => {
    const p = [0];
    weekSections.forEach((s) => p.push(p[p.length - 1] + s.words));
    return p;
  }, [weekSections]);
  const total = pre[pre.length - 1] || 1;

  const bounds = useMemo(() => [0, ...splits, weekSections.length], [splits, weekSections.length]);
  const pctAt = (sectionIdx) => (pre[sectionIdx] / total) * 100;

  const onDrag = useCallback(
    (idx, clientX) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const targetWords = frac * total;
      // snap to nearest section boundary, constrained between neighbours
      const lo = idx === 0 ? 0 : splits[idx - 1];
      const hi = idx === splits.length - 1 ? weekSections.length : splits[idx + 1];
      let best = lo,
        bestD = Infinity;
      for (let k = lo; k <= hi; k++) {
        const d = Math.abs(pre[k] - targetWords);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      if (best !== splits[idx]) {
        const next = splits.slice();
        next[idx] = best;
        setSplits(next);
      }
    },
    [splits, pre, total, weekSections.length, setSplits],
  );

  // The window listeners are registered once per drag, so route them through a
  // ref to the latest onDrag — otherwise the whole drag would close over the
  // splits from pointerdown-time and snap against stale neighbours.
  const onDragRef = useRef(onDrag);
  useEffect(() => {
    onDragRef.current = onDrag;
  });

  const startDrag = (idx) => (e) => {
    e.preventDefault();
    const move = (ev) => onDragRef.current(idx, ev.clientX);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <div className="bar" ref={ref}>
      {assignments.map((a, i) => {
        const left = pctAt(bounds[i]);
        const pct = pctAt(bounds[i + 1]) - left;
        return (
          <div
            key={a.name}
            className="seg"
            style={{ left: left + "%", width: pct + "%", background: COLORS[i % COLORS.length] }}
            title={`${a.name}: ${a.words} words, ${a.sections.length} sections`}
          >
            {pct > 8 && (
              <span className="segLabel">
                <b>{a.name}</b>
                {pct > 15 && <em>{a.words}w</em>}
              </span>
            )}
          </div>
        );
      })}
      {splits.map((s, i) => (
        <div
          key={i}
          className="handle"
          style={{ left: pctAt(s) + "%" }}
          onPointerDown={startDrag(i)}
          title="Drag to move sections between people"
        />
      ))}
      <div className="secOverlay">
        {weekSections.map((s, i) => {
          const heading = sectionHeading(s);
          const headed = heading !== "Translation";
          return (
            <div
              key={i}
              className={"secCell" + (headed ? " headed" : " plain") + (i === 0 ? " first" : "")}
              style={{ left: (pre[i] / total) * 100 + "%", width: (s.words / total) * 100 + "%" }}
              title={`${ayahRange(s)} · ${heading} · ${s.words}w`}
            />
          );
        })}
      </div>
    </div>
  );
}
