// Availability-tier buckets with drag-and-drop. Edits are staged in a local draft and
// only committed to the app when you press "Save changes".
//  • drag a member's grip (⠿) to reorder within a bucket or move between buckets
//  • drag a bucket's hamburger (☰) to reorder buckets
//  • click a member's name to make them this week's reader for that bucket (live)
import { useState, useEffect, useRef } from "react";

let _seq = 0;
const newId = () => `b${Date.now().toString(36)}${(_seq++).toString(36)}`;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function BucketEditor({ config, setConfig, readersByBucket, setReaderForBucket, bucketsOff = {}, toggleBucket, hasOverrides, clearOverrides }) {
  const [draft, setDraft] = useState({ buckets: config.buckets, weights: config.weights });
  const [dirty, setDirty] = useState(false);
  const [drag, setDrag] = useState(null);   // { kind:'member', bi, index } | { kind:'bucket', index }
  const [over, setOver] = useState(null);   // { kind:'member', bi, index } | { kind:'bucket', bi }
  const dragRef = useRef(null);             // mirror of `drag` readable inside native handlers
  const [addingTo, setAddingTo] = useState(null); // bucket index showing the inline add-member input
  const [newName, setNewName] = useState("");
  const cancelAddRef = useRef(false);       // set when Escape should discard instead of commit

  // Resync the draft when the saved config changes externally (e.g. Mark as sent),
  // but never clobber unsaved edits.
  useEffect(() => {
    if (!dirty) setDraft({ buckets: config.buckets, weights: config.weights });
  }, [config.buckets, config.weights, dirty]);

  const apply = (next) => { setDraft(next); setDirty(true); };
  const setBuckets = (buckets) => apply({ ...draft, buckets });

  const save = () => { setConfig({ ...config, buckets: draft.buckets, weights: draft.weights }); setDirty(false); };
  const discard = () => {
    setDraft({ buckets: config.buckets, weights: config.weights });
    setDirty(false);
    clearOverrides?.();   // also undo this week's reader overrides (name-clicks)
  };

  // ── structural edits (draft only) ──
  const setWeight = (name, w) => apply({ ...draft, weights: { ...draft.weights, [name]: w } });
  // Inline add-member: a themed input replaces the "+ member" button. Enter/blur commits,
  // Escape discards (both routed through onBlur so it only commits once).
  const startAdd = (bi) => { setAddingTo(bi); setNewName(""); cancelAddRef.current = false; };
  const finishAdd = (bi) => {
    const name = newName.trim();
    if (!cancelAddRef.current && name) {
      const buckets = draft.buckets.map((b, i) => (i === bi ? { ...b, members: [...b.members, name] } : b));
      const weights = draft.weights[name] == null ? { ...draft.weights, [name]: 5 } : draft.weights;
      apply({ buckets, weights });
    }
    cancelAddRef.current = false;
    setAddingTo(null); setNewName("");
  };
  const removeMember = (bi, name) =>
    setBuckets(draft.buckets.map((b, i) => (i === bi ? { ...b, members: b.members.filter((m) => m !== name) } : b)));
  const addBucket = () => setBuckets([...draft.buckets, { id: newId(), members: [], ptr: 0 }]);
  const removeBucket = (bi) => setBuckets(draft.buckets.filter((_, i) => i !== bi));

  const moveMember = (from, toBi, toIndex) => {
    const buckets = draft.buckets.map((b) => ({ ...b, members: [...b.members] }));
    const [m] = buckets[from.bi].members.splice(from.index, 1);
    let ti = toIndex;
    if (from.bi === toBi && from.index < toIndex) ti -= 1;
    buckets[toBi].members.splice(ti, 0, m);
    const weights = draft.weights[m] == null ? { ...draft.weights, [m]: 5 } : draft.weights;
    apply({ buckets, weights });
  };
  const moveBucket = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const buckets = draft.buckets.slice();
    const [b] = buckets.splice(fromIdx, 1);
    buckets.splice(toIdx, 0, b);
    setBuckets(buckets);
  };

  // ── native drag-and-drop plumbing ──
  const startDrag = (payload) => (e) => {
    dragRef.current = payload; setDrag(payload);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
    const ghost = e.currentTarget.closest(payload.kind === "member" ? ".memberChip" : ".bucketRow");
    if (ghost) e.dataTransfer.setDragImage(ghost, 12, 12);
  };
  const endDrag = () => { dragRef.current = null; setDrag(null); setOver(null); };
  const setOverIf = (o) => setOver((prev) => (eq(prev, o) ? prev : o));

  // Drop position is the gap nearest the cursor: left half of a chip → before it,
  // right half → after it. This makes dropping *behind* a member as easy as in front.
  const gapAt = (e, idx) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX > r.left + r.width / 2 ? idx + 1 : idx;
  };
  const onChipOver = (bi, idx) => (e) => {
    if (dragRef.current?.kind !== "member") return;
    e.preventDefault(); e.stopPropagation(); setOverIf({ kind: "member", bi, index: gapAt(e, idx) });
  };
  const onChipDrop = (bi, idx) => (e) => {
    if (dragRef.current?.kind !== "member") return;
    e.preventDefault(); e.stopPropagation();
    moveMember(dragRef.current, bi, gapAt(e, idx)); endDrag();
  };
  const onBucketEndOver = (bi, len) => (e) => {
    if (dragRef.current?.kind !== "member") return;
    e.preventDefault(); setOverIf({ kind: "member", bi, index: len });
  };
  const onBucketEndDrop = (bi, len) => (e) => {
    if (dragRef.current?.kind !== "member") return;
    e.preventDefault(); moveMember(dragRef.current, bi, len); endDrag();
  };
  const onBucketRowOver = (bi) => (e) => {
    if (dragRef.current?.kind !== "bucket") return;
    e.preventDefault(); setOverIf({ kind: "bucket", bi });
  };
  const onBucketRowDrop = (bi) => (e) => {
    if (dragRef.current?.kind !== "bucket") return;
    e.preventDefault(); moveBucket(dragRef.current.index, bi); endDrag();
  };

  return (
    <div className="card">
      <h2>Availability buckets &amp; weights — one reader per bucket each week</h2>

      {draft.buckets.map((b, bi) => {
        const reader = readersByBucket[b.id];
        const off = !!bucketsOff[b.id];
        const isOverBucket = over?.kind === "bucket" && over.bi === bi;
        const isEndOver = over?.kind === "member" && over.bi === bi && over.index === b.members.length;
        return (
          <div className={"bucketRow" + (isOverBucket ? " overBucket" : "") + (off ? " off" : "")}
               key={b.id}
               onDragOver={onBucketRowOver(bi)} onDrop={onBucketRowDrop(bi)}>
            <span className="bhandle" draggable
                  onDragStart={startDrag({ kind: "bucket", index: bi })} onDragEnd={endDrag}
                  title="Drag to reorder bucket">☰</span>
            <button type="button"
                    className={"bucketToggle" + (off ? " isOff" : "")}
                    aria-pressed={!off}
                    onClick={() => toggleBucket?.(b.id)}
                    title={off
                      ? "Off this week — this bucket won't read or rotate forward. Click to include it."
                      : "On this week. Click to skip — it won't read and won't advance to the next reader."}>
              {off ? "Off" : "On"}
            </button>
            <div className="row chips" style={{ flex: 1, gap: 6 }}>
              {b.members.map((m, idx) => {
                const isReader = m === reader;
                const isDragging = drag?.kind === "member" && drag.bi === bi && drag.index === idx;
                const isBefore = over?.kind === "member" && over.bi === bi && over.index === idx;
                return (
                  <span
                    key={m}
                    className={"memberChip" + (isReader ? " reader" : "") + (isDragging ? " dragging" : "") + (isBefore ? " dropBefore" : "")}
                    onDragOver={onChipOver(bi, idx)} onDrop={onChipDrop(bi, idx)}
                  >
                    <span className="grip" draggable
                          onDragStart={startDrag({ kind: "member", bi, index: idx })} onDragEnd={endDrag}
                          title="Drag to reorder / move to another bucket">⠿</span>
                    <span className="mName" onClick={() => setReaderForBucket(b.id, m)}
                          title="Use as this week's reader">{m}</span>
                    {isReader && <span className="tag next">reads</span>}
                    <input type="range" min="1" max="10" value={draft.weights[m] ?? 5}
                           title={`weight ${draft.weights[m] ?? 5}`}
                           onChange={(e) => setWeight(m, +e.target.value)} />
                    <b className="stat">{draft.weights[m] ?? 5}</b>
                    <span className="x" onClick={() => removeMember(bi, m)} title="Remove">×</span>
                  </span>
                );
              })}
              <span className={"dropEnd" + (isEndOver ? " dropBefore" : "")} onDragOver={onBucketEndOver(bi, b.members.length)} onDrop={onBucketEndDrop(bi, b.members.length)}>
                {addingTo === bi ? (
                  <input
                    className="addMember"
                    autoFocus
                    value={newName}
                    placeholder="Name… ↵"
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      else if (e.key === "Escape") { cancelAddRef.current = true; e.currentTarget.blur(); }
                    }}
                    onBlur={() => finishAdd(bi)}
                  />
                ) : (
                  <button className="sm ghost" onClick={() => startAdd(bi)}>+ member</button>
                )}
              </span>
            </div>
            <span className="x" onClick={() => removeBucket(bi)} title="Delete bucket">🗑</span>
          </div>
        );
      })}

      <div className="saveBar">
        <button className="sm" onClick={addBucket}>+ bucket</button>
        <span className="spacer" />
        {dirty || hasOverrides ? (
          <>
            <span className="warn" style={{ fontSize: 12 }}>● {dirty ? "Unsaved changes" : "Reader override set"}</span>
            <button className="sm" onClick={discard}>Discard</button>
            {dirty && <button className="sm primary" onClick={save}>Save changes</button>}
          </>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>All changes saved</span>
        )}
      </div>
    </div>
  );
}
