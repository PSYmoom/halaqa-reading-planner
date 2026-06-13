import { useState } from "react";
import { surahName } from "../config/constants.js";
import { readingTime } from "../utils/message.js";

/**
 * Full-width output — the actual product of the tool: the WhatsApp message
 * preview, the copy button, and "Mark as sent". The intro/outro templates are
 * edited in place here (toggle "Edit text"), so the preview is the editor: the
 * read-only message and the fields that shape it share the same frame.
 */
export function OutputPanel({
  message,
  surah,
  memberCount,
  week,
  wpm,
  templates,
  setTemplates,
  nextLabel,
  onMarkSent,
  flash,
}) {
  const [editing, setEditing] = useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      flash("Copied to clipboard");
    } catch {
      flash("Copy failed — select the text manually");
    }
  };

  const setIntro = (intro) => setTemplates({ ...templates, intro });
  const setOutro = (outro) => setTemplates({ ...templates, outro });

  const readerLabel = `${memberCount} reader${memberCount === 1 ? "" : "s"}`;
  const coverage =
    week.weekStart != null
      ? ` · Ayat ${week.weekStart}–${week.weekEnd} · ${readingTime(week.totalWords, wpm)} read`
      : "";

  return (
    <div className="card output">
      <div className="outputGrid">
        <div className="outputMain">
          <div className="outputHead">
            <h2>WhatsApp message</h2>
            <span className="outputMeta">
              {editing ? "Editing" : "Preview"} · {readerLabel}
              {coverage} · Surah {surahName(surah)}
            </span>
            <button
              type="button"
              className={"editToggle" + (editing ? " active" : "")}
              onClick={() => setEditing((v) => !v)}
              aria-pressed={editing}
              title={editing ? "Back to the message preview" : "Edit the intro and outro text"}
            >
              {editing ? "✓ Done" : "✎ Edit text"}
            </button>
          </div>

          {editing ? (
            <div className="templateEditor">
              <label className="tmplLabel">
                Intro <span className="muted">({"{surah}"} becomes the surah name)</span>
              </label>
              <textarea
                className="introBox"
                value={templates.intro}
                onChange={(e) => setIntro(e.target.value)}
              />
              <div className="tmplDivider">
                <span>
                  <i>۞</i> reading list · generated from the split
                </span>
              </div>
              <label className="tmplLabel">Outro</label>
              <textarea
                className="outroBox"
                value={templates.outro}
                onChange={(e) => setOutro(e.target.value)}
              />
            </div>
          ) : (
            <textarea className="previewBox" value={message} readOnly />
          )}
        </div>
        <div className="outputSide">
          <button className="primary big" onClick={copyMessage}>
            📋 Copy message
          </button>
          <button
            className="markBtn"
            onClick={onMarkSent}
            title="Rotate each bucket to its next reader and move the start ayah forward"
          >
            <span className="btnIcon">✓</span>Mark as sent
          </button>
          <p className="outputNote muted">
            “Mark as sent” rotates each bucket to its next reader and moves the start ayah forward
            for next week.
          </p>
          <div className="nextNote">
            Next week starts at <b className="stat">{nextLabel}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
