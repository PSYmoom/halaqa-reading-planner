import { COLORS } from "../config/constants.ts";
import { ayahRange, readingTime, sectionHeading } from "../utils/message.ts";
import { SplitBar } from "./SplitBar.tsx";
import type { Assignment, Section, WeekPlan } from "../types.ts";

// Collapse consecutive sections sharing an ayah range, so the range shows once.
function groupByRange(sections: Section[]): Section[][] {
  const groups: Section[][] = [];
  for (const s of sections) {
    const last = groups[groups.length - 1];
    if (last && last[0].ayahStart === s.ayahStart && last[0].ayahEnd === s.ayahEnd) last.push(s);
    else groups.push([s]);
  }
  return groups;
}

interface AssignmentRowProps {
  assignment: Assignment;
  color: string;
  wpm: number;
}

/** One reader's portion: name, totals, and the sections it spans. */
function AssignmentRow({ assignment, color, wpm }: AssignmentRowProps) {
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

interface SplitPanelProps {
  week: WeekPlan;
  wpm: number;
}

/** The split view — the draggable divider bar plus per-reader assignment details. */
export function SplitPanel({ week, wpm }: SplitPanelProps) {
  const {
    weekSections,
    assignments,
    splits,
    setSplits,
    setOrder,
    manualSplits,
    reordered,
    resetSplits,
  } = week;

  return (
    <div className="card">
      <h2>Split — drag dividers to resize and names to reorder</h2>
      {weekSections.length === 0 ? (
        <p className="muted">No content yet. Pick a surah/start ayah.</p>
      ) : (
        <>
          <SplitBar
            weekSections={weekSections}
            assignments={assignments}
            splits={splits}
            setSplits={setSplits}
            setOrder={setOrder}
          />
          <div className="row splitActions">
            {(manualSplits || reordered) && (
              <button
                className="sm"
                onClick={resetSplits}
                title="Re-divide by weight, readers in list order"
              >
                ↺ Auto-balance
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
            {assignments.map((a) => (
              <AssignmentRow
                key={a.name}
                assignment={a}
                color={COLORS[a.ord % COLORS.length]}
                wpm={wpm}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
