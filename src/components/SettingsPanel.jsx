import { useRef } from "react";
import { normalizeConfig } from "../lib/storage.js";

const CONFIG_FILENAME = "halaqa-config.json";

/**
 * Collapsible band for global, cross-week preferences (not this week's content):
 * reading speed, the word-budget slider's range, and config backup/restore.
 */
export function SettingsPanel({ config, setConfig, flash }) {
  const fileRef = useRef(null);

  // Coerce to a whole number ≥ min; ignore empty/NaN input (keeps the field usable mid-edit).
  const setNum = (key, min) => (e) => {
    const v = Math.round(+e.target.value);
    if (!Number.isFinite(v)) return;
    setConfig({ ...config, [key]: Math.max(min, v) });
  };
  // The slider range must stay non-empty, so clamp each bound off the other.
  const setBudgetMin = (e) => {
    const v = Math.round(+e.target.value);
    if (!Number.isFinite(v)) return;
    setConfig({ ...config, budgetMin: Math.max(1, Math.min(v, config.budgetMax - 1)) });
  };
  const setBudgetMax = (e) => {
    const v = Math.round(+e.target.value);
    if (!Number.isFinite(v)) return;
    setConfig({ ...config, budgetMax: Math.max(v, config.budgetMin + 1) });
  };

  const exportConfig = () => {
    const json = JSON.stringify(config, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = CONFIG_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeConfig(JSON.parse(reader.result));
        const previous = config; // snapshot before replacing, so the import is undoable
        setConfig(next);
        flash("Config imported", { label: "Undo", onClick: () => setConfig(previous) });
      } catch {
        flash("Invalid config file");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset so re-selecting the same file fires onChange again
  };

  return (
    <details className="card settingsCard">
      <summary>
        <h2>Settings</h2>
      </summary>
      <div className="settingsBody">
        <div className="settingRow">
          <label htmlFor="set-wpm" className="settingLabel">
            <span className="settingName">Reading speed</span>
            <span className="settingHint">Drives the “… read” estimates</span>
          </label>
          <div className="sliderRow">
            <input
              id="set-wpm"
              type="range"
              min="40"
              max="160"
              step="5"
              value={config.readingWpm}
              onChange={setNum("readingWpm", 1)}
            />
            <output className="sliderVal">
              {config.readingWpm} <span className="muted">wpm</span>
            </output>
          </div>
        </div>

        <div className="settingRow">
          <div className="settingLabel">
            <span className="settingName">Word-budget range</span>
            <span className="settingHint">The weekly slider’s limits</span>
          </div>
          <div className="rangeField">
            <input
              className="numField"
              type="number"
              min="1"
              value={config.budgetMin}
              onChange={setBudgetMin}
              aria-label="Minimum word budget"
            />
            <span className="rangeSep">to</span>
            <input
              className="numField"
              type="number"
              min="1"
              value={config.budgetMax}
              onChange={setBudgetMax}
              aria-label="Maximum word budget"
            />
            <span className="rangeUnit muted">words</span>
          </div>
        </div>

        <div className="settingRow">
          <div className="settingLabel">
            <span className="settingName">Config backup</span>
            <span className="settingHint">Saved per browser — move between devices</span>
          </div>
          <div className="row backupRow">
            <button className="sm" onClick={exportConfig}>
              Export config
            </button>
            <button className="sm" onClick={() => fileRef.current.click()}>
              Import config
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={importConfig}
              hidden
            />
          </div>
        </div>
      </div>
    </details>
  );
}
