import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import {
  WEEKDAY_LABELS,
  addMonths,
  fmtHours,
  monthDays,
  monthLabel,
  parseISO,
  todayISO,
  weekdayIndex,
} from "../lib/dates";
import { resolveDay } from "../lib/schedule";

export function Month({
  date,
  setDate,
  onPickDay,
}: {
  date: string;
  setDate: (iso: string) => void;
  onPickDay: (iso: string) => void;
}) {
  const children = useLiveQuery(() => db.children.toArray(), []) ?? [];
  const days = monthDays(date);
  const monthPrefix = date.slice(0, 7);
  const logs =
    useLiveQuery(
      () => db.dayLogs.where("date").between(days[0], days[days.length - 1], true, true).toArray(),
      [monthPrefix]
    ) ?? [];
  const today = todayISO();

  const dayInfo = (iso: string) => {
    let attended = 0;
    let absent = 0;
    let adjusted = false;
    let minutes = 0;
    for (const c of children) {
      const log = logs.find((l) => l.childId === c.id && l.date === iso);
      const r = resolveDay(c, iso, log);
      if (!r) continue;
      if (r.absence) absent++;
      else {
        attended++;
        minutes += r.minutes;
      }
      if (r.source === "log") adjusted = true;
    }
    return { attended, absent, adjusted, minutes };
  };

  const leading = weekdayIndex(days[0]);
  const totalMinutes = days.reduce((s, d) => s + dayInfo(d).minutes, 0);

  return (
    <>
      <div className="date-nav">
        <button className="nav-btn" onClick={() => onMonthShift(-1)} aria-label="Previous month">‹</button>
        <div className="date-label"><strong>{monthLabel(date)}</strong></div>
        <button className="nav-btn" onClick={() => onMonthShift(1)} aria-label="Next month">›</button>
      </div>

      <div className="month-grid">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="month-head">{w[0]}</span>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <span key={`pad${i}`} />
        ))}
        {days.map((iso) => {
          const info = dayInfo(iso);
          const busy = info.attended + info.absent > 0;
          return (
            <button
              key={iso}
              className={`month-day${iso === today ? " today" : ""}${busy ? " busy" : ""}`}
              onClick={() => onPickDay(iso)}
            >
              <span className="num">{parseISO(iso).d}</span>
              <span className="dots">
                {Array.from({ length: Math.min(info.attended, 4) }).map((_, i) => (
                  <i key={`a${i}`} className="d-att" />
                ))}
                {Array.from({ length: Math.min(info.absent, 4) }).map((_, i) => (
                  <i key={`x${i}`} className="d-abs" />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <p className="day-total hours">{fmtHours(totalMinutes)} across {monthLabel(date)}</p>
      <p className="hint center">Tap a day to view or adjust it. Funded-week shading arrives with term dates.</p>
    </>
  );

  function onMonthShift(n: number) {
    setDate(addMonths(date, n));
  }
}
