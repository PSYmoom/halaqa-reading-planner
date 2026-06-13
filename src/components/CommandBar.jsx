import { useMemo } from "react";
import { SURAH_NAMES, surahName } from "../config/constants.js";
import { readingTime, sectionHeading } from "../utils/message.js";
import { Combobox } from "./Combobox.jsx";

/**
 * Full-width command bar — the parameters that define this week
 * (surah, start ayah, word budget) plus the status pills.
 */
export function CommandBar({
  config,
  setConfig,
  sections,
  loading,
  error,
  members,
  overrideActive,
  offCount,
  week,
}) {
  // Options for the searchable pickers.
  const surahOptions = useMemo(
    () => SURAH_NAMES.map((name, i) => ({ value: i + 1, label: `${i + 1}. ${name}` })),
    [],
  );
  const ayahOptions = useMemo(
    () =>
      (sections || []).map((s, i) => ({
        key: i,
        value: s.ayahStart,
        label:
          s.ayahStart === s.ayahEnd ? `Ayat ${s.ayahStart}` : `Ayat ${s.ayahStart}–${s.ayahEnd}`,
        hint: sectionHeading(s),
      })),
    [sections],
  );

  const setSurah = (value) => setConfig({ ...config, surah: +value });
  const setStartAyah = (value) => setConfig({ ...config, startAyah: +value });
  const setBudget = (value) => setConfig({ ...config, wordBudget: week.snapBudget(+value) });
  const shownBudget = Math.max(
    config.budgetMin,
    Math.min(week.totalWords || config.wordBudget, week.maxBudget),
  );
  const atSurahEnd = shownBudget >= week.remainingWords;

  // Pill labels, named here so the JSX below stays declarative.
  const readerNames = members.length ? members.join(", ") : "—";
  const offLabel = `${offCount} bucket${offCount === 1 ? "" : "s"} off this week`;
  const coverageLabel =
    week.weekStart != null
      ? `Covers Ayat ${week.weekStart}–${week.weekEnd} · ${week.weekSections.length} sections · ` +
        `${week.totalWords.toLocaleString()} words · ${readingTime(week.totalWords, config.readingWpm)} read`
      : null;

  return (
    <div className="card commandbar">
      <h2>This week</h2>
      <div className="cbRow">
        <div className="field">
          <label>Surah</label>
          <Combobox
            options={surahOptions}
            display={`${config.surah}. ${surahName(config.surah)}`}
            placeholder="Search surah by name or number…"
            onSelect={setSurah}
          />
        </div>
        <div className="field">
          <label>Start at Ayah</label>
          <Combobox
            options={ayahOptions}
            display={`Ayat ${config.startAyah}`}
            placeholder="Search ayah number or section…"
            allowNumber
            onNumber={setStartAyah}
            onSelect={setStartAyah}
          />
        </div>
      </div>
      <div className="budgetBar">
        <div className="budgetField">
          <label>
            How much this week — word budget: <b className="stat">{shownBudget.toLocaleString()}</b>
          </label>
          <div className="budgetSlider">
            <div className="budgetTicks">
              {week.budgetMarks.map((m, i) => {
                const pct = ((m.at - config.budgetMin) / (week.maxBudget - config.budgetMin)) * 100;
                if (pct < 0 || pct > 100) return null;
                return (
                  <span
                    key={i}
                    className={"budgetTick " + (m.headed ? "headed" : "plain")}
                    style={{ left: pct + "%" }}
                  />
                );
              })}
            </div>
            <input
              type="range"
              min={config.budgetMin}
              max={week.maxBudget}
              step="any"
              value={shownBudget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div className="row muted budgetHint">
            <span>lighter week</span>
            <span>{atSurahEnd ? "✓ to end of surah" : "heavier week"}</span>
          </div>
        </div>
      </div>
      <div className="row cbPills">
        <span className="pill">
          This week's readers: <b>{readerNames}</b>
        </span>
        {overrideActive && <span className="pill warn">override active</span>}
        {offCount > 0 && <span className="pill warn">{offLabel}</span>}
        {coverageLabel && <span className="pill">{coverageLabel}</span>}
        {loading && <span className="pill">Loading surah…</span>}
      </div>
      {error && (
        <div className="err">
          Couldn't load tafsir: {error}. Check your connection (First load needs internet; It's
          cached afterwards).
        </div>
      )}
    </div>
  );
}
