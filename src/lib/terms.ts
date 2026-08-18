import type { TermBlock } from "../data/surrey";
import { addDays, parseISO, toISO, weekdayIndex } from "./dates";

/** Monday of the week containing iso. */
export function weekMonday(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

/**
 * A week counts as LA-funded when at least 3 of its weekdays (Mon–Fri) fall
 * inside a term block. This matches LA week-counting for terms that start or
 * end midweek. Fully editable term blocks are the accuracy escape hatch.
 */
export function isFundedWeek(mondayISO: string, blocks: TermBlock[]): boolean {
  let inTerm = 0;
  for (let i = 0; i < 5; i++) {
    const d = addDays(mondayISO, i);
    if (blocks.some((b) => b.start <= d && d <= b.end)) inTerm++;
  }
  return inTerm >= 3;
}

/** Count funded weeks over an inclusive ISO date range. */
export function fundedWeeksBetween(startISO: string, endISO: string, blocks: TermBlock[]): number {
  let n = 0;
  for (let m = weekMonday(startISO); m <= endISO; m = addDays(m, 7)) {
    if (isFundedWeek(m, blocks)) n++;
  }
  return n;
}

/** Academic-year range (1 Sep – 31 Aug) containing iso. */
export function academicYearOf(iso: string): { start: string; end: string; label: string } {
  const { y, m } = parseISO(iso);
  const startYear = m >= 9 ? y : y - 1;
  return {
    start: toISO(startYear, 9, 1),
    end: toISO(startYear + 1, 8, 31),
    label: `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}
