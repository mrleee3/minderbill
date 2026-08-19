import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type ChildContract } from "../db";
import type { Closure } from "../data/closures";
import { fmtDateLong, fmtHours, minToInput, monthDays, monthLabel } from "../lib/dates";
import { resolveDay } from "../lib/schedule";
import { ABSENCE_LABELS, DayEditor } from "./DayEditor";
import { Sheet } from "./Sheet";

/**
 * Every day this child has (or should have had) in the month, so she can see
 * the pattern at a glance and fix any of them without hunting the calendar.
 */
export function ChildMonthHistory({
  child,
  month,
  closures,
}: {
  child: ChildContract;
  month: string; // any ISO date in the month
  closures: Closure[];
}) {
  const days = monthDays(month);
  const logsQ =
    useLiveQuery(
      () =>
        db.dayLogs
          .where("childId")
          .equals(child.id!)
          .and((l) => l.date >= days[0] && l.date <= days[days.length - 1])
          .toArray(),
      [child.id, month]
    );
  const logs = logsQ ?? [];
  const [editing, setEditing] = useState<string | null>(null);

  const rows = days
    .map((iso) => ({
      iso,
      log: logs.find((l) => l.date === iso),
      resolved: resolveDay(child, iso, logs.find((l) => l.date === iso), closures),
    }))
    .filter((r) => r.resolved);

  const attended = rows.filter((r) => !r.resolved!.absence);
  const totalMin = attended.reduce((s, r) => s + r.resolved!.minutes, 0);
  const absences = rows.filter((r) => r.resolved!.absence);

  if (logsQ === undefined) return <div className="screen-skeleton" aria-hidden="true" />;

  return (
    <>
      <div className="history-summary">
        <span>
          <strong className="hours">{attended.length}</strong> days attended
        </span>
        <span>
          <strong className="hours">{fmtHours(totalMin)}</strong> total
        </span>
        {absences.length > 0 && (
          <span>
            <strong className="hours">{absences.length}</strong> absent
          </span>
        )}
      </div>

      {rows.length === 0 && (
        <p className="hint">No days for {child.name} in {monthLabel(month)}.</p>
      )}

      <div className="history-list">
        {rows.map(({ iso, resolved }) => (
          <button key={iso} className="history-row" onClick={() => setEditing(iso)}>
            <span className="history-date">{fmtDateLong(iso)}</span>
            {resolved!.absence ? (
              <span className="status absent">
                {resolved!.closureLabel ?? ABSENCE_LABELS[resolved!.absence]}
              </span>
            ) : (
              <span className="history-hours hours">
                {minToInput(resolved!.startMin)}–{minToInput(resolved!.endMin)}
                <span className="dot-sep">·</span>
                {fmtHours(resolved!.minutes)}
              </span>
            )}
            <span
              className={`status-chip ${
                resolved!.absence ? "absent" : resolved!.source === "log" ? "adjusted" : "planned"
              }`}
            >
              {resolved!.absence ? "Absent" : resolved!.source === "log" ? "Adjusted" : "Planned"}
            </span>
          </button>
        ))}
      </div>

      <Sheet
        open={!!editing}
        title={editing ? `${child.name} — ${fmtDateLong(editing)}` : ""}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <DayEditor
            child={child}
            date={editing}
            resolved={resolveDay(child, editing, logs.find((l) => l.date === editing), closures)}
            log={logs.find((l) => l.date === editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}
