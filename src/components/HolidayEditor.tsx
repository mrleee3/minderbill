import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CLOSURE_LABELS, type Closure, type ClosureKind } from "../data/closures";
import { addMonths, fmtDateLong, monthDays, monthLabel, todayISO, weekdayIndex, WEEKDAY_LABELS } from "../lib/dates";

export function HolidayEditor({ closure, onSave, onClose }: {
  closure?: Closure; onSave: (closure: Closure) => Promise<void>; onClose: () => void;
}) {
  const [start, setStart] = useState(closure?.start ?? "");
  const [end, setEnd] = useState(closure?.end ?? "");
  const [month, setMonth] = useState((closure?.start ?? todayISO()).slice(0, 7) + "-01");
  const [kind, setKind] = useState<ClosureKind>(closure?.kind ?? "minderHoliday");
  const [label, setLabel] = useState(closure?.label ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const days = monthDays(month);
  const last = end || start;
  const dayCount = start ? Math.round((Date.parse(last) - Date.parse(start)) / 86400000) + 1 : 0;
  useEffect(() => {
    const el = dialog.current!, previous = document.activeElement;
    el.showModal(); heading.current?.focus({ preventScroll: true });
    return () => { el.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  function choose(date: string) {
    if (!start || end) { setStart(date); setEnd(""); }
    else { setStart(date < start ? date : start); setEnd(date < start ? start : date); }
  }
  async function save() {
    if (!start || busy) return;
    setBusy(true); setError("");
    try {
      await onSave({ id: closure?.id ?? `c-${crypto.randomUUID()}`, kind, start, end: last, label: label.trim() || CLOSURE_LABELS[kind] });
      onClose();
    } catch { setError("Couldn't save these dates. Please try again."); setBusy(false); }
  }
  return createPortal(<dialog ref={dialog} className="care-dialog holiday-dialog" aria-labelledby="holiday-title"
    onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <form className="form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <h2 ref={heading} id="holiday-title" tabIndex={-1}>{closure ? "Edit holiday / closure" : "Add holiday / closure"}</h2>
      <div className="chips" role="group" aria-label="Closure type">
        {([['minderHoliday', 'My holiday'], ['bankHoliday', 'Bank holiday']] as const).map(([value, text]) =>
          <button key={value} type="button" className={`chip${kind === value ? " on" : ""}`} aria-pressed={kind === value} onClick={() => setKind(value)}>{text}</button>)}
      </div>
      <div className="range-calendar">
        <div className="range-month-nav">
          <button type="button" className="nav-btn" aria-label="Previous calendar month" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <label><span>{monthLabel(month)}</span><input aria-label="Calendar month" type="month" value={month.slice(0, 7)}
            onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(`${e.target.value}-01`); }} /></label>
          <button type="button" className="nav-btn" aria-label="Next calendar month" onClick={() => setMonth(addMonths(month, 1))}>›</button>
        </div>
        <p className="hint" aria-live="polite">{!start || end ? "Tap the first day, then the last day." : "Now tap the last day, or save for just this day."}</p>
        <div className="range-grid">
          {WEEKDAY_LABELS.map(d => <span className="range-weekday" key={d}>{d[0]}</span>)}
          {Array.from({ length: weekdayIndex(days[0]) }, (_, i) => <span key={`blank-${i}`} />)}
          {days.map(date => {
            const selected = !!start && date >= start && date <= last;
            return <button key={date} type="button" aria-label={`${fmtDateLong(date)} ${date.slice(0, 4)}`}
              aria-pressed={selected} aria-current={date === todayISO() ? "date" : undefined}
              className={`range-day${selected ? " in-range" : ""}${date === start || date === last ? " endpoint" : ""}`}
              onClick={() => choose(date)}>{Number(date.slice(-2))}</button>;
          })}
        </div>
      </div>
      <div className="range-summary" role="status">
        {start ? <><strong>{fmtDateLong(start)}{last !== start && ` – ${fmtDateLong(last)}`}</strong><span>{dayCount} day{dayCount === 1 ? "" : "s"} · including first and last day</span></> : "No dates selected"}
      </div>
      <label className="field"><span>Label (optional)</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Summer holiday" /></label>
      <p className="hint">Applies to all children using their holiday charging policy.</p>
      {error && <p role="alert" className="hint warn">{error}</p>}
      <div className="care-dialog-actions"><button type="button" className="btn-quiet" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!start || busy}>{busy ? "Saving…" : "Save dates"}</button></div>
    </form>
  </dialog>, document.body);
}
