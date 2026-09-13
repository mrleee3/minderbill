import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type DayLog } from "../db";
import { addDays, fmtDateLong, fmtHours, minToInput, todayISO,
} from "../lib/dates";
import { resolveDay } from "../lib/schedule";
import { childColour, getClosures } from "../lib/settings";
import { CLOSURE_COLOURS, CLOSURE_LABELS, closureOn, type Closure } from "../data/closures";
import { confirmDay, unconfirmDay } from "../lib/confirm";
import { WorkspaceDetail, useWorkspaceNavigation } from "../components/Workspace";
import { useDesktop } from "../lib/useDesktop";
import { DateCalendar } from "../components/DateCalendar";
import { ABSENCE_LABELS, DayEditor } from "../components/DayEditor";

export function Today({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const desktop = useDesktop();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const footer = useRef<HTMLDivElement>(null);
  const [barSize, setBarSize] = useState({ nav: 100, footer: 72 });
  useEffect(() => {
    if (desktop) return;
    const nav = document.querySelector<HTMLElement>(".tabbar");
    const measure = () => setBarSize({ nav: nav?.offsetHeight || 100, footer: footer.current?.offsetHeight || 72 });
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    if (footer.current) observer.observe(footer.current);
    measure();
    return () => observer.disconnect();
  }, [desktop]);
  const canLeave = useWorkspaceNavigation();
  const choose = (child: ChildContract | null) => { if (child?.id !== editing?.id && canLeave()) setEditing(child); };
  const changeDate = (next: string) => { if (next && next !== date && canLeave()) setDate(next); };
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

  const doConfirm = async () => {
    await confirmDay(date);
  };

  const logFor = (c: ChildContract): DayLog | undefined =>
    logs.find((l) => l.childId === c.id);

  const rows = children
    .map((c, i) => ({ child: c, colour: childColour(c, i), log: logFor(c), resolved: resolveDay(c, date, logFor(c), closures) }))
    .sort((a, b) => (a.resolved?.startMin ?? 9999) - (b.resolved?.startMin ?? 9999));

  const attending = rows.filter((r) => r.resolved);
  const present = attending.filter(r => !r.resolved!.absence);
  const absent = attending.filter(r => r.resolved!.absence);
  const notToday = rows.filter((r) => !r.resolved);
  const totalMin = attending.reduce(
    (s, r) => s + (r.resolved!.absence ? 0 : r.resolved!.minutes),
    0
  );
  const isToday = date === todayISO();

  return (
    <div className="workspace today-workspace" style={{ "--today-nav-height": `${barSize.nav}px`, "--today-footer-height": `${barSize.footer}px` } as CSSProperties}>
      <section className="workspace-list" aria-label="Daily attendance">
      <div className="date-nav">
        <button className="nav-btn" onClick={() => changeDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <div className="date-label">
          <button className="today-date-picker" aria-label="Choose attendance date" aria-haspopup="dialog" onClick={() => setCalendarOpen(true)}><strong>{isToday ? "Today" : fmtDateLong(date)}</strong><span aria-hidden="true"> ▾</span></button>
          {isToday && <span className="hint"> {fmtDateLong(date)}</span>}
          {!isToday && (
            <button className="link" onClick={() => changeDate(todayISO())}>Back to today</button>
          )}
        </div>
        <button className="nav-btn" onClick={() => changeDate(addDays(date, 1))} aria-label="Next day">›</button>
      </div>

      <label className="desktop-date">Jump to date<input aria-label="Attendance date" type="date" value={date} onChange={e => changeDate(e.target.value)} /></label>
      {closure && (
        <div className="closure-note" style={{ borderColor: CLOSURE_COLOURS[closure.kind] }}>
          <strong>{closure.label}</strong>
          <span className="hint">
            Scheduled children default to "{CLOSURE_LABELS[closure.kind]}". Tap a child to make an exception.
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

      {attending.length > 0 && <p className="today-guidance">Tap a child to record care, add a note or change hours.</p>}
      {([{ title: "Attending", items: present }, { title: "Absent", items: absent }]).map(group => group.items.length > 0 && (
        <section key={group.title} className="today-group" aria-label={group.title}>
          <h3>{group.title}<span>{group.items.length}</span></h3>
          {group.items.map(({ child, colour, resolved }) => (
            <button key={child.id} className={`child-card today-child${editing?.id === child.id ? " selected" : ""}`}
              aria-pressed={editing?.id === child.id} onClick={() => choose(child)}
              style={{ "--child-colour": colour } as CSSProperties}>
              <span className="avatar" style={{ background: colour }}><span className="avatar-letter">{child.name[0]?.toUpperCase()}</span></span>
              <span className="card-main">
                <span className="card-name">{child.name}</span>
                {resolved!.absence ? <span className="status absent">{ABSENCE_LABELS[resolved!.absence]}</span> :
                  <span className="card-time hours">{minToInput(resolved!.startMin)}–{minToInput(resolved!.endMin)}<span className="dot-sep">·</span>{fmtHours(resolved!.minutes)}</span>}
                {(!!resolved!.careEntries?.length || !!resolved!.note) && <span className="today-diary-summary">
                  {resolved!.careEntries?.length ? `${resolved!.careEntries!.length} diary ${resolved!.careEntries!.length === 1 ? "entry" : "entries"}` : ""}
                  {resolved!.note ? `${resolved!.careEntries?.length ? " · " : ""}Note added` : ""}
                </span>}
              </span>
              <span className="today-open" aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      ))}

      {notToday.length > 0 && <details key={date} className="today-extras" open={attending.length === 0}>
        <summary>Not scheduled <span>{notToday.length}</span></summary>
        <p className="hint">Tap a child to add an extra day.</p>
        {notToday.map(({ child, colour }) => <button key={child.id}
          className={`child-card today-child${editing?.id === child.id ? " selected" : ""}`} onClick={() => choose(child)}
          style={{ "--child-colour": colour } as CSSProperties}>
          <span className="avatar" style={{ background: colour }}><span className="avatar-letter">{child.name[0]?.toUpperCase()}</span></span>
          <span className="card-main"><span className="card-name">{child.name}</span><span className="card-time">Add attendance</span></span>
          <span className="today-open" aria-hidden="true">+</span>
        </button>)}
      </details>}

      <div ref={footer} className="today-footer" role="region" aria-label="Day summary and actions">
        <span className="today-footer-summary">
          <strong>{present.length} attending · {fmtHours(totalMin)}</strong>
          <span>{isConfirmed ? "✓ Day confirmed" : absent.length ? `${absent.length} absent` : "Hours & attendance"}</span>
        </span>
        {attending.length > 0 && (isConfirmed
          ? <button className="btn-quiet inline" onClick={() => unconfirmDay(date)}>Undo confirmation</button>
          : <button className="btn-primary inline" onClick={doConfirm}>Confirm day</button>)}
      </div>
      {calendarOpen && <DateCalendar date={date} onClose={() => setCalendarOpen(false)} onChoose={next => { changeDate(next); setCalendarOpen(false); }} />}
      </section>
      <WorkspaceDetail
        open={!!editing}
        title={editing ? `${editing.name} — ${fmtDateLong(date)}` : ""}
        onClose={() => choose(null)}
      >
        {editing && (
          <DayEditor key={`${editing.id}:${date}`}
            closures={closures}
            child={editing}
            date={date}
            resolved={resolveDay(editing, date, logFor(editing), closures)}
            log={logFor(editing)}
            onDone={() => { if (!desktop) setEditing(null); }}
          />
        )}
      </WorkspaceDetail>
    </div>
  );
}
