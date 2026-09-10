import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract } from "../db";
import { addDays, fmtDateLong, todayISO, weekdayIndex } from "../lib/dates";
import { diaryDays, careEntryText, diaryFileName } from "../lib/diary";
import { CareIcon } from "./CareIcon";
import { buildDiaryPdf } from "../lib/diaryPdf";

export function ChildDiary({ child }: { child: ChildContract }) {
  const today = todayISO();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const logs = useLiveQuery(() => db.dayLogs.where("childId").equals(child.id!).toArray(), [child.id]);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const days = valid ? diaryDays(logs ?? [], child.id!, from, to) : [];
  const period = (start: string) => { setFrom(start); setTo(today); setMessage(""); };
  async function exportPdf(share: boolean) {
    if (!valid || !days.length || busy) return;
    setBusy(true); setMessage("");
    try {
      const bytes = await buildDiaryPdf(child, from, to, days);
      const file = new File([bytes as BlobPart], diaryFileName(child.name, from, to), { type: "application/pdf" });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${child.name} - daily diary` });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url; link.download = file.name;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setMessage("PDF download started.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") setMessage("Could not export. Please try Save PDF again.");
    } finally { setBusy(false); }
  }
  return (
    <div className="form child-diary">
      <div className="chip-row">
        <button className="chip" onClick={() => period(today)}>Today</button>
        <button className="chip" onClick={() => period(addDays(today, -weekdayIndex(today)))}>This week</button>
        <button className="chip" onClick={() => period(`${today.slice(0, 7)}-01`)}>This month</button>
        <button className="chip" disabled={!logs?.length} onClick={() => { setFrom(logs!.map(l => l.date).sort()[0]); setTo(logs!.map(l => l.date).sort().at(-1)!); }}>All entries</button>
      </div>
      <div className="field-row">
        <label className="field"><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      </div>
      {!valid && <p className="hint warn">Choose a valid date range, with From on or before To.</p>}
      <div className="field-row">
        <button className="btn-primary" disabled={busy || !days.length} onClick={() => exportPdf(false)}>{busy ? "Preparing…" : "Save PDF"}</button>
        <button className="btn-quiet" disabled={busy || !days.length} onClick={() => exportPdf(true)}>Share PDF</button>
      </div>
      {message && <p className="hint" role="status">{message}</p>}
      {logs === undefined ? <p className="hint">Loading diary…</p> : valid && !days.length ? <p className="hint">No saved care entries or notes in this date range.</p> : null}
      {days.map(day => (
        <section className="diary-day" key={day.id ?? day.date}>
          <h3>{fmtDateLong(day.date)} {day.date.slice(0, 4)}</h3>
          {(day.careEntries ?? []).map(entry => <div className={`diary-entry care-${entry.kind}`} key={entry.id}><CareIcon kind={entry.kind} /><div className="diary-entry-content"><div className="care-entry-heading"><time>{entry.time}</time><strong>{entry.label}</strong></div>{careEntryText(entry) !== entry.label && <p>{careEntryText(entry).slice(entry.label.length + 3)}</p>}</div></div>)}
          {day.note?.trim() && <p className="diary-note"><strong>Notes</strong>{day.note}</p>}
        </section>
      ))}
    </div>
  );
}
