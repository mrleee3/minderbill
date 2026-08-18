import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type DayLog } from "../db";
import { addDays, fmtDateLong, fmtHours, minToInput, todayISO } from "../lib/dates";
import { resolveDay } from "../lib/schedule";
import { childColour } from "../lib/settings";
import { Sheet } from "../components/Sheet";
import { ABSENCE_LABELS, DayEditor } from "../components/DayEditor";

export function Today({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const children = useLiveQuery(() => db.children.toArray(), []) ?? [];
  const logs =
    useLiveQuery(() => db.dayLogs.where("date").equals(date).toArray(), [date]) ?? [];
  const [editing, setEditing] = useState<ChildContract | null>(null);

  const logFor = (c: ChildContract): DayLog | undefined =>
    logs.find((l) => l.childId === c.id);

  const rows = children
    .map((c, i) => ({ child: c, colour: childColour(c, i), log: logFor(c), resolved: resolveDay(c, date, logFor(c)) }))
    .sort((a, b) => (a.resolved?.startMin ?? 9999) - (b.resolved?.startMin ?? 9999));

  const attending = rows.filter((r) => r.resolved);
  const notToday = rows.filter((r) => !r.resolved);
  const totalMin = attending.reduce(
    (s, r) => s + (r.resolved!.absence ? 0 : r.resolved!.minutes),
    0
  );
  const isToday = date === todayISO();

  return (
    <>
      <div className="date-nav">
        <button className="nav-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <div className="date-label">
          <strong>{isToday ? "Today" : fmtDateLong(date)}</strong>
          {isToday && <span className="hint"> {fmtDateLong(date)}</span>}
          {!isToday && (
            <button className="link" onClick={() => setDate(todayISO())}>Back to today</button>
          )}
        </div>
        <button className="nav-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
      </div>

      {children.length === 0 && (
        <div className="empty">
          <span className="glyph">☀️</span>
          <p><strong>Nothing to log yet</strong></p>
          <p>Add your children in the Children tab and each day will be pre-filled here.</p>
        </div>
      )}

      {attending.map(({ child, colour, resolved }) => (
        <button key={child.id} className="child-card" onClick={() => setEditing(child)}>
          <span className="avatar" style={{ background: colour }}>
            <span className="avatar-letter">{child.name[0]?.toUpperCase()}</span>
          </span>
          <span className="card-main">
            <span className="card-name">{child.name}</span>
            {resolved!.absence ? (
              <span className="status absent">{ABSENCE_LABELS[resolved!.absence]}</span>
            ) : (
              <span className="card-time hours">
                {minToInput(resolved!.startMin)}–{minToInput(resolved!.endMin)}
                <span className="dot-sep">·</span>
                {fmtHours(resolved!.minutes)}
              </span>
            )}
            {resolved!.note && <span className="card-note">{resolved!.note}</span>}
          </span>
          <span className={`status-chip ${resolved!.absence ? "absent" : resolved!.source === "log" ? "adjusted" : "planned"}`}>
            {resolved!.absence ? "Absent" : resolved!.source === "log" ? "Adjusted" : "As planned"}
          </span>
        </button>
      ))}

      {attending.length > 0 && (
        <p className="day-total hours">
          {attending.filter((r) => !r.resolved!.absence).length} attending · {fmtHours(totalMin)}
        </p>
      )}

      {notToday.length > 0 && (
        <>
          <div className="form-section">Not attending {isToday ? "today" : "this day"}</div>
          {notToday.map(({ child, colour }) => (
            <button key={child.id} className="child-card quiet" onClick={() => setEditing(child)}>
              <span className="avatar muted" style={{ background: `${colour}33` }}>
                <span className="avatar-letter muted-letter">{child.name[0]?.toUpperCase()}</span>
              </span>
              <span className="card-main">
                <span className="card-name">{child.name}</span>
              </span>
              <span className="status-chip add">+ Log attendance</span>
            </button>
          ))}
        </>
      )}

      <Sheet
        open={!!editing}
        title={editing ? `${editing.name} — ${fmtDateLong(date)}` : ""}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <DayEditor
            child={editing}
            date={date}
            resolved={resolveDay(editing, date, logFor(editing))}
            log={logFor(editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}
