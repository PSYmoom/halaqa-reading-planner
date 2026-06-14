import { useState } from "react";
import { surahName } from "../config/constants.ts";
import { readingTime } from "../utils/message.ts";
import type { Templates, ToastAction, WeekPlan } from "../types.ts";

interface OutputPanelProps {
  message: string;
  surah: number;
  memberCount: number;
  week: WeekPlan;
  wpm: number;
  templates: Templates;
  setTemplates: (templates: Templates) => void;
  nextLabel: string;
  onMarkSent: () => void;
  flash: (message: string, action?: ToastAction | null) => void;
}

/**
 * The tool's output: WhatsApp message preview, copy button, and "Mark as sent".
 * Intro/outro templates are edited in place via the "Edit text" toggle.
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
}: OutputPanelProps) {
  const [editing, setEditing] = useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      flash("Copied to clipboard");
    } catch {
      flash("Copy failed — select the text manually");
    }
  };

  const setIntro = (intro: string) => setTemplates({ ...templates, intro });
  const setOutro = (outro: string) => setTemplates({ ...templates, outro });

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
            {week.weekStart != null && (
              <span className="outputMeta">
                {editing ? "Editing" : "Preview"} · {readerLabel}
                {coverage} · Surah {surahName(surah)}
              </span>
            )}
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
