import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type DayLog } from "../db";
import { addDays, fmtDateLong, fmtHours, minToInput, todayISO,
  ageLabel,
} from "../lib/dates";
import { resolveDay } from "../lib/schedule";
import { childColour, getClosures } from "../lib/settings";
import { CLOSURE_COLOURS, CLOSURE_LABELS, closureOn, type Closure } from "../data/closures";
import { confirmDay, unconfirmDay } from "../lib/confirm";
import { Sheet } from "../components/Sheet";
import { ABSENCE_LABELS, DayEditor } from "../components/DayEditor";

export function Today({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const childrenQ = useLiveQuery(() => db.children.toArray(), []);
  const loading = childrenQ === undefined;
  const allChildren = childrenQ ?? [];
  // Children who have left are archived — hide them once past their end date.
  const children = allChildren.filter((c) => !c.endDate || c.endDate >= date);
  const logs =
    useLiveQuery(() => db.dayLogs.where("date").equals(date).toArray(), [date]) ?? [];
  const [editing, setEditing] = useState<ChildContract | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);

  useEffect(() => {
    getClosures().then(setClosures);
  }, []);

  const closure = closureOn(date, closures);
  const confirm = useLiveQuery(() => db.confirms.get(date), [date]);
  const isConfirmed = !!confirm;

  const logFor = (c: ChildContract): DayLog | undefined =>
    logs.find((l) => l.childId === c.id);

  const rows = children
    .map((c, i) => ({ child: c, colour: childColour(c, i), log: logFor(c), resolved: resolveDay(c, date, logFor(c), closures) }))
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

      {closure && (
        <div className="closure-note" style={{ borderColor: CLOSURE_COLOURS[closure.kind] }}>
          <strong>{closure.label}</strong>
          <span className="hint">
            Everyone is marked "{CLOSURE_LABELS[closure.kind]}". Tap a child to override.
          </span>
        </div>
      )}

      {loading && <div className="screen-skeleton" aria-hidden="true" />}

      {!loading && children.length === 0 && (
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
            <span className="card-name">
                {child.name}
                {child.dob && <span className="age"> ({ageLabel(child.dob, date)})</span>}
              </span>
            {resolved!.absence ? (
              <span className="status absent">{ABSENCE_LABELS[resolved!.absence]}</span>
            ) : (
              <span className="card-time hours">
                {minToInput(resolved!.startMin)}–{minToInput(resolved!.endMin)}
                <span className="dot-sep">·</span>
                {fmtHours(resolved!.minutes)}
              </span>
            )}
            {isConfirmed && resolved!.source === "log" && !resolved!.absence && (
              <span className="card-note">Adjusted from planned</span>
            )}
            {resolved!.note && <span className="card-note">{resolved!.note}</span>}
          </span>
          <span
            className={`status-chip ${
              isConfirmed
                ? "confirmed"
                : resolved!.absence
                  ? "absent"
                  : resolved!.source === "log"
                    ? "adjusted"
                    : "planned"
            }`}
          >
            {isConfirmed
              ? "✓ Confirmed"
              : resolved!.absence
                ? "Absent"
                : resolved!.source === "log"
                  ? "Adjusted"
                  : "As planned"}
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
                <span className="card-name">
                {child.name}
                {child.dob && <span className="age"> ({ageLabel(child.dob, date)})</span>}
              </span>
              </span>
              <span className="status-chip add">+ Log attendance</span>
            </button>
          ))}
        </>
      )}

      {attending.length > 0 && (
        <div className={`confirm-bar${isConfirmed ? " done" : ""}`}>
          {isConfirmed ? (
            <>
              <span className="confirm-text">
                <strong>✓ Day confirmed</strong>
                <span className="hint">
                  {new Date(confirm!.at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <button className="btn-quiet inline" onClick={() => unconfirmDay(date)}>
                Undo
              </button>
            </>
          ) : (
            <>
              <span className="confirm-text">
                <strong>Everything right for {isToday ? "today" : "this day"}?</strong>
                <span className="hint">Adjust any child above first, then confirm.</span>
              </span>
              <button className="btn-primary inline" onClick={() => confirmDay(date)}>
                Confirm day
              </button>
            </>
          )}
        </div>
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
            resolved={resolveDay(editing, date, logFor(editing), closures)}
            log={logFor(editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}
