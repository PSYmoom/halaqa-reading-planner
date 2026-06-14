import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { COLORS } from "../config/constants.ts";
import { ayahRange, sectionHeading } from "../utils/message.ts";
import type { PositionedAssignment, Section } from "../types.ts";

/** Move item at `from` to slot `to` (a position in the current layout). */
function moveTo<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

interface SplitBarProps {
  weekSections: Section[];
  assignments: PositionedAssignment[];
  splits: number[];
  setSplits: (next: number[]) => void;
  setOrder: (next: number[]) => void;
}

/**
 * The stacked, draggable split bar. Dividers snap to section boundaries; names
 * drag to swap who reads which portion (a temporary reading-order override).
 */
export function SplitBar({
  weekSections,
  assignments,
  splits,
  setSplits,
  setOrder,
}: SplitBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pre = useMemo(() => {
    const p = [0];
    weekSections.forEach((s) => p.push(p[p.length - 1] + s.words));
    return p;
  }, [weekSections]);
  const total = pre[pre.length - 1] || 1;

  const bounds = useMemo(() => [0, ...splits, weekSections.length], [splits, weekSections.length]);
  const pctAt = (sectionIdx: number) => (pre[sectionIdx] / total) * 100;

  const [reorder, setReorder] = useState<{ from: number; to: number } | null>(null); // a name drag
  const [resizing, setResizing] = useState(false); // a divider drag is in flight

  // Divider drag: resize a portion by moving a section boundary.
  const onDrag = useCallback(
    (idx: number, clientX: number) => {
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

  // Route through a ref to the latest onDrag so a drag doesn't snap against
  // splits captured at pointerdown time.
  const onDragRef = useRef(onDrag);
  useEffect(() => {
    onDragRef.current = onDrag;
  });

  // Resize stops propagating so the same press doesn't also begin a reorder.
  const startDrag = (idx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    const move = (ev: PointerEvent) => onDragRef.current(idx, ev.clientX);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setResizing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  // Name drag: reorder who reads which portion (positions stay put). Initiated
  // from the bar, not the labels, so the section overlay keeps hovering.
  const order = useMemo(() => assignments.map((a) => a.ord), [assignments]);
  const nameByOrd = useMemo(() => {
    const m: Record<number, string> = {};
    assignments.forEach((a) => (m[a.ord] = a.name));
    return m;
  }, [assignments]);

  // Which positional slot a pointer x falls in, given the current cuts.
  const slotAt = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      let slot = 0;
      for (let p = 0; p < order.length; p++) {
        if (x >= (pre[bounds[p]] / total) * rect.width) slot = p;
      }
      return slot;
    },
    [order.length, pre, bounds, total],
  );

  const startReorder = (e: React.PointerEvent<HTMLDivElement>) => {
    if (order.length < 2) return; // nothing to reorder with a lone reader
    e.preventDefault();
    const from = slotAt(e.clientX);
    setReorder({ from, to: from });
    const move = (ev: PointerEvent) => {
      const to = slotAt(ev.clientX);
      setReorder((r) => (r && r.to === to ? r : { from, to }));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setReorder((r) => {
        if (r && r.from !== r.to) setOrder(moveTo(order, r.from, r.to));
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  // While dragging, preview the rearranged order; portions stay positional.
  const view = reorder ? moveTo(order, reorder.from, reorder.to) : order;

  return (
    <div
      className={"bar" + (reorder ? " reordering" : "") + (resizing ? " resizing" : "")}
      ref={ref}
      onPointerDown={startReorder}
    >
      {view.map((ord, p) => {
        const left = pctAt(bounds[p]);
        const pct = pctAt(bounds[p + 1]) - left;
        const slot = assignments[p]; // positional portion stats for this slot
        const name = nameByOrd[ord];
        const grabbed = reorder && reorder.to === p;
        return (
          <div
            key={ord}
            className={"seg" + (grabbed ? " grabbed" : "")}
            style={{ left: left + "%", width: pct + "%", background: COLORS[ord % COLORS.length] }}
          >
            {pct > 8 ? (
              <span className="segLabel">
                <span className="segDots" aria-hidden="true">
                  ⠿
                </span>
                <b>{name}</b>
                {pct > 15 && <em>{slot.words}w</em>}
              </span>
            ) : (
              <span className="segGrip" aria-hidden="true">
                ⠿
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
