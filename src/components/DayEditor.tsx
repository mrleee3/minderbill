import { useState } from "react";
import { db, type AbsenceReason, type ChildContract, type DayLog } from "../db";
import { inputToMin, minToInput } from "../lib/dates";
import { plannedSlot, type ResolvedDay } from "../lib/schedule";

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
}: {
  child: ChildContract;
  date: string;
  resolved: ResolvedDay | null;
  log: DayLog | undefined;
  onDone: () => void;
}) {
  const planned = plannedSlot(child, date);
  const init = resolved ?? { startMin: planned?.startMin ?? 480, endMin: planned?.endMin ?? 1050 };
  const [start, setStart] = useState(init.startMin);
  const [end, setEnd] = useState(init.endMin);
  const [absence, setAbsence] = useState<AbsenceReason | undefined>(resolved?.absence);
  const [note, setNote] = useState(resolved?.note ?? "");

  const valid = end > start;

  async function save() {
    const entry: DayLog = {
      ...(log ?? {}),
      childId: child.id!,
      date,
      startMin: start,
      endMin: end,
      absence,
      note: note.trim() || undefined,
      confirmed: true,
    };
    // If everything matches the plan and there's no absence/note, storing a
    // log adds nothing — revert to the schedule instead (log by exception).
    const matchesPlan =
      planned && start === planned.startMin && end === planned.endMin && !absence && !note.trim();
    if (matchesPlan) {
      if (log?.id) await db.dayLogs.delete(log.id);
    } else {
      await db.dayLogs.put(entry);
    }
    onDone();
  }

  async function revert() {
    if (log?.id) await db.dayLogs.delete(log.id);
    onDone();
  }

  return (
    <div className="form">
      <div className="form-section">Hours</div>
      <div className="time-row">
        <input type="time" value={minToInput(start)} onChange={(e) => setStart(inputToMin(e.target.value))} />
        <span className="dash">–</span>
        <input type="time" value={minToInput(end)} onChange={(e) => setEnd(inputToMin(e.target.value))} />
      </div>
      {!valid && <p className="hint warn">End time must be after start time.</p>}
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
          {child.policies[absence as keyof ChildContract["policies"]] === "full"
            ? "full rate"
            : child.policies[absence as keyof ChildContract["policies"]] === "half"
              ? "half rate"
              : child.policies[absence as keyof ChildContract["policies"]] === "none"
                ? "no charge"
                : "no charge"}{" "}
          on the planned hours.
        </p>
      )}

      <label className="field">
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. picked up by grandad" />
      </label>

      <button className="btn-primary" onClick={save} disabled={!valid}>
        Save
      </button>
      {log && (
        <button className="btn-quiet" onClick={revert}>
          Revert to planned
        </button>
      )}
    </div>
  );
}
