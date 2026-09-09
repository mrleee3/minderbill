import type { CareEntry, DayLog } from "../db";

export function diaryDays(logs: DayLog[], childId: number, from: string, to: string): DayLog[] {
  return logs.filter(log => log.childId === childId && log.date >= from && log.date <= to &&
    (log.note?.trim() || log.careEntries?.length))
    .map(log => ({ ...log, careEntries: [...(log.careEntries ?? [])].sort((a, b) => a.time.localeCompare(b.time)) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function careEntryText(entry: CareEntry): string {
  const parts = [entry.label];
  if (entry.eaten) parts.push(`Eaten: ${entry.eaten}`);
  if (entry.amountMl !== undefined) parts.push(`${entry.amountMl} ml`);
  if (entry.details?.trim()) parts.push(entry.details.trim());
  return parts.join(" · ");
}

export function diaryFileName(name: string, from: string, to: string): string {
  return `${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Child"}-diary-${from}-to-${to}.pdf`;
}
