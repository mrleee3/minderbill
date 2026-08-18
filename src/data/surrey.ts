// Surrey County Council reference data. Prefills ONLY — everything is
// editable in the app, because published LA figures can carry supplements
// (EYPP, deprivation) and funded-week calendars can differ slightly from
// school terms (INSET days are not funded). Always verifiable against her
// SCC remittance and the Early Years Funded Dates calendar.

export interface TermBlock {
  start: string; // ISO, inclusive
  end: string; // ISO, inclusive
  label: string;
}

// Surrey school term dates, academic year 2026/27 (surreycc.gov.uk,
// "School term changes for 2026 to 2027"). NB two-week October half term.
export const SURREY_TERMS_2026_27: TermBlock[] = [
  { start: "2026-09-01", end: "2026-10-16", label: "Autumn 1 · 2026" },
  { start: "2026-11-02", end: "2026-12-18", label: "Autumn 2 · 2026" },
  { start: "2027-01-04", end: "2027-02-12", label: "Spring 1 · 2027" },
  { start: "2027-02-22", end: "2027-03-25", label: "Spring 2 · 2027" },
  { start: "2027-04-12", end: "2027-05-28", label: "Summer 1 · 2027" },
  { start: "2027-06-07", end: "2027-07-28", label: "Summer 2 · 2027" },
];

export type AgeBand = "under2" | "two" | "threeFour";

export const BAND_LABELS: Record<AgeBand, string> = {
  under2: "9 months – 2 years",
  two: "2 year olds",
  threeFour: "3 & 4 year olds",
};

// Surrey funded rates per hour paid to providers from 1 April 2026
// (surreycc.gov.uk provider pages). Under-2s rate is not published on an
// open page — she should take it from her SCC remittance.
export const SURREY_RATES_FROM_2026_04: Partial<Record<AgeBand, number>> = {
  two: 940, // £9.40
  threeFour: 642, // £6.42
};

/** Age band on a given date from DOB (band changes on 2nd/3rd birthday). */
export function ageBandOn(dobISO: string, onISO: string): AgeBand {
  const [by, bm, bd] = dobISO.split("-").map(Number);
  const [oy, om, od] = onISO.split("-").map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age--;
  if (age < 2) return "under2";
  if (age < 3) return "two";
  return "threeFour";
}

export function surreyRateFor(dobISO: string, onISO: string): number | null {
  return SURREY_RATES_FROM_2026_04[ageBandOn(dobISO, onISO)] ?? null;
}
