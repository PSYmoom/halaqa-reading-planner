import { normalizeConfig } from "../lib/storage.js";

const CONFIG_FILENAME = "halaqa-config.json";

/**
 * Collapsible band — edit the WhatsApp message templates and back up the
 * config to / restore it from a JSON file.
 */
export function TemplatesPanel({ config, setConfig, flash }) {
  const setIntro = (intro) => setConfig({ ...config, templates: { ...config.templates, intro } });
  const setOutro = (outro) => setConfig({ ...config, templates: { ...config.templates, outro } });

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
        setConfig(normalizeConfig(JSON.parse(reader.result)));
        flash("Config imported");
      } catch {
        flash("Invalid config file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <details className="card templatesCard">
      <summary>Message templates &amp; config backup</summary>
      <div className="templatesBody">
        <label>
          Intro <span className="muted">({"{surah}"} is replaced)</span>
        </label>
        <textarea
          className="introBox"
          value={config.templates.intro}
          onChange={(e) => setIntro(e.target.value)}
        />
        <label className="outroLabel">Outro</label>
        <textarea
          className="outroBox"
          value={config.templates.outro}
          onChange={(e) => setOutro(e.target.value)}
        />
        <div className="row backupRow">
          <button className="sm" onClick={exportConfig}>
            Export config
          </button>
          <label className="pill importBtn">
            Import config
            <input type="file" accept="application/json" onChange={importConfig} />
          </label>
        </div>
      </div>
    </details>
  );
}
