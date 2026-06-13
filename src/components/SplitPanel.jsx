import { COLORS } from "../config/constants.js";
import { ayahRange, readingTime, sectionHeading } from "../utils/message.js";
import { SplitBar } from "./SplitBar.jsx";

// Collapse consecutive sections that share an ayah range into one group, so a
// block split into translation + subheading(s) shows its range once.
function groupByRange(sections) {
  const groups = [];
  for (const s of sections) {
    const last = groups[groups.length - 1];
    if (last && last[0].ayahStart === s.ayahStart && last[0].ayahEnd === s.ayahEnd) last.push(s);
    else groups.push([s]);
  }
  return groups;
}

// One reader's portion: name, totals, and the sections it spans.
function AssignmentRow({ assignment, color, wpm }) {
  const meta =
    `· ${ayahRange(assignment)} · ${assignment.words.toLocaleString()} words` +
    ` · ${readingTime(assignment.words, wpm)} · ${assignment.sections.length} section(s)`;
  return (
    <div className="member">
      <div className="head">
        <span className="dot" style={{ background: color }} />
        <b>{assignment.name}</b>
        <span className="muted">{meta}</span>
      </div>
      {groupByRange(assignment.sections).map((group, gi) => (
        <div className="secGroup" key={gi}>
          <div className="sec">• {ayahRange(group[0])}</div>
          {group.map((s, si) => (
            <div className="subSec" key={si}>
              – {sectionHeading(s)} <span className="w">· {s.words}w</span>
            </div>
          ))}
        </div>
      ))}
      {!assignment.sections.length && (
        <div className="sec warn">No sections — increase the word budget or reduce readers.</div>
      )}
    </div>
  );
}

/** The split view — the draggable divider bar plus per-reader assignment details. */
export function SplitPanel({ week, wpm }) {
  const { weekSections, assignments, splits, setSplits, manualSplits, resetSplits } = week;

  return (
    <div className="card">
      <h2>Split — drag the dividers to fine-tune</h2>
      {weekSections.length === 0 ? (
        <p className="muted">No content yet. Pick a surah/start ayah.</p>
      ) : (
        <>
          <SplitBar
            weekSections={weekSections}
            assignments={assignments}
            splits={splits}
            setSplits={setSplits}
          />
          <div className="row splitActions">
            {manualSplits && (
              <button className="sm" onClick={resetSplits}>
                ↺ Re-balance by weight
              </button>
            )}
            <span className="spacer" />
            <span className="splitLegend muted">
              <span className="lgItem">
                <i className="swatch plain" />
                translation
              </span>
              <span className="lgItem">
                <i className="swatch headed" />
                subheading
              </span>
            </span>
          </div>
          <div className="assignmentList">
            {assignments.map((a, i) => (
              <AssignmentRow
                key={a.name}
                assignment={a}
                color={COLORS[i % COLORS.length]}
                wpm={wpm}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
