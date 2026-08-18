import type { AbsenceReason, ChildContract, DaySlot, DayLog } from "../db";
import { weekdayIndex } from "./dates";
import { closureOn, type Closure } from "../data/closures";

// Log-by-exception: a DayLog is stored ONLY when the day differs from the
// usual schedule (adjusted times, absence, or unplanned attendance). Days
// without a log are resolved from the child's weekly schedule.

export interface ResolvedDay {
  startMin: number;
  endMin: number;
  minutes: number;
  absence?: AbsenceReason;
  note?: string;
  /** "schedule" = virtual planned day; "log" = explicit stored exception. */
  source: "schedule" | "log";
  /** Set when the absence came from a declared closure rather than a log. */
  closureLabel?: string;
}

/** The schedule version in force on a date (latest fromDate <= iso). */
export function scheduleOn(child: ChildContract, iso: string): (DaySlot | null)[] {
  const sorted = [...child.schedules].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  let days = sorted[0]?.days ?? Array(7).fill(null);
  for (const v of sorted) if (v.fromDate <= iso) days = v.days;
  return days;
}

/** Is the contract active on this date (between start and end dates)? */
export function isActiveOn(child: ChildContract, iso: string): boolean {
  if (child.startDate && iso < child.startDate) return false;
  if (child.endDate && iso > child.endDate) return false;
  return true;
}

export function plannedSlot(child: ChildContract, iso: string): DaySlot | null {
  if (!isActiveOn(child, iso)) return null;
  return scheduleOn(child, iso)[weekdayIndex(iso)] ?? null;
}

export function resolveDay(
  child: ChildContract,
  iso: string,
  log: DayLog | undefined,
  closures: Closure[] = []
): ResolvedDay | null {
  // Outside the contract dates nothing is scheduled or chargeable, even if a
  // stale log exists.
  if (!isActiveOn(child, iso)) return null;
  if (log) {
    return {
      startMin: log.startMin,
      endMin: log.endMin,
      minutes: Math.max(0, log.endMin - log.startMin),
      absence: log.absence,
      note: log.note,
      source: "log",
    };
  }
  const slot = plannedSlot(child, iso);
  if (!slot) return null;
  // A declared closure turns a planned day into the matching absence, unless
  // an explicit log already said otherwise (handled above).
  const closure = closureOn(iso, closures);
  return {
    startMin: slot.startMin,
    endMin: slot.endMin,
    minutes: Math.max(0, slot.endMin - slot.startMin),
    absence: closure?.kind,
    source: "schedule",
    closureLabel: closure?.label,
  };
}

/** The rate version in force on a given date (latest fromDate ≤ iso). */
export function effectiveRatePence(child: ChildContract, iso: string): number {
  const sorted = [...child.rates].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  let rate = sorted[0]?.pencePerHour ?? 0;
  for (const r of sorted) {
    if (r.fromDate <= iso) rate = r.pencePerHour;
  }
  return rate;
}

export function scheduleSummary(child: ChildContract, onISO: string): string {
  const sched = scheduleOn(child, onISO);
  const days = sched.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  if (days.length === 0) return "No usual days";
  const weekMinutes = sched.reduce((sum, s) => sum + (s ? s.endMin - s.startMin : 0), 0);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayText =
    days.length > 2 && days.every((d, i) => i === 0 || d === days[i - 1] + 1)
      ? `${labels[days[0]]}–${labels[days[days.length - 1]]}`
      : days.map((d) => labels[d]).join(" ");
  const h = weekMinutes / 60;
  return `${dayText} · ${Number.isInteger(h) ? h : h.toFixed(1)} h/wk`;
}
