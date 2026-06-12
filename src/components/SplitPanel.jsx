import { COLORS } from "../constants.js";
import { ayahRange, readingTime } from "../message.js";
import { SplitBar } from "./SplitBar.jsx";

// One reader's portion: name, totals, and the sections it spans.
function AssignmentRow({ assignment, color }) {
  const meta = `· ${ayahRange(assignment)} · ${assignment.words.toLocaleString()} words` +
               ` · ${readingTime(assignment.words)} · ${assignment.sections.length} section(s)`;
  return (
    <div className="member">
      <div className="head">
        <span className="dot" style={{ background: color }} />
        <b>{assignment.name}</b>
        <span className="muted">{meta}</span>
      </div>
      {assignment.sections.map((s, i) => (
        <div className="sec" key={i}>• {s.title} <span className="w">({s.words}w)</span></div>
      ))}
      {!assignment.sections.length && (
        <div className="sec warn">No sections — increase the word budget or reduce readers.</div>
      )}
    </div>
  );
}

/** The split view — the draggable divider bar plus per-reader assignment details. */
export function SplitPanel({ week, memberCount }) {
  const { weekSections, assignments, splits, setSplits, manualSplits, resetSplits } = week;

  return (
    <div className="card">
      <h2>Split — drag the dividers to fine-tune</h2>
      {weekSections.length === 0 ? (
        <p className="muted">No content yet. Pick a surah/start ayah.</p>
      ) : (
        <>
          <SplitBar weekSections={weekSections} assignments={assignments}
                    splits={splits} setSplits={setSplits} />
          <div className="row splitActions">
            {manualSplits && <button className="sm" onClick={resetSplits}>↺ Re-balance by weight</button>}
            <span className="spacer" />
            <span className="muted splitNote">{memberCount} readers · weights drive the default split</span>
          </div>
          <div className="assignmentList">
            {assignments.map((a, i) => (
              <AssignmentRow key={a.name} assignment={a} color={COLORS[i % COLORS.length]} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
