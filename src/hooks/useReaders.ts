import { useState, useMemo } from "react";
import { DEFAULT_WEIGHT } from "../config/constants.ts";
import type { Bucket, Config, Readers } from "../types.ts";

/**
 * This week's readers. By default each bucket's front (members[0]) reads;
 * clicking a name flips just that person — tracked as two per-week deltas
 * (`frontsOff`, `extras`) that reset next week. On "Mark as sent" everyone who
 * read sinks to the back of their bucket. Names are the identity key throughout.
 */
export function useReaders(config: Config): Readers {
  const [extras, setExtras] = useState<string[]>([]); // non-front members toggled ON
  const [frontsOff, setFrontsOff] = useState<string[]>([]); // front members toggled OFF

  const isFront = (name: string) => config.buckets.some((b) => b.members[0] === name);
  const toggleIn = (xs: string[], name: string) =>
    xs.includes(name) ? xs.filter((n) => n !== name) : [...xs, name];

  // Fronts route through `frontsOff`, everyone else through `extras`.
  const toggleReader = (name: string) =>
    isFront(name)
      ? setFrontsOff((xs) => toggleIn(xs, name))
      : setExtras((xs) => toggleIn(xs, name));

  const clearReaderToggles = () => {
    setExtras([]);
    setFrontsOff([]);
  };

  // Memoized for stable identity — downstream useMemos key on members/weights.
  const { reading, members, weights, offCount, togglesActive } = useMemo(() => {
    const offSet = new Set(frontsOff);
    const frontSet = new Set(config.buckets.map((b) => b.members[0]).filter(Boolean));
    const fronts = config.buckets.map((b) => b.members[0]).filter((n) => n && !offSet.has(n));
    const extraReaders = extras.filter((n) => !frontSet.has(n)); // appended last; ignore any fronts
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

  // Sink everyone who read (front unless benched, plus toggled-on extras) to the
  // back of their bucket. A benched front stays first; a readerless bucket is unchanged.
  const rotateBuckets = (): Bucket[] =>
    config.buckets.map((b) => {
      if (!b.members.length) return b;
      const read = new Set<string>();
      const front = b.members[0];
      if (front && !frontsOff.includes(front)) read.add(front);
      for (const name of extras) if (b.members.includes(name)) read.add(name);
      if (read.size === 0) return b;
      const stay = b.members.filter((m) => !read.has(m));
      const sank = b.members.filter((m) => read.has(m));
      return { ...b, members: [...stay, ...sank] };
    });

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
