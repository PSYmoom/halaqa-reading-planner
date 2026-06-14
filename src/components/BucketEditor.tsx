import { useState, useEffect, useRef } from "react";
import { DEFAULT_WEIGHT } from "../config/constants.ts";
import type { Bucket, Config, ToastAction } from "../types.ts";

let _seq = 0;
const newId = (): string => `b${Date.now().toString(36)}${(_seq++).toString(36)}`;
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

interface Draft {
  buckets: Bucket[];
  weights: Record<string, number>;
}

/** What the user is currently dragging. */
type DragPayload =
  | { kind: "member"; bi: number; index: number }
  | { kind: "bucket"; index: number };

/** Where the drop would land (the highlighted gap or bucket). */
type OverTarget = { kind: "member"; bi: number; index: number } | { kind: "bucket"; bi: number };

interface BucketEditorProps {
  config: Config;
  setConfig: (next: Config) => void;
  reading?: Set<string>;
  toggleReader?: (name: string) => void;
  hasToggles: boolean;
  clearToggles?: () => void;
  flash?: (message: string, action?: ToastAction | null) => void;
}

/**
 * Availability-tier buckets with drag-and-drop, staged in a local draft and
 * committed on "Save changes". Drag a grip (⠿) to move members, the hamburger
 * (☰) to reorder buckets, or click a name to toggle who reads this week.
 */
export function BucketEditor({
  config,
  setConfig,
  reading = new Set<string>(),
  toggleReader,
  hasToggles,
  clearToggles,
  flash,
}: BucketEditorProps) {
  const [draft, setDraft] = useState<Draft>({ buckets: config.buckets, weights: config.weights });
  const [dirty, setDirty] = useState(false);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [over, setOver] = useState<OverTarget | null>(null);
  const dragRef = useRef<DragPayload | null>(null); // mirror of `drag`, readable in native handlers
  const [addingTo, setAddingTo] = useState<number | null>(null); // bucket index with the add-member input
  const [newName, setNewName] = useState("");
  const cancelAddRef = useRef(false); // set when Escape should discard the add

  // Resync the draft when the saved config changes externally, but never clobber unsaved edits.
  useEffect(() => {
    if (!dirty) setDraft({ buckets: config.buckets, weights: config.weights });
  }, [config.buckets, config.weights, dirty]);

  const apply = (next: Draft) => {
    setDraft(next);
    setDirty(true);
  };
  const setBuckets = (buckets: Bucket[]) => apply({ ...draft, buckets });

  const save = () => {
    setConfig({ ...config, buckets: draft.buckets, weights: draft.weights });
    setDirty(false);
  };
  const discard = () => {
    setDraft({ buckets: config.buckets, weights: config.weights });
    setDirty(false);
    clearToggles?.(); // also drop this week's reader toggles
  };

  // Structural edits (draft only).
  const setWeight = (name: string, w: number) =>
    apply({ ...draft, weights: { ...draft.weights, [name]: w } });
  const startAdd = (bi: number) => {
    setAddingTo(bi);
    setNewName("");
    cancelAddRef.current = false;
  };
  // Enter/blur commits, Escape discards — both routed through onBlur so it commits once.
  const finishAdd = (bi: number) => {
    const name = newName.trim();
    if (!cancelAddRef.current && name) {
      // Names are the identity key, so keep them unique across the roster (case-insensitively).
      const exists = draft.buckets.some((b) =>
        b.members.some((m) => m.toLowerCase() === name.toLowerCase()),
      );
      if (exists) {
        flash?.(`"${name}" is already on the roster — names must be unique`);
      } else {
        const buckets = draft.buckets.map((b, i) =>
          i === bi ? { ...b, members: [...b.members, name] } : b,
        );
        const weights =
          draft.weights[name] == null
            ? { ...draft.weights, [name]: DEFAULT_WEIGHT }
            : draft.weights;
        apply({ buckets, weights });
      }
    }
    cancelAddRef.current = false;
    setAddingTo(null);
    setNewName("");
  };
  const removeMember = (bi: number, name: string) =>
    setBuckets(
      draft.buckets.map((b, i) =>
        i === bi ? { ...b, members: b.members.filter((m) => m !== name) } : b,
      ),
    );
  const addBucket = () => setBuckets([...draft.buckets, { id: newId(), members: [] }]);
  const removeBucket = (bi: number) => setBuckets(draft.buckets.filter((_, i) => i !== bi));

  const moveMember = (from: { bi: number; index: number }, toBi: number, toIndex: number) => {
    const buckets = draft.buckets.map((b) => ({ ...b, members: [...b.members] }));
    const [m] = buckets[from.bi].members.splice(from.index, 1);
    let ti = toIndex;
    if (from.bi === toBi && from.index < toIndex) ti -= 1;
    buckets[toBi].members.splice(ti, 0, m);
    const weights =
      draft.weights[m] == null ? { ...draft.weights, [m]: DEFAULT_WEIGHT } : draft.weights;
    apply({ buckets, weights });
  };
  const moveBucket = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const buckets = draft.buckets.slice();
    const [b] = buckets.splice(fromIdx, 1);
    buckets.splice(toIdx, 0, b);
    setBuckets(buckets);
  };

  // Native drag-and-drop plumbing.
  const startDrag = (payload: DragPayload) => (e: React.DragEvent<HTMLSpanElement>) => {
    dragRef.current = payload;
    setDrag(payload);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
    const ghost = e.currentTarget.closest(payload.kind === "member" ? ".memberRow" : ".bucketRow");
    if (ghost) e.dataTransfer.setDragImage(ghost, 12, 12);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDrag(null);
    setOver(null);
  };
  const setOverIf = (o: OverTarget | null) => setOver((prev) => (eq(prev, o) ? prev : o));

  // Drop into the gap nearest the cursor: left half of a chip → before it, right half → after.
  const gapAt = (e: React.DragEvent, idx: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX > r.left + r.width / 2 ? idx + 1 : idx;
  };
  const onChipOver = (bi: number, idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (dragRef.current?.kind !== "member") return;
    e.preventDefault();
    e.stopPropagation();
    setOverIf({ kind: "member", bi, index: gapAt(e, idx) });
  };
  const onChipDrop = (bi: number, idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d?.kind !== "member") return;
    e.preventDefault();
    e.stopPropagation();
    moveMember(d, bi, gapAt(e, idx));
    endDrag();
  };
  const onBucketEndOver = (bi: number, len: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (dragRef.current?.kind !== "member") return;
    e.preventDefault();
    e.stopPropagation();
    setOverIf({ kind: "member", bi, index: len });
  };
  const onBucketEndDrop = (bi: number, len: number) => (e: React.DragEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d?.kind !== "member") return;
    e.preventDefault();
    moveMember(d, bi, len);
    endDrag();
  };
  const onBucketRowOver = (bi: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (dragRef.current?.kind !== "bucket") return;
    e.preventDefault();
    e.stopPropagation();
    setOverIf({ kind: "bucket", bi });
  };

  const onContainerDragOver = () => setOverIf(null);
  const onContainerDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIf(null);
  };
  const onBucketRowDrop = (bi: number) => (e: React.DragEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d?.kind !== "bucket") return;
    e.preventDefault();
    moveBucket(d.index, bi);
    endDrag();
  };

  return (
    <div className="card" onDragOver={onContainerDragOver} onDragLeave={onContainerDragLeave}>
      <h2>Pick — click members to select readers</h2>

      {draft.buckets.map((b, bi) => {
        // "off": a bucket with members but nobody reading this week.
        const off = b.members.length > 0 && !b.members.some((m) => reading.has(m));
        const isOverBucket = over?.kind === "bucket" && over.bi === bi;
        const isEndOver =
          over?.kind === "member" && over.bi === bi && over.index === b.members.length;
        return (
          <div
            className={"bucketRow" + (isOverBucket ? " overBucket" : "") + (off ? " off" : "")}
            key={b.id}
            onDragOver={onBucketRowOver(bi)}
            onDrop={onBucketRowDrop(bi)}
          >
            <span
              className="bhandle"
              draggable
              onDragStart={startDrag({ kind: "bucket", index: bi })}
              onDragEnd={endDrag}
              title="Drag to reorder bucket"
            >
              ☰
            </span>
            <div className="chips">
              {b.members.map((m, idx) => {
                const isFront = m === b.members[0]; // the bucket's default reader
                const isReading = reading.has(m);
                const isDragging = drag?.kind === "member" && drag.bi === bi && drag.index === idx;
                const isBefore = over?.kind === "member" && over.bi === bi && over.index === idx;
                return (
                  <div
                    key={m}
                    className={
                      "memberRow" +
                      (isReading ? " reader" : "") +
                      (isDragging ? " dragging" : "") +
                      (isBefore ? " dropBefore" : "")
                    }
                    onDragOver={onChipOver(bi, idx)}
                    onDrop={onChipDrop(bi, idx)}
                  >
                    <span
                      className="grip"
                      draggable
                      onDragStart={startDrag({ kind: "member", bi, index: idx })}
                      onDragEnd={endDrag}
                      title="Drag to reorder / move to another bucket"
                    >
                      ⠿
                    </span>
                    <span
                      className="readToggle"
                      onClick={() => toggleReader?.(m)}
                      title={
                        isReading
                          ? `"${m}" reads this week — click to bench`
                          : `"${m}" does not read this week — click to select`
                      }
                    >
                      <span className="mName">{m}</span>
                      <span className="readsSlot">
                        {/* always rendered (hidden, not removed) so the column keeps its width */}
                        <span
                          className={
                            "tag next" + (isFront ? "" : " extra") + (isReading ? "" : " ghost")
                          }
                        >
                          reads
                        </span>
                      </span>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={draft.weights[m] ?? DEFAULT_WEIGHT}
                      title={`weight ${draft.weights[m] ?? DEFAULT_WEIGHT}`}
                      onChange={(e) => setWeight(m, +e.target.value)}
                    />
                    <b className="stat wt">{draft.weights[m] ?? DEFAULT_WEIGHT}</b>
                    <span className="x" onClick={() => removeMember(bi, m)} title="Remove">
                      ×
                    </span>
                  </div>
                );
              })}
              <div
                className={"dropEnd" + (isEndOver ? " dropBefore" : "")}
                onDragOver={onBucketEndOver(bi, b.members.length)}
                onDrop={onBucketEndDrop(bi, b.members.length)}
              >
                {addingTo === bi ? (
                  <input
                    className="addMember"
                    autoFocus
                    value={newName}
                    placeholder="Name… ↵"
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      else if (e.key === "Escape") {
                        cancelAddRef.current = true;
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={() => finishAdd(bi)}
                  />
                ) : (
                  <button className="sm ghost" onClick={() => startAdd(bi)}>
                    + member
                  </button>
                )}
              </div>
            </div>
            <span className="x bucketDelete" onClick={() => removeBucket(bi)} title="Delete bucket">
              <svg
                className="trashIcon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </span>
          </div>
        );
      })}

      <div className="saveBar">
        <button className="sm" onClick={addBucket}>
          + bucket
        </button>
        <span className="spacer" />
        {dirty || hasToggles ? (
          <>
            <span className="warn">
              ● {dirty ? "Unsaved changes" : "Readers adjusted this week"}
            </span>
            <button className="sm" onClick={discard}>
              Discard
            </button>
            {dirty && (
              <button className="sm primary" onClick={save}>
                Save changes
              </button>
            )}
          </>
        ) : (
          <span className="muted">All changes saved</span>
        )}
      </div>
    </div>
  );
}
