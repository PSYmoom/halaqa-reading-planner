import { useState, useMemo } from "react";
import { DEFAULT_WEIGHT } from "../constants.js";

// Round-robin pick for a bucket, honoring a manual override when it names a
// current member. Returns an index into bucket.members, or -1 for an empty
// bucket. Pass override=null for the plain rotation pick.
function readerIndexOf(bucket, override) {
  if (!bucket.members.length) return -1;
  if (override != null && bucket.members.includes(override)) {
    return bucket.members.indexOf(override);
  }
  return (bucket.ptr || 0) % bucket.members.length;
}

/**
 * This week's readers — one per bucket via round-robin, with per-week manual
 * overrides ("use X this week") and per-week bucket toggles ("skip this
 * bucket — no reader, no rotation").
 */
export function useReaders(config) {
  const [readerOverride, setReaderOverride] = useState({}); // { [bucketId]: memberName }
  const [bucketsOff, setBucketsOff] = useState({});         // { [bucketId]: true } → skipped this week

  const toggleBucket = (id) => setBucketsOff((off) => ({ ...off, [id]: !off[id] }));
  const setReaderForBucket = (bucketId, member) =>
    setReaderOverride((o) => ({ ...o, [bucketId]: member }));
  const clearOverrides = () => setReaderOverride({});

  // Memoized so members/weights keep a stable identity between renders —
  // the downstream useMemos (weekSections, algoSplits, assignments) key on them.
  const { readersByBucket, members, weights, offCount, overrideActive } = useMemo(() => {
    // Buckets toggled off this week contribute no reader and aren't rotated on "Mark as sent".
    const readerOf = (b) => {
      const i = readerIndexOf(b, readerOverride[b.id]);
      return i < 0 ? null : b.members[i];
    };
    const readersByBucket = Object.fromEntries(
      config.buckets.map((b) => [b.id, bucketsOff[b.id] ? null : readerOf(b)])
    );
    const members = config.buckets.map((b) => readersByBucket[b.id]).filter(Boolean);
    const weights = members.map((m) => config.weights[m] ?? DEFAULT_WEIGHT);
    const offCount = config.buckets.filter((b) => bucketsOff[b.id]).length;

    // An override is "active" when a bucket resolves to a different reader than the plain rotation.
    const overrideActive = config.buckets.some(
      (b) => !bucketsOff[b.id] &&
        readerIndexOf(b, readerOverride[b.id]) !== readerIndexOf(b, null)
    );

    return { readersByBucket, members, weights, offCount, overrideActive };
  }, [config.buckets, config.weights, bucketsOff, readerOverride]);

  // Advance each active bucket past whoever read this week.
  // Buckets toggled off don't go forward (their ptr is untouched).
  const rotateBuckets = () =>
    config.buckets.map((b) => {
      if (bucketsOff[b.id] || !b.members.length) return b;
      return { ...b, ptr: (readerIndexOf(b, readerOverride[b.id]) + 1) % b.members.length };
    });

  // Clear the per-week state — overrides and toggles reset for next week.
  const resetWeek = () => {
    setReaderOverride({});
    setBucketsOff({});
  };

  return {
    readersByBucket, members, weights, offCount, overrideActive,
    bucketsOff, toggleBucket, setReaderForBucket, clearOverrides,
    rotateBuckets, resetWeek,
  };
}
