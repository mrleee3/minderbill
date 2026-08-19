import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type DayLog } from "../db";
import {
  WEEKDAY_LABELS,
  addMonths,
  fmtDateLong,
  fmtHours,
  minToInput,
  monthDays,
  monthLabel,
  parseISO,
  todayISO,
  weekdayIndex,
  ageLabel,
} from "../lib/dates";
import { resolveDay } from "../lib/schedule";
import { childColour } from "../lib/settings";
import { Sheet } from "../components/Sheet";
import { useEffect } from "react";
import { getClosures, getTermBlocks } from "../lib/settings";
import { CLOSURE_COLOURS, CLOSURE_LABELS, closureOn, type Closure } from "../data/closures";
import type { TermBlock } from "../data/surrey";
import { ABSENCE_LABELS } from "../components/DayEditor";
import { ChildMonthHistory } from "../components/ChildMonthHistory";
import { hasAttendance } from "../lib/confirm";
import { useSwipe } from "../lib/useSwipe";

export function Month() {
  const [viewDate, setViewDate] = useState(todayISO());
  const [selDay, setSelDay] = useState(todayISO());
  const [editing, setEditing] = useState<ChildContract | null>(null);

  const allChildren = useLiveQuery(() => db.children.toArray(), []) ?? [];
  const [closures, setClosureList] = useState<Closure[]>([]);
  // Show a child in a month if their contract overlapped any of it.
  const children = allChildren.filter(
    (c) => !c.endDate || c.endDate >= viewDate.slice(0, 8) + "01"
  );
  const [terms, setTerms] = useState<TermBlock[]>([]);

  useEffect(() => {
    getClosures().then(setClosureList);
    getTermBlocks().then(setTerms);
  }, []);

  const inTerm = (iso: string) => terms.some((t) => t.start <= iso && iso <= t.end);
  const days = monthDays(viewDate);
  const monthPrefix = viewDate.slice(0, 7);
  const logs =
    useLiveQuery(
      () => db.dayLogs.where("date").between(days[0], days[days.length - 1], true, true).toArray(),
      [monthPrefix]
    ) ?? [];
  const today = todayISO();
  const confirms =
    useLiveQuery(
      () => db.confirms.where("date").between(days[0], days[days.length - 1], true, true).toArray(),
      [monthPrefix]
    ) ?? [];
  const confirmed = new Set(confirms.map((c) => c.date));

  const logFor = (c: ChildContract, iso: string): DayLog | undefined =>
    logs.find((l) => l.childId === c.id && l.date === iso);

  const shiftMonth = (n: number) => {
    const next = addMonths(viewDate, n);
    setViewDate(next);
    setSelDay(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };

  const [slide, setSlide] = useState<"" | "in-left" | "in-right">("");
  const shiftMonthAnimated = (n: number) => {
    shiftMonth(n);
    setSlide(n > 0 ? "in-right" : "in-left");
    window.setTimeout(() => setSlide(""), 240);
  };
  const swipe = useSwipe(() => shiftMonthAnimated(1), () => shiftMonthAnimated(-1));
  const leading = weekdayIndex(days[0]);
  const totalMinutes = days.reduce((sum, iso) => {
    for (const c of children) {
      const r = resolveDay(c, iso, logFor(c, iso), closures);
      if (r && !r.absence) sum += r.minutes;
    }
    return sum;
  }, 0);

  const selRows = children
    .map((c, i) => ({
      child: c,
      colour: childColour(c, i),
      log: logFor(c, selDay),
      resolved: resolveDay(c, selDay, logFor(c, selDay), closures),
    }))
    .sort((a, b) => (a.resolved?.startMin ?? 9999) - (b.resolved?.startMin ?? 9999));

  return (
    <>
      <div className="date-nav">
        <button className="nav-btn" onClick={() => shiftMonthAnimated(-1)} aria-label="Previous month">‹</button>
        <div className="date-label"><strong>{monthLabel(viewDate)}</strong></div>
        <button className="nav-btn" onClick={() => shiftMonthAnimated(1)} aria-label="Next month">›</button>
      </div>

      <div className={`month-grid ${slide}`} {...swipe}>
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="month-head">{w[0]}</span>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <span key={`pad${i}`} />
        ))}
        {days.map((iso) => {
          const dots = children
            .map((c, i) => {
              const r = resolveDay(c, iso, logFor(c, iso), closures);
              if (!r) return null;
              return { colour: childColour(c, i), absent: !!r.absence };
            })
            .filter(Boolean) as { colour: string; absent: boolean }[];
          const closure = closureOn(iso, closures);
          const needsConfirm =
            iso < today && !confirmed.has(iso) && hasAttendance(children, iso, logs, closures);
          return (
            <button
              key={iso}
              className={`month-day${iso === today ? " today" : ""}${dots.length ? " busy" : ""}${iso === selDay ? " sel" : ""}${terms.length && !inTerm(iso) ? " out-of-term" : ""}${needsConfirm ? " needs-confirm" : ""}${confirmed.has(iso) ? " confirmed" : ""}`}
              onClick={() => setSelDay(iso)}
              title={closure?.label}
            >
              <span
                className="closure-bar"
                style={{
                  background: closure ? CLOSURE_COLOURS[closure.kind] : "transparent",
                }}
              />
              <span className="num">{parseISO(iso).d}</span>
              <span className="dots">
                {dots.slice(0, 4).map((d, i) => (
                  <i key={i} style={{ background: d.absent ? "transparent" : d.colour, borderColor: d.absent ? "var(--clay)" : d.colour }} className={d.absent ? "d-ring" : ""} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="day-total hours">{fmtHours(totalMinutes)} across {monthLabel(viewDate)}</p>
      <div className="legend">
        <span><i className="swatch ring-today" /> Today</span>
        <span><i className="swatch ring-unconfirmed" /> To confirm</span>
        <span><i className="swatch ring-confirmed" /> Confirmed</span>
        <span><i className="swatch term" /> Outside term</span>
        <span><i className="swatch" style={{ background: CLOSURE_COLOURS.minderHoliday }} /> {CLOSURE_LABELS.minderHoliday}</span>
        <span><i className="swatch" style={{ background: CLOSURE_COLOURS.bankHoliday }} /> {CLOSURE_LABELS.bankHoliday}</span>
      </div>

      <div className="form-section">{selDay === today ? "Today" : fmtDateLong(selDay)}</div>
      {(() => {
        const c = closureOn(selDay, closures);
        return c ? (
          <div className="closure-note" style={{ borderColor: CLOSURE_COLOURS[c.kind] }}>
            <strong>{c.label}</strong>
            <span className="hint">
              Everyone's day is set to "{CLOSURE_LABELS[c.kind]}" and charged by each child's
              policy. Tap a child to override just them.
            </span>
          </div>
        ) : terms.length && !inTerm(selDay) ? (
          <p className="hint">Outside term dates — no funded hours on this day.</p>
        ) : null;
      })()}
      {selRows.filter((r) => r.resolved).length === 0 && (
        <p className="hint">No children attending this day. Tap a child below to log an extra day.</p>
      )}
      {selRows
        .filter((r) => r.resolved)
        .map(({ child, colour, resolved }) => (
          <button key={child.id} className="child-card" onClick={() => setEditing(child)}>
            <span className="avatar" style={{ background: colour }}>
              <span className="avatar-letter">{child.name[0]?.toUpperCase()}</span>
            </span>
            <span className="card-main">
              <span className="card-name">
                {child.name}
                {child.dob && <span className="age"> ({ageLabel(child.dob, selDay)})</span>}
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
            </span>
            <span className={`status-chip ${resolved!.absence ? "absent" : resolved!.source === "log" ? "adjusted" : "planned"}`}>
              {resolved!.absence ? "Absent" : resolved!.source === "log" ? "Adjusted" : "As planned"}
            </span>
          </button>
        ))}
      {selRows
        .filter((r) => !r.resolved)
        .map(({ child, colour }) => (
          <button key={child.id} className="child-card quiet" onClick={() => setEditing(child)}>
            <span className="avatar muted" style={{ background: `${colour}33` }}>
              <span className="avatar-letter muted-letter">{child.name[0]?.toUpperCase()}</span>
            </span>
            <span className="card-main">
              <span className="card-name">
                {child.name}
                {child.dob && <span className="age"> ({ageLabel(child.dob, selDay)})</span>}
              </span>
            </span>
            <span className="status-chip add">+ Log attendance</span>
          </button>
        ))}

      <Sheet
        open={!!editing}
        title={editing ? `${editing.name} — ${monthLabel(viewDate)}` : ""}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ChildMonthHistory child={editing} month={viewDate} closures={closures} />
        )}
      </Sheet>
    </>
  );
}
