import { useState, useMemo } from "react";
import { DEFAULT_WEIGHT } from "../config/constants.js";

/**
 * This week's readers. Every member has a per-week on/off toggle: by default a
 * bucket's front (members[0]) reads and the rest don't, but clicking any name
 * flips just that person (toggleReader) — bench the front, add others, freely and
 * independently. A bucket with nobody on is simply "off" (no separate flag).
 *
 * Two per-week deltas from the default capture all of it:
 *   - `frontsOff`: front members turned OFF.
 *   - `extras`:    non-front members turned ON (appended last on the bar).
 * On "Mark as sent" everyone who read sinks to the back of their bucket
 * (rotateBuckets); a benched front does not sink. Both deltas reset next week.
 *
 * Member names are the identity key everywhere (weights, React keys, queue
 * position), so they are kept unique on entry (BucketEditor) and on load
 * (normalizeConfig).
 */
export function useReaders(config) {
  const [extras, setExtras] = useState([]); // non-front members turned ON this week
  const [frontsOff, setFrontsOff] = useState([]); // front members turned OFF this week

  const isFront = (name) => config.buckets.some((b) => b.members[0] === name);
  const toggleIn = (xs, name) => (xs.includes(name) ? xs.filter((n) => n !== name) : [...xs, name]);

  // Click any member to flip their reading state — fronts route through
  // `frontsOff`, everyone else through `extras`.
  const toggleReader = (name) =>
    isFront(name)
      ? setFrontsOff((xs) => toggleIn(xs, name))
      : setExtras((xs) => toggleIn(xs, name));

  const clearReaderToggles = () => {
    setExtras([]);
    setFrontsOff([]);
  };

  // Memoized so members/weights keep a stable identity between renders — the
  // downstream useMemos (weekSections, algoSplits, assignments) key on them.
  const { reading, members, weights, offCount, togglesActive } = useMemo(() => {
    const offSet = new Set(frontsOff);
    const frontSet = new Set(config.buckets.map((b) => b.members[0]).filter(Boolean));
    // Bucket fronts still on, in bucket order.
    const fronts = config.buckets.map((b) => b.members[0]).filter((n) => n && !offSet.has(n));
    // Non-front members turned on, appended last (defensive: ignore any fronts).
    const extraReaders = extras.filter((n) => !frontSet.has(n));
    const members = [...fronts, ...extraReaders];
    const reading = new Set(members);
    const weights = members.map((m) => config.weights[m] ?? DEFAULT_WEIGHT);
    // A bucket with members but none reading is "off".
    const offCount = config.buckets.filter(
      (b) => b.members.length && !b.members.some((m) => reading.has(m)),
    ).length;
    const togglesActive = extraReaders.length > 0 || frontsOff.length > 0;

    return { reading, members, weights, offCount, togglesActive };
  }, [config.buckets, config.weights, extras, frontsOff]);

  // Move everyone who read this week — each bucket's front (unless benched) plus
  // its toggled-on extras — to the back of the bucket's queue. A benched front
  // doesn't read, so it stays first; a bucket with no readers is unchanged.
  const rotateBuckets = () =>
    config.buckets.map((b) => {
      if (!b.members.length) return b;
      const read = new Set();
      const front = b.members[0];
      if (front && !frontsOff.includes(front)) read.add(front);
      for (const name of extras) if (b.members.includes(name)) read.add(name);
      if (read.size === 0) return b;
      const stay = b.members.filter((m) => !read.has(m));
      const sank = b.members.filter((m) => read.has(m));
      return { ...b, members: [...stay, ...sank] };
    });

  // Clear the per-week state — toggles reset for next week.
  const resetWeek = () => {
    setExtras([]);
    setFrontsOff([]);
  };

  return {
    reading,
    members,
    weights,
    offCount,
    togglesActive,
    toggleReader,
    clearReaderToggles,
    rotateBuckets,
    resetWeek,
  };
}
