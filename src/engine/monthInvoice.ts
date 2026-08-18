// Builds one child's calendar-month invoice (billed in arrears).
//
// Deterministic: f(contract, logs, term blocks) → itemised lines + a full
// week-by-week trace showing the working. Funded minutes are allocated
// chronologically within each Mon–Sun week (consuming the weekly funded cap
// day by day), so weeks that straddle a month boundary allocate identically
// on both months' invoices with no double counting.

import type { AbsenceReason, ChildContract, DayLog } from "../db";
import type { TermBlock } from "../data/surrey";
import type { Closure } from "../data/closures";
import { addDays } from "../lib/dates";
import { resolveDay } from "../lib/schedule";
import { effectiveRatePence } from "../lib/schedule";
import { weekMonday } from "../lib/terms";
import { amountPence } from "./invoice";

export type PolicyLevel = "full" | "half" | "none";

export interface DetailedLine {
  kind: "funded" | "topup" | "private";
  label: string;
  minutes: number;
  ratePencePerHour: number;
  amountPence: number;
}

export interface TraceDay {
  date: string;
  inMonth: boolean;
  minutes: number; // resolved attended/planned minutes
  absence?: AbsenceReason;
  policy?: PolicyLevel;
  chargeMinutes: number;
  fundedMin: number;
  privateMin: number;
}

export interface TraceWeek {
  monday: string;
  funded: boolean;
  days: TraceDay[];
}

export interface FundingSummary {
  /** Does this child have funding configured at all? */
  hasFunding: boolean;
  fundedCapMinutes: number;
  /** Minutes in this month that fell on term-time (funded-eligible) days. */
  termMinutes: number;
  holidayMinutes: number;
  fundedMinutes: number;
  privateMinutes: number;
  /** Term days present in the month per the term calendar. */
  termDaysInMonth: number;
  /** Funded hours claimable but unused (attended fewer hours than the cap). */
  unusedFundedMinutes: number;
  topUpPencePerHour: number;
}

export interface MonthInvoiceResult {
  period: string;
  lines: DetailedLine[];
  totalPence: number;
  trace: TraceWeek[];
  summary: FundingSummary;
}

/** Which charging policy applies to an absence reason. */
export function policyFor(child: ChildContract, reason: AbsenceReason): PolicyLevel {
  switch (reason) {
    case "childSick":
      return child.policies.childSick;
    case "familyHoliday":
      return child.policies.familyHoliday;
    case "minderHoliday":
      return child.policies.minderHoliday;
    case "minderSick":
      return child.policies.minderSick;
    case "bankHoliday":
      return child.policies.bankHoliday;
    case "closed":
      return child.policies.minderHoliday; // setting closed ≈ minder unavailable
    case "other":
      return "full";
  }
}

const MULT: Record<PolicyLevel, number> = { full: 1, half: 0.5, none: 0 };

export function buildMonthInvoice(
  child: ChildContract,
  period: string, // "2026-09"
  logs: DayLog[],
  termBlocks: TermBlock[],
  closures: Closure[] = []
): MonthInvoiceResult {
  const first = `${period}-01`;
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${period}-${String(lastDay).padStart(2, "0")}`;

  const logByDate = new Map<string, DayLog>();
  for (const l of logs) if (l.childId === child.id) logByDate.set(l.date, l);

  const fundedCap = child.funding?.fundedMinutesPerWeek ?? 0;
  const la = child.funding?.laRatePencePerHour ?? 0;
  const minEff = child.funding?.minEffectivePencePerHour ?? 0;
  const topUp = la > 0 && minEff > 0 ? Math.max(0, minEff - la) : 0;

  const trace: TraceWeek[] = [];
  let fundedTotalMin = 0;
  let termMinutes = 0;
  let holidayMinutes = 0;
  let unusedFundedMinutes = 0;
  const termDays = new Set<string>();
  const privateByRate = new Map<number, number>(); // rate pence/hr → minutes

  for (let monday = weekMonday(first); monday <= last; monday = addDays(monday, 7)) {
    let capLeft = fundedCap;
    const days: TraceDay[] = [];
    let weekHasFundedDay = false;

    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      const r = resolveDay(child, date, logByDate.get(date), closures);
      if (!r) continue;
      const policy = r.absence ? policyFor(child, r.absence) : undefined;
      const chargeMinutes = Math.round(r.minutes * (policy ? MULT[policy] : 1));
      // Funded minutes accrue only on days inside a term block, consuming
      // the weekly cap chronologically.
      const inTerm =
        fundedCap > 0 && termBlocks.some((b) => b.start <= date && date <= b.end);
      const fundedMin = inTerm ? Math.min(chargeMinutes, capLeft) : 0;
      capLeft -= fundedMin;
      if (fundedMin > 0) weekHasFundedDay = true;
      const privateMin = chargeMinutes - fundedMin;
      const inMonth = date >= first && date <= last;

      if (inMonth) {
        fundedTotalMin += fundedMin;
        if (inTerm) {
          termMinutes += chargeMinutes;
          termDays.add(date);
        } else {
          holidayMinutes += chargeMinutes;
        }
        if (privateMin > 0) {
          const rate = effectiveRatePence(child, date);
          privateByRate.set(rate, (privateByRate.get(rate) ?? 0) + privateMin);
        }
      }
      days.push({
        date,
        inMonth,
        minutes: r.minutes,
        absence: r.absence,
        policy,
        chargeMinutes,
        fundedMin,
        privateMin,
      });
    }
    if (days.length > 0) {
      const weekTouchesMonth = days.some((d) => d.inMonth);
      if (weekHasFundedDay && weekTouchesMonth && capLeft > 0) {
        unusedFundedMinutes += capLeft;
      }
      trace.push({ monday, funded: weekHasFundedDay, days });
    }
  }

  const lines: DetailedLine[] = [];
  if (fundedTotalMin > 0) {
    lines.push({
      kind: "funded",
      label: "Government funded hours",
      minutes: fundedTotalMin,
      ratePencePerHour: 0,
      amountPence: 0,
    });
    if (topUp > 0) {
      lines.push({
        kind: "topup",
        label: child.funding?.topUpLabel ?? "Additional services charge",
        minutes: fundedTotalMin,
        ratePencePerHour: topUp,
        amountPence: amountPence(fundedTotalMin, topUp),
      });
    }
  }
  for (const [rate, minutes] of [...privateByRate.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push({
      kind: "private",
      label: "Childcare hours",
      minutes,
      ratePencePerHour: rate,
      amountPence: amountPence(minutes, rate),
    });
  }

  const privateMinutes = [...privateByRate.values()].reduce((a, b) => a + b, 0);

  return {
    period,
    lines,
    totalPence: lines.reduce((s, l) => s + l.amountPence, 0),
    trace,
    summary: {
      hasFunding: fundedCap > 0,
      fundedCapMinutes: fundedCap,
      termMinutes,
      holidayMinutes,
      fundedMinutes: fundedTotalMin,
      privateMinutes,
      termDaysInMonth: termDays.size,
      unusedFundedMinutes,
      topUpPencePerHour: topUp,
    },
  };
}
