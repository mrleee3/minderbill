import { useState } from "react";
import { db, type AbsenceReason, type CareEntry, type ChildContract, type DayLog } from "../db";
import { inputToMin, minToInput } from "../lib/dates";
import { plannedSlot, needsDayLog, type ResolvedDay } from "../lib/schedule";

import type { Closure } from "../data/closures";
import { CareNotes } from "./CareNotes";
import { resolveDay } from "../lib/schedule";
import { policyFor } from "../engine/monthInvoice";

export const ABSENCE_LABELS: Record<AbsenceReason, string> = {
  childSick: "Child sick",
  familyHoliday: "Family holiday",
  minderHoliday: "My holiday",
  minderSick: "I'm sick",
  bankHoliday: "Bank holiday",
  closed: "Closed",
  other: "Other",
};

export function DayEditor({
  child,
  date,
  resolved,
  log,
  onDone,
  closures,
}: {
  child: ChildContract;
  date: string;
  resolved: ResolvedDay | null;
  log: DayLog | undefined;
  onDone: () => void;
  closures: Closure[];
}) {
  const planned = plannedSlot(child, date);
  const init = resolved ?? { startMin: planned?.startMin ?? 480, endMin: planned?.endMin ?? 1050 };
  const [start, setStart] = useState(init.startMin);
  const [end, setEnd] = useState(init.endMin);
  const [absence, setAbsence] = useState<AbsenceReason | undefined>(resolved?.absence);
  const [note, setNote] = useState(resolved?.note ?? "");

  const [careEntries, setCareEntries] = useState<CareEntry[]>(log?.careEntries ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = end > start && careEntries.every(entry => /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time));

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const entry: DayLog = {
        ...(log ?? {}),
        childId: child.id!,
        date,
        startMin: start,
        endMin: end,
        absence,
        note: note.trim() || undefined,
        careEntries: careEntries.length ? careEntries : undefined,
        confirmed: true,
      };
      // Compare with the effective plan, including closures. Attendance on a
      // closure day must remain an explicit exception even at the usual hours.
      if (!needsDayLog(child, entry, closures)) {
        if (log?.id) await db.dayLogs.delete(log.id);
      } else {
        await db.dayLogs.put(entry);
      }
      onDone();
    } catch {
      setError("Could not save. Please try again; your entries are still here.");
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    // Reset attendance only: care entries and free-text notes stay in the form.
    const baseline = resolveDay(child, date, undefined, closures);
    setStart(baseline?.startMin ?? 480);
    setEnd(baseline?.endMin ?? 1050);
    setAbsence(baseline?.absence);
  }

  return (
    <div className="form day-editor">
      <div className="form-section">Hours</div>
      <div className="time-row">
        <input type="time" value={minToInput(start)} onChange={(e) => setStart(inputToMin(e.target.value))} />
        <span className="dash">–</span>
        <input type="time" value={minToInput(end)} onChange={(e) => setEnd(inputToMin(e.target.value))} />
      </div>
      {!(end > start) && <p className="hint warn">End time must be after start time.</p>}
      {planned && (
        <p className="hint">
          Planned: {minToInput(planned.startMin)}–{minToInput(planned.endMin)}
        </p>
      )}

      <div className="form-section">Absence</div>
      <div className="chip-row">
        <button className={`chip${!absence ? " on" : ""}`} onClick={() => setAbsence(undefined)}>
          Attended
        </button>
        {(Object.keys(ABSENCE_LABELS) as AbsenceReason[]).map((r) => (
          <button
            key={r}
            className={`chip clay${absence === r ? " on" : ""}`}
            onClick={() => setAbsence(r)}
          >
            {ABSENCE_LABELS[r]}
          </button>
        ))}
      </div>
      {absence && (
        <p className="hint">
          Charged per this child's "{ABSENCE_LABELS[absence]}" policy —{" "}
          {policyFor(child, absence) === "full"
            ? "full rate"
            : policyFor(child, absence) === "half"
              ? "half rate"
              : "no charge"}{" "}
          on the hours shown above.
        </p>
      )}

      <CareNotes entries={careEntries} onChange={setCareEntries} />
      <label className="field">
        <span>Note (optional)</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. picked up by grandad" />
      </label>

      {careEntries.some(entry => !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) && <p className="hint warn">Enter a time for each care entry.</p>}
      {error && <p className="hint warn" role="alert">{error}</p>}
      <button className="btn-primary" onClick={save} disabled={!valid || saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {log && (
        <button className="btn-quiet" onClick={revert} disabled={saving}>
          Reset hours / absence to planned
        </button>
      )}
    </div>
  );
}
