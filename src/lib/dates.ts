// All dates are local-time ISO "YYYY-MM-DD" strings. Durations are minutes.

export function todayISO(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function toISO(y: number, m: number, day: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(y, m - 1, d + n);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** 0 = Monday … 6 = Sunday (schedule array order). */
export function weekdayIndex(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function fmtTime(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

export function minToInput(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function inputToMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fmtHours(minutes: number): string {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

export function fmtDateLong(iso: string): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function monthLabel(iso: string): string {
  const { y, m } = parseISO(iso);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Every ISO date in the month containing `iso`. */
export function monthDays(iso: string): string[] {
  const { y, m } = parseISO(iso);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => toISO(y, m, i + 1));
}

export function addMonths(iso: string, n: number): string {
  const { y, m } = parseISO(iso);
  const dt = new Date(y, m - 1 + n, 1);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, 1);
}
