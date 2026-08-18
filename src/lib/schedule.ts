import type { AbsenceReason, ChildContract, DayLog } from "../db";
import { weekdayIndex } from "./dates";

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
}

export function plannedSlot(
  child: ChildContract,
  iso: string
): { startMin: number; endMin: number } | null {
  return child.schedule[weekdayIndex(iso)] ?? null;
}

export function resolveDay(
  child: ChildContract,
  iso: string,
  log: DayLog | undefined
): ResolvedDay | null {
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
  return {
    startMin: slot.startMin,
    endMin: slot.endMin,
    minutes: Math.max(0, slot.endMin - slot.startMin),
    source: "schedule",
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

export function scheduleSummary(child: ChildContract): string {
  const days = child.schedule
    .map((s, i) => (s ? i : -1))
    .filter((i) => i >= 0);
  if (days.length === 0) return "No usual days";
  const weekMinutes = child.schedule.reduce(
    (sum, s) => sum + (s ? s.endMin - s.startMin : 0),
    0
  );
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayText =
    days.length > 2 && days.every((d, i) => i === 0 || d === days[i - 1] + 1)
      ? `${labels[days[0]]}–${labels[days[days.length - 1]]}`
      : days.map((d) => labels[d]).join(" ");
  const h = weekMinutes / 60;
  return `${dayText} · ${Number.isInteger(h) ? h : h.toFixed(1)} h/wk`;
}
