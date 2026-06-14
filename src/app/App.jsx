import { useMemo } from "react";
import { surahName } from "../config/constants.js";
import { generateMessage } from "../utils/message.js";
import { nextStart } from "../utils/engine.js";
import { useConfig } from "../hooks/useConfig.js";
import { useSurahSections } from "../hooks/useSurahSections.js";
import { useReaders } from "../hooks/useReaders.js";
import { useWeekPlan } from "../hooks/useWeekPlan.js";
import { useToast } from "../hooks/useToast.js";
import { Masthead } from "../components/Masthead.jsx";
import { CommandBar } from "../components/CommandBar.jsx";
import { BucketEditor } from "../components/BucketEditor.jsx";
import { SplitPanel } from "../components/SplitPanel.jsx";
import { SettingsPanel } from "../components/SettingsPanel.jsx";
import { OutputPanel } from "../components/OutputPanel.jsx";

/**
 * Top-level orchestrator. State and derivation live in the hooks, markup in
 * the components — this only wires them together.
 */
export default function App() {
  const [config, setConfig] = useConfig();
  const { sections, loading, error } = useSurahSections(config.surah);
  const readers = useReaders(config);
  const week = useWeekPlan(sections, config, readers.members, readers.weights);
  const { toast, flash, dismiss } = useToast();

  const message = useMemo(
    () => generateMessage(config.surah, week.assignments, config.templates),
    [config.surah, week.assignments, config.templates],
  );

  // Where next week begins (rolls over to the next surah at a surah's end).
  const surahLastAyah = sections?.length ? sections[sections.length - 1].ayahEnd : null;
  const next = nextStart(config.surah, config.startAyah, week.weekEnd, surahLastAyah);
  const nextLabel = next.rollOver ? `Surah ${surahName(next.surah)} · Ayat 1` : `Ayat ${next.ayah}`;

  const markSent = () => {
    setConfig({
      ...config,
      buckets: readers.rotateBuckets(),
      surah: next.surah,
      startAyah: next.ayah,
    });
    readers.resetWeek();
    flash(
      next.rollOver
        ? `Marked as sent — moved on to Surah ${surahName(next.surah)}`
        : "Marked as sent — active buckets rotated to the next reader",
    );
  };

  return (
    <div className="wrap">
      <Masthead surah={config.surah} />

      <CommandBar
        config={config}
        setConfig={setConfig}
        sections={sections}
        loading={loading}
        error={error}
        members={readers.members}
        overrideActive={readers.overrideActive}
        offCount={readers.offCount}
        week={week}
      />

      <div className="grid">
        <BucketEditor
          config={config}
          setConfig={setConfig}
          readersByBucket={readers.readersByBucket}
          setReaderForBucket={readers.setReaderForBucket}
          bucketsOff={readers.bucketsOff}
          toggleBucket={readers.toggleBucket}
          hasOverrides={readers.overrideActive}
          clearOverrides={readers.clearOverrides}
        />
        <SplitPanel week={week} wpm={config.readingWpm} />
      </div>

      <OutputPanel
        message={message}
        surah={config.surah}
        memberCount={readers.members.length}
        week={week}
        wpm={config.readingWpm}
        templates={config.templates}
        setTemplates={(templates) => setConfig({ ...config, templates })}
        nextLabel={nextLabel}
        onMarkSent={markSent}
        flash={flash}
      />

      <SettingsPanel config={config} setConfig={setConfig} flash={flash} />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toastStar" aria-hidden="true">
            ۞
          </span>
          <span className="toastMsg">{toast.message}</span>
          {toast.action && (
            <button
              className="toastAction"
              onClick={() => {
                toast.action.onClick();
                dismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
