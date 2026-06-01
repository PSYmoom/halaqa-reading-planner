// Top-level app: wires controls, the bucket editor, the split view, and output.
import { useState, useEffect, useMemo } from "react";
import { SURAH_NAMES, surahName, COLORS } from "./constants.js";
import { fetchSurahSections, pickWeek, computeSplits, buildAssignments } from "./engine.js";
import { ayahRange, generateMessage, readingTime } from "./message.js";
import { loadConfig, saveConfig, loadCachedSections, cacheSections, normalizeConfig } from "./storage.js";
import { SplitBar } from "./components/SplitBar.jsx";
import { BucketEditor } from "./components/BucketEditor.jsx";
import { Combobox } from "./components/Combobox.jsx";

export default function App() {
  const [config, setConfigState] = useState(loadConfig);
  const setConfig = (c) => { setConfigState(c); saveConfig(c); };

  const [sections, setSections] = useState(() => loadCachedSections(config.surah));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [readerOverride, setReaderOverride] = useState({}); // { bucketName: memberName } for this week
  const [bucketsOff, setBucketsOff] = useState({}); // { [bucketId]: true } → skipped this week (no reader, no rotation)
  const toggleBucket = (id) => setBucketsOff((o) => ({ ...o, [id]: !o[id] }));
  const [splits, setSplits] = useState([]);
  const [manualSplits, setManualSplits] = useState(false);
  const [toast, setToast] = useState(null);

  // fetch sections when surah changes (cache-first)
  useEffect(() => {
    const cached = loadCachedSections(config.surah);
    if (cached) { setSections(cached); return; }
    let alive = true;
    setLoading(true); setError(null);
    fetchSurahSections(config.surah)
      .then((secs) => { if (!alive) return; setSections(secs); cacheSections(config.surah, secs); })
      .catch((e) => { if (alive) setError(String(e.message || e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [config.surah]);

  // This week's reader for a bucket: the round-robin pick (advanced via its ptr),
  // unless a valid manual override is set. Returns an index, or -1 for an empty bucket.
  // Pass override=null to get the plain rotation pick, ignoring any override.
  const readerIndex = (b, override = readerOverride[b.id]) => {
    if (!b.members.length) return -1;
    if (override != null && b.members.includes(override)) return b.members.indexOf(override);
    return (b.ptr || 0) % b.members.length;
  };
  const readerOf = (b) => { const i = readerIndex(b); return i < 0 ? null : b.members[i]; };

  // Buckets toggled off this week contribute no reader and aren't rotated on "Mark as sent".
  const readersByBucket = Object.fromEntries(
    config.buckets.map((b) => [b.id, bucketsOff[b.id] ? null : readerOf(b)]));
  const members = config.buckets.map((b) => readersByBucket[b.id]).filter(Boolean);
  const weights = members.map((m) => config.weights[m] ?? 5);
  const offCount = config.buckets.filter((b) => bucketsOff[b.id]).length;
  // An override is "active" when a bucket resolves to a different reader than the plain rotation.
  const overrideActive = config.buckets.some(
    (b) => !bucketsOff[b.id] && readerIndex(b) !== readerIndex(b, null));

  // this week's sections
  const weekSections = useMemo(() => {
    if (!sections) return [];
    return pickWeek(sections, config.startAyah, config.wordBudget, Math.max(1, members.length));
  }, [sections, config.startAyah, config.wordBudget, members.length]);

  // Cumulative word totals at each section boundary from the start ayah, so the budget
  // slider can snap to land coverage exactly on a section (instead of mid-section).
  const budgetStops = useMemo(() => {
    if (!sections) return [];
    let start = sections.findIndex((s) => s.ayahEnd >= config.startAyah);
    if (start < 0) start = 0;
    const stops = [];
    let sum = 0;
    for (let i = start; i < sections.length; i++) { sum += sections[i].words; stops.push(sum); }
    return stops;
  }, [sections, config.startAyah]);
  const snapBudget = (v) => {
    if (!budgetStops.length) return v;
    let best = budgetStops[0];
    for (const s of budgetStops) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    return Math.min(14000, Math.max(500, best));
  };

  // recompute algorithmic splits whenever the inputs change (unless user is hand-tuning).
  // Cheap enough to run each render; the effect below keys on the content, not the ref.
  const algoSplits = computeSplits(weekSections, weights);
  useEffect(() => { setSplits(algoSplits); setManualSplits(false); }, [algoSplits.join(",")]);

  const assignments = useMemo(
    () => buildAssignments(weekSections, members, splits),
    [weekSections, members, splits]
  );

  const totalWords = weekSections.reduce((a, s) => a + s.words, 0);
  const weekStart = weekSections[0]?.ayahStart;
  const weekEnd = weekSections[weekSections.length - 1]?.ayahEnd;
  const message = useMemo(() => generateMessage(config.surah, assignments, config.templates),
    [config.surah, assignments, config.templates]);

  // options for the searchable pickers
  const surahOptions = useMemo(
    () => SURAH_NAMES.map((nm, i) => ({ value: i + 1, label: `${i + 1}. ${nm}` })), []);
  const ayahOptions = useMemo(
    () => (sections || []).map((s, i) => ({
      key: i,
      value: s.ayahStart,
      label: s.ayahStart === s.ayahEnd ? `Ayat ${s.ayahStart}` : `Ayat ${s.ayahStart}–${s.ayahEnd}`,
      hint: s.title,
    })), [sections]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1600); };

  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); flash("Copied to clipboard"); }
    catch (e) { flash("Copy failed — select the text manually"); }
  };

  const markSent = () => {
    // Advance each active bucket past whoever read this week, then move the start ayah forward.
    // Buckets toggled off don't go forward (their ptr is untouched).
    const buckets = config.buckets.map((b) => {
      if (bucketsOff[b.id] || !b.members.length) return b;
      return { ...b, ptr: (readerIndex(b) + 1) % b.members.length };
    });
    setConfig({ ...config, buckets, startAyah: (weekEnd || config.startAyah) + 1 });
    setReaderOverride({});
    setBucketsOff({}); // toggles reset — buckets are back on next week
    flash("Marked as sent — active buckets rotated to the next reader");
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "halaqa-config.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importConfig = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { setConfig(normalizeConfig(JSON.parse(r.result))); flash("Config imported"); } catch (err) { flash("Invalid config file"); } };
    r.readAsText(file);
  };

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="brand">
          <span className="ornament" aria-hidden="true">۞</span>
          <div className="brandText">
            <span className="kicker" aria-hidden="true">﷽</span>
            <h1>Halaqa Reading Planner</h1>
            <span className="sub">Tafsir Ibn Kathir · {surahName(config.surah)}</span>
          </div>
        </div>
        <span className="wordmark" aria-hidden="true">حَلْقَة</span>
      </header>
      <p className="lede">
        Pick where to start and how much to cover, see the split, fine-tune, then copy the WhatsApp message.
      </p>

      {/* Full-width command bar — the parameters that define this week */}
      <div className="card commandbar">
        <h2>This week</h2>
        <div className="cbRow">
          <div className="field">
            <label>Surah</label>
            <Combobox options={surahOptions}
                      display={`${config.surah}. ${surahName(config.surah)}`}
                      placeholder="Search surah by name or number…"
                      onSelect={(v) => setConfig({ ...config, surah: +v })} />
          </div>
          <div className="field">
            <label>Start at Ayah</label>
            <Combobox options={ayahOptions}
                      display={`Ayat ${config.startAyah}`}
                      placeholder="Search ayah number or section…"
                      allowNumber
                      onNumber={(n) => setConfig({ ...config, startAyah: n })}
                      onSelect={(v) => setConfig({ ...config, startAyah: +v })} />
          </div>
        </div>
        <div className="budgetBar">
          <div className="budgetField">
            <label>How much this week — word budget: <b className="stat">{config.wordBudget.toLocaleString()}</b></label>
            <input type="range" min="500" max="14000" step="50" value={config.wordBudget}
                   onChange={(e) => setConfig({ ...config, wordBudget: snapBudget(+e.target.value) })} />
            <div className="row muted budgetHint"><span>lighter week</span><span>heavier week</span></div>
          </div>
        </div>
        <div className="row cbPills">
          <span className="pill">This week's readers: <b style={{ color: "var(--text)" }}>{members.length ? members.join(", ") : "—"}</b></span>
          {overrideActive && <span className="pill warn">override active</span>}
          {offCount > 0 && <span className="pill warn">{offCount} bucket{offCount === 1 ? "" : "s"} off this week</span>}
          {weekStart != null &&
            <span className="pill">Covers Ayat {weekStart}–{weekEnd} · {weekSections.length} sections · {totalWords.toLocaleString()} words · {readingTime(totalWords)} read</span>}
          {loading && <span className="pill">Loading surah…</span>}
        </div>
        {error && <div className="err" style={{ marginTop: 10 }}>Couldn't load tafsir: {error}. Check your connection (first load needs internet; it's cached afterwards).</div>}
      </div>

      <div className="grid">
        {/* Availability buckets (left) and the split view (right) — kept to equal height */}
        <BucketEditor config={config} setConfig={setConfig}
                      readersByBucket={readersByBucket}
                      setReaderForBucket={(bucket, member) => setReaderOverride((o) => ({ ...o, [bucket]: member }))}
                      bucketsOff={bucketsOff}
                      toggleBucket={toggleBucket}
                      hasOverrides={overrideActive}
                      clearOverrides={() => setReaderOverride({})} />

        <div className="card">
          <h2>Split — drag the dividers to fine-tune</h2>
          {weekSections.length === 0 ? (
            <p className="muted">No content yet. Pick a surah/start ayah.</p>
          ) : (
            <>
              <SplitBar weekSections={weekSections} assignments={assignments} splits={splits} setSplits={(s) => { setSplits(s); setManualSplits(true); }} />
              <div className="row" style={{ marginTop: 8 }}>
                {manualSplits && <button className="sm" onClick={() => { setSplits(algoSplits); setManualSplits(false); }}>↺ Re-balance by weight</button>}
                <span className="spacer" />
                <span className="muted" style={{ fontSize: 13 }}>{members.length} readers · weights drive the default split</span>
              </div>
              <div style={{ marginTop: 12 }}>
                {assignments.map((a, i) => (
                  <div className="member" key={a.name}>
                    <div className="head">
                      <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <b>{a.name}</b>
                      <span className="muted">· {ayahRange(a)} · {a.words.toLocaleString()} words · {readingTime(a.words)} · {a.sections.length} section(s)</span>
                    </div>
                    {a.sections.map((s, j) => (
                      <div className="sec" key={j}>• {s.title} <span className="w">({s.words}w)</span></div>
                    ))}
                    {!a.sections.length && <div className="sec warn">No sections — increase the word budget or reduce readers.</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Templates & backup — full-width band spanning both columns */}
      <details className="card templatesCard">
        <summary>Message templates &amp; config backup</summary>
        <div style={{ marginTop: 12 }}>
          <label>Intro <span className="muted">({"{surah}"} is replaced)</span></label>
          <textarea style={{ minHeight: 110 }} value={config.templates.intro}
            onChange={(e) => setConfig({ ...config, templates: { ...config.templates, intro: e.target.value } })} />
          <label style={{ marginTop: 8 }}>Outro</label>
          <textarea style={{ minHeight: 70 }} value={config.templates.outro}
            onChange={(e) => setConfig({ ...config, templates: { ...config.templates, outro: e.target.value } })} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="sm" onClick={exportConfig}>Export config</button>
            <label className="pill" style={{ cursor: "pointer" }}>
              Import config<input type="file" accept="application/json" onChange={importConfig} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </details>

      {/* Full-width output — the actual product of the tool */}
      <div className="card output">
        <div className="outputGrid">
          <div className="outputMain">
            <div className="outputHead">
              <h2>WhatsApp message</h2>
              <span className="outputMeta">
                Preview · {members.length} reader{members.length === 1 ? "" : "s"}
                {weekStart != null ? ` · Ayat ${weekStart}–${weekEnd} · ${readingTime(totalWords)} read` : ""} · Surah {surahName(config.surah)}
              </span>
            </div>
            <textarea value={message} readOnly />
          </div>
          <div className="outputSide">
            <button className="primary big" onClick={copyMessage}>📋 Copy message</button>
            <button className="markBtn" onClick={markSent}
                    title="Rotate each bucket to its next reader and move the start ayah forward">✓ Mark as sent</button>
            <p className="outputNote muted">“Mark as sent” rotates each bucket to its next reader and moves the start ayah forward for next week.</p>
            <div className="nextNote">Next week starts at <b className="stat">Ayat {(weekEnd || config.startAyah) + 1}</b></div>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
