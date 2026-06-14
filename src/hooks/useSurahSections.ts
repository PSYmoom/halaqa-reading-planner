import { useState, useEffect } from "react";
import { fetchSurahSections } from "../utils/engine.ts";
import { loadCachedSections, cacheSections } from "../lib/storage.ts";
import type { Section, FetchStatus } from "../types.ts";

export interface UseSurahSections {
  // Best available sections (cache or last fetch), or [] — never null.
  sections: Section[];
  status: FetchStatus;
}

/**
 * Tafsir sections for a surah: cache-first, then network (which is cached). The
 * request aborts on surah change/unmount; prior sections stay put while loading.
 */
export function useSurahSections(surah: number): UseSurahSections {
  const [sections, setSections] = useState<Section[]>(() => loadCachedSections(surah) ?? []);
  const [status, setStatus] = useState<FetchStatus>({ state: "idle" });

  useEffect(() => {
    const cached = loadCachedSections(surah);
    if (cached) {
      setSections(cached);
      setStatus({ state: "idle" });
      return;
    }

    const controller = new AbortController();
    setStatus({ state: "loading" });
    fetchSurahSections(surah, { signal: controller.signal })
      .then((secs) => {
        if (controller.signal.aborted) return;
        setSections(secs);
        cacheSections(surah, secs);
        setStatus({ state: "idle" });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === "AbortError") return; // superseded by a newer surah
        setStatus({ state: "error", message: String((e as Error)?.message || e) });
      });
    return () => controller.abort();
  }, [surah]);

  return { sections, status };
}
