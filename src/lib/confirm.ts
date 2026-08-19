import { db, type ChildContract, type DayConfirm, type DayLog } from "../db";
import type { Closure } from "../data/closures";
import { addDays, todayISO } from "./dates";
import { resolveDay } from "./schedule";

/** Does this date have anyone to account for? */
export function hasAttendance(
  children: ChildContract[],
  iso: string,
  logs: DayLog[],
  closures: Closure[]
): boolean {
  return children.some((c) =>
    resolveDay(
      c,
      iso,
      logs.find((l) => l.childId === c.id && l.date === iso),
      closures
    )
  );
}

export async function confirmDay(date: string): Promise<void> {
  await db.confirms.put({ date, at: new Date().toISOString() });
}

export async function unconfirmDay(date: string): Promise<void> {
  await db.confirms.delete(date);
}

/**
 * Past days that had children but were never confirmed, newest first.
 * Today itself is never chased — the day isn't over yet.
 */
export async function findUnconfirmed(lookbackDays = 45): Promise<string[]> {
  const today = todayISO();
  const from = addDays(today, -lookbackDays);
  const [children, logs, confirms] = await Promise.all([
    db.children.toArray(),
    db.dayLogs.where("date").between(from, today, true, false).toArray(),
    db.confirms.where("date").between(from, today, true, false).toArray(),
  ]);
  const done = new Set(confirms.map((c: DayConfirm) => c.date));
  const settings = await db.settings.get("closures");
  const closures = (settings?.value as Closure[]) ?? [];

  const out: string[] = [];
  for (let d = addDays(today, -1); d >= from; d = addDays(d, -1)) {
    if (done.has(d)) continue;
    if (hasAttendance(children, d, logs, closures)) out.push(d);
  }
  return out;
}

/** How many days in a period still need confirming (for invoice warnings). */
export async function unconfirmedInPeriod(period: string): Promise<number> {
  const first = `${period}-01`;
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${period}-${String(lastDay).padStart(2, "0")}`;
  const today = todayISO();
  const end = last < today ? last : addDays(today, -1);
  if (end < first) return 0;

  const [children, logs, confirms] = await Promise.all([
    db.children.toArray(),
    db.dayLogs.where("date").between(first, end, true, true).toArray(),
    db.confirms.where("date").between(first, end, true, true).toArray(),
  ]);
  const done = new Set(confirms.map((c: DayConfirm) => c.date));
  const settings = await db.settings.get("closures");
  const closures = (settings?.value as Closure[]) ?? [];

  let n = 0;
  for (let d = first; d <= end; d = addDays(d, 1)) {
    if (!done.has(d) && hasAttendance(children, d, logs, closures)) n++;
  }
  return n;
}
