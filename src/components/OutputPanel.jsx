import { surahName } from "../config/constants.js";
import { readingTime } from "../utils/message.js";

/**
 * Full-width output — the actual product of the tool: the WhatsApp message
 * preview, the copy button, and "Mark as sent".
 */
export function OutputPanel({ message, surah, memberCount, week, nextAyah, onMarkSent, flash }) {
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      flash("Copied to clipboard");
    } catch {
      flash("Copy failed — select the text manually");
    }
  };

  const readerLabel = `${memberCount} reader${memberCount === 1 ? "" : "s"}`;
  const coverage =
    week.weekStart != null
      ? ` · Ayat ${week.weekStart}–${week.weekEnd} · ${readingTime(week.totalWords)} read`
      : "";

  return (
    <div className="card output">
      <div className="outputGrid">
        <div className="outputMain">
          <div className="outputHead">
            <h2>WhatsApp message</h2>
            <span className="outputMeta">
              Preview · {readerLabel}
              {coverage} · Surah {surahName(surah)}
            </span>
          </div>
          <textarea value={message} readOnly />
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
            ✓ Mark as sent
          </button>
          <p className="outputNote muted">
            “Mark as sent” rotates each bucket to its next reader and moves the start ayah forward
            for next week.
          </p>
          <div className="nextNote">
            Next week starts at <b className="stat">Ayat {nextAyah}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
