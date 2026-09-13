import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addMonths, fmtDateLong, monthDays, monthLabel, todayISO, weekdayIndex, WEEKDAY_LABELS } from "../lib/dates";

export function DateCalendar({ date, onChoose, onClose }: { date: string; onChoose: (date: string) => void; onClose: () => void }) {
  const [month, setMonth] = useState(date.slice(0, 7) + "-01");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal(); heading.current?.focus({ preventScroll: true });
    return () => { element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const days = monthDays(month);
  return createPortal(<dialog ref={dialog} className="care-dialog" aria-labelledby="attendance-calendar-title"
    onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => e.stopPropagation()}>
    <div className="form">
      <h2 id="attendance-calendar-title" ref={heading} tabIndex={-1}>Choose a day</h2>
      <div className="range-month-nav">
        <button type="button" className="nav-btn" aria-label="Previous calendar month" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <strong aria-live="polite">{monthLabel(month)}</strong>
        <button type="button" className="nav-btn" aria-label="Next calendar month" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="range-grid">
        {WEEKDAY_LABELS.map(day => <span key={day} className="range-weekday">{day[0]}</span>)}
        {Array.from({ length: weekdayIndex(days[0]) }, (_, i) => <span key={`blank-${i}`} />)}
        {days.map(day => <button key={day} type="button" className={`range-day${day === date ? " endpoint" : ""}`}
          aria-label={`${fmtDateLong(day)} ${day.slice(0, 4)}`} aria-pressed={day === date} aria-current={day === todayISO() ? "date" : undefined}
          onClick={() => onChoose(day)}>{Number(day.slice(-2))}</button>)}
      </div>
      <div className="care-dialog-actions">
        <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={() => onChoose(todayISO())}>Go to today</button>
      </div>
    </div>
  </dialog>, document.body);
}
