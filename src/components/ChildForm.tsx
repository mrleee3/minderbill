import { useMemo, useState } from "react";
import { db, type ChildContract } from "../db";
import { WEEKDAY_LABELS, inputToMin, minToInput, todayISO } from "../lib/dates";
import { effectiveRatePence } from "../lib/schedule";
import { formatPence } from "../engine/invoice";

const DEFAULT_SLOT = { startMin: 480, endMin: 1050 }; // 8:00–17:30

const POLICY_FIELDS: { key: keyof ChildContract["policies"]; label: string }[] = [
  { key: "childSick", label: "Child sick" },
  { key: "familyHoliday", label: "Family holiday" },
  { key: "minderHoliday", label: "My holiday" },
  { key: "minderSick", label: "I'm sick" },
  { key: "bankHoliday", label: "Bank holiday" },
];

function poundsToPence(v: string): number {
  const n = parseFloat(v.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function penceToPounds(p: number): string {
  return (p / 100).toFixed(2);
}

export function ChildForm({
  existing,
  onDone,
}: {
  existing: ChildContract | null;
  onDone: () => void;
}) {
  const today = todayISO();
  const currentRate = existing ? effectiveRatePence(existing, today) : 800;

  const [name, setName] = useState(existing?.name ?? "");
  const [dob, setDob] = useState(existing?.dob ?? "");
  const [rateStr, setRateStr] = useState(penceToPounds(currentRate));
  const [rateFrom, setRateFrom] = useState(today);
  const [schedule, setSchedule] = useState<ChildContract["schedule"]>(
    existing?.schedule ?? [DEFAULT_SLOT, DEFAULT_SLOT, DEFAULT_SLOT, DEFAULT_SLOT, DEFAULT_SLOT, null, null]
  );
  const [funded, setFunded] = useState(!!existing?.funding);
  const [fundedHours, setFundedHours] = useState(
    existing?.funding ? String(existing.funding.fundedMinutesPerWeek / 60) : "15"
  );
  const [laRateStr, setLaRateStr] = useState(
    existing?.funding?.laRatePencePerHour != null
      ? penceToPounds(existing.funding.laRatePencePerHour)
      : ""
  );
  const [minEffStr, setMinEffStr] = useState(
    existing?.funding?.minEffectivePencePerHour != null
      ? penceToPounds(existing.funding.minEffectivePencePerHour)
      : "8.00"
  );
  const [topUpLabel, setTopUpLabel] = useState(
    existing?.funding?.topUpLabel ?? "Additional services charge"
  );
  const [policies, setPolicies] = useState<ChildContract["policies"]>(
    existing?.policies ?? {
      childSick: "full",
      familyHoliday: "full",
      minderHoliday: "none",
      minderSick: "none",
      bankHoliday: "none",
    }
  );
  const [payerName, setPayerName] = useState(existing?.payer?.name ?? "");
  const [tfcRef, setTfcRef] = useState(existing?.payer?.tfcReference ?? "");

  const topUpPreview = useMemo(() => {
    const la = poundsToPence(laRateStr);
    const min = poundsToPence(minEffStr);
    if (!funded || la <= 0 || min <= 0) return null;
    return Math.max(0, min - la);
  }, [funded, laRateStr, minEffStr]);

  const setDay = (i: number, slot: { startMin: number; endMin: number } | null) =>
    setSchedule((s) => s.map((x, j) => (j === i ? slot : x)));

  async function save() {
    const ratePence = poundsToPence(rateStr);
    if (!name.trim() || ratePence <= 0) return;

    let rates = existing?.rates ?? [];
    if (!existing) {
      rates = [{ fromDate: rateFrom, pencePerHour: ratePence }];
    } else if (ratePence !== currentRate) {
      rates = [...rates, { fromDate: rateFrom, pencePerHour: ratePence }];
    }

    const contract: ChildContract = {
      ...(existing ?? {}),
      name: name.trim(),
      dob: dob || undefined,
      startDate: existing?.startDate ?? today,
      rates,
      schedule,
      funding: funded
        ? {
            fundedMinutesPerWeek: Math.round(parseFloat(fundedHours || "0") * 60),
            model: "term-time",
            laRatePencePerHour: poundsToPence(laRateStr) || undefined,
            minEffectivePencePerHour: poundsToPence(minEffStr) || undefined,
            topUpLabel: topUpLabel.trim() || "Additional services charge",
          }
        : null,
      policies,
      payer: {
        name: payerName.trim() || undefined,
        method: tfcRef ? ["bank", "tfc"] : ["bank"],
        tfcReference: tfcRef.trim() || undefined,
      },
    };
    await db.children.put(contract);
    onDone();
  }

  async function remove() {
    if (!existing?.id) return;
    if (!confirm(`Remove ${existing.name} and all their logs? This can't be undone.`)) return;
    await db.dayLogs.where("childId").equals(existing.id).delete();
    await db.children.delete(existing.id);
    onDone();
  }

  return (
    <div className="form">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Child's name" autoFocus={!existing} />
      </label>
      <label className="field">
        <span>Date of birth (optional)</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </label>

      <div className="form-section">Hourly rate</div>
      <div className="field-row">
        <label className="field">
          <span>Rate (£/hour)</span>
          <input inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
        </label>
        <label className="field">
          <span>Effective from</span>
          <input type="date" value={rateFrom} onChange={(e) => setRateFrom(e.target.value)} />
        </label>
      </div>
      {existing && poundsToPence(rateStr) !== currentRate && (
        <p className="hint">
          Rate change — {formatPence(currentRate)}/hr stays on invoices before {rateFrom}; the new
          rate applies from then on.
        </p>
      )}

      <div className="form-section">Usual week</div>
      {WEEKDAY_LABELS.map((label, i) => {
        const slot = schedule[i];
        return (
          <div key={label} className="day-row">
            <button
              className={`day-toggle${slot ? " on" : ""}`}
              onClick={() => setDay(i, slot ? null : { ...DEFAULT_SLOT })}
            >
              {label}
            </button>
            {slot ? (
              <>
                <input
                  type="time"
                  value={minToInput(slot.startMin)}
                  onChange={(e) => setDay(i, { ...slot, startMin: inputToMin(e.target.value) })}
                />
                <span className="dash">–</span>
                <input
                  type="time"
                  value={minToInput(slot.endMin)}
                  onChange={(e) => setDay(i, { ...slot, endMin: inputToMin(e.target.value) })}
                />
              </>
            ) : (
              <span className="hint">Not attending</span>
            )}
          </div>
        );
      })}

      <div className="form-section">Government funding</div>
      <label className="check-row">
        <input type="checkbox" checked={funded} onChange={(e) => setFunded(e.target.checked)} />
        <span>Gets funded hours (term-time)</span>
      </label>
      {funded && (
        <>
          <div className="field-row">
            <label className="field">
              <span>Funded hrs/week with me</span>
              <input inputMode="decimal" value={fundedHours} onChange={(e) => setFundedHours(e.target.value)} />
            </label>
            <label className="field">
              <span>LA rate (£/hr)</span>
              <input inputMode="decimal" value={laRateStr} onChange={(e) => setLaRateStr(e.target.value)} placeholder="e.g. 6.12" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Minimum effective (£/hr)</span>
              <input inputMode="decimal" value={minEffStr} onChange={(e) => setMinEffStr(e.target.value)} />
            </label>
            <label className="field">
              <span>Top-up line label</span>
              <input value={topUpLabel} onChange={(e) => setTopUpLabel(e.target.value)} />
            </label>
          </div>
          <p className="hint">
            {topUpPreview == null
              ? "Enter the LA rate you receive to calculate the parent top-up per funded hour."
              : topUpPreview === 0
                ? "LA rate covers the minimum — no parent top-up on funded hours."
                : `Parent top-up: ${formatPence(topUpPreview)} per funded hour.`}
          </p>
        </>
      )}

      <div className="form-section">If a day is missed, charge…</div>
      {POLICY_FIELDS.map(({ key, label }) => (
        <div key={key} className="policy-row">
          <span>{label}</span>
          <div className="seg">
            {(["full", "half", "none"] as const).map((v) => (
              <button
                key={v}
                className={policies[key] === v ? "on" : ""}
                onClick={() => setPolicies((p) => ({ ...p, [key]: v }))}
              >
                {v === "full" ? "Full" : v === "half" ? "Half" : "No charge"}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="form-section">Parent / payer</div>
      <div className="field-row">
        <label className="field">
          <span>Parent name</span>
          <input value={payerName} onChange={(e) => setPayerName(e.target.value)} />
        </label>
        <label className="field">
          <span>TFC reference (optional)</span>
          <input value={tfcRef} onChange={(e) => setTfcRef(e.target.value)} placeholder="From NS&I payments" />
        </label>
      </div>

      <button className="btn-primary" onClick={save} disabled={!name.trim() || poundsToPence(rateStr) <= 0}>
        {existing ? "Save changes" : "Add child"}
      </button>
      {existing && (
        <button className="btn-danger" onClick={remove}>
          Remove child
        </button>
      )}
    </div>
  );
}
