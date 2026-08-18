// MinderBill invoice engine.
//
// Philosophy (Haematinics Trace pattern): a pure deterministic function over
// versioned config. Same inputs → same invoice, every line traceable. No I/O,
// no dates-from-the-clock, no floats for money.
//
// Units: money = integer pence. Time = integer minutes.
//
// Absence policies are applied UPSTREAM of allocation: a day's chargeable
// minutes are (logged minutes × policy multiplier), so e.g. "child sick at
// full rate" contributes its planned minutes here exactly as if attended,
// and "childminder holiday, not charged" contributes zero.

export type LineKind = "funded" | "topup" | "private";

export interface InvoiceLine {
  kind: LineKind;
  minutes: number;
  ratePencePerHour: number;
  amountPence: number;
}

export interface WeekAllocationInput {
  /** Chargeable minutes this week (absence policies already applied). */
  weekMinutes: number;
  /** Is this an LA-funded term week for this child? */
  fundedWeek: boolean;
  /** Funded minutes per week with THIS setting (0 if no funding). */
  fundedCapMinutes: number;
  /** Private hourly rate in pence (rate version effective for this week). */
  privateRatePencePerHour: number;
  /** Parent top-up per funded hour in pence: max(0, minEffective − laRate). */
  topUpPencePerFundedHour: number;
}

/** Round half-up money for (minutes × pence/hour). */
export function amountPence(minutes: number, ratePencePerHour: number): number {
  return Math.round((minutes * ratePencePerHour) / 60);
}

/**
 * Allocate one week's chargeable minutes into funded / top-up / private lines.
 * Funded minutes apply only in funded weeks, capped at the child's weekly
 * funded allocation with this setting. The remainder is private-rate.
 */
export function allocateWeek(input: WeekAllocationInput): InvoiceLine[] {
  const {
    weekMinutes,
    fundedWeek,
    fundedCapMinutes,
    privateRatePencePerHour,
    topUpPencePerFundedHour,
  } = input;

  if (
    weekMinutes < 0 ||
    fundedCapMinutes < 0 ||
    privateRatePencePerHour < 0 ||
    topUpPencePerFundedHour < 0
  ) {
    throw new Error("allocateWeek: negative input");
  }

  const fundedMinutes = fundedWeek ? Math.min(weekMinutes, fundedCapMinutes) : 0;
  const privateMinutes = weekMinutes - fundedMinutes;

  const lines: InvoiceLine[] = [];
  if (fundedMinutes > 0) {
    lines.push({ kind: "funded", minutes: fundedMinutes, ratePencePerHour: 0, amountPence: 0 });
    if (topUpPencePerFundedHour > 0) {
      lines.push({
        kind: "topup",
        minutes: fundedMinutes,
        ratePencePerHour: topUpPencePerFundedHour,
        amountPence: amountPence(fundedMinutes, topUpPencePerFundedHour),
      });
    }
  }
  if (privateMinutes > 0) {
    lines.push({
      kind: "private",
      minutes: privateMinutes,
      ratePencePerHour: privateRatePencePerHour,
      amountPence: amountPence(privateMinutes, privateRatePencePerHour),
    });
  }
  return lines;
}

export function totalPence(lines: InvoiceLine[]): number {
  return lines.reduce((sum, l) => sum + l.amountPence, 0);
}

export function formatPence(p: number): string {
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(p);
  return `${sign}£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
