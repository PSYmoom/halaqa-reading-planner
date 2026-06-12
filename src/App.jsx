import { useMemo } from "react";
import { generateMessage } from "./message.js";
import { useConfig } from "./hooks/useConfig.js";
import { useSurahSections } from "./hooks/useSurahSections.js";
import { useReaders } from "./hooks/useReaders.js";
import { useWeekPlan } from "./hooks/useWeekPlan.js";
import { useToast } from "./hooks/useToast.js";
import { Masthead } from "./components/Masthead.jsx";
import { CommandBar } from "./components/CommandBar.jsx";
import { BucketEditor } from "./components/BucketEditor.jsx";
import { SplitPanel } from "./components/SplitPanel.jsx";
import { TemplatesPanel } from "./components/TemplatesPanel.jsx";
import { OutputPanel } from "./components/OutputPanel.jsx";

/**
 * Top-level orchestrator. State and derivation live in the hooks, markup in
 * the components — this only wires them together.
 */
export default function App() {
  const [config, setConfig] = useConfig();
  const { sections, loading, error } = useSurahSections(config.surah);
  const readers = useReaders(config);
  const week = useWeekPlan(sections, config, readers.members, readers.weights);
  const { toast, flash } = useToast();

  const message = useMemo(
    () => generateMessage(config.surah, week.assignments, config.templates),
    [config.surah, week.assignments, config.templates]
  );

  const nextAyah = (week.weekEnd || config.startAyah) + 1;
  const markSent = () => {
    setConfig({ ...config, buckets: readers.rotateBuckets(), startAyah: nextAyah });
    readers.resetWeek();
    flash("Marked as sent — active buckets rotated to the next reader");
  };

  return (
    <div className="wrap">
      <Masthead surah={config.surah} />

      <CommandBar config={config} setConfig={setConfig}
                  sections={sections} loading={loading} error={error}
                  members={readers.members}
                  overrideActive={readers.overrideActive}
                  offCount={readers.offCount}
                  week={week} />

      <div className="grid">
        <BucketEditor config={config} setConfig={setConfig}
                      readersByBucket={readers.readersByBucket}
                      setReaderForBucket={readers.setReaderForBucket}
                      bucketsOff={readers.bucketsOff}
                      toggleBucket={readers.toggleBucket}
                      hasOverrides={readers.overrideActive}
                      clearOverrides={readers.clearOverrides} />
        <SplitPanel week={week} memberCount={readers.members.length} />
      </div>

      <TemplatesPanel config={config} setConfig={setConfig} flash={flash} />

      <OutputPanel message={message} surah={config.surah}
                   memberCount={readers.members.length}
                   week={week} nextAyah={nextAyah}
                   onMarkSent={markSent} flash={flash} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
