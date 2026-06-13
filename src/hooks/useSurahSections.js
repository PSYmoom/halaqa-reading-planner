import { useState, useEffect } from "react";
import { fetchSurahSections } from "../utils/engine.js";
import { loadCachedSections, cacheSections } from "../lib/storage.js";

/**
 * Tafsir sections for a surah — cache-first from localStorage, falling back
 * to a network fetch (which is then cached). The in-flight request is aborted
 * when the surah changes or the component unmounts.
 */
export function useSurahSections(surah) {
  const [sections, setSections] = useState(() => loadCachedSections(surah));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = loadCachedSections(surah);
    if (cached) {
      setSections(cached);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchSurahSections(surah, { signal: controller.signal })
      .then((secs) => {
        if (controller.signal.aborted) return; // resolved just before cleanup ran
        setSections(secs);
        cacheSections(surah, secs);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e.message || e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [surah]);

  return { sections, loading, error };
}
