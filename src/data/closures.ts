// Closures: whole days when the setting isn't open. Two kinds, coloured
// differently in the calendar, and each mapped to the matching per-child
// charging policy so invoices follow her own rules automatically.

export type ClosureKind = "minderHoliday" | "bankHoliday";

export interface Closure {
  id: string;
  kind: ClosureKind;
  start: string; // ISO, inclusive
  end: string; // ISO, inclusive
  label: string;
}

export const CLOSURE_LABELS: Record<ClosureKind, string> = {
  minderHoliday: "My holiday",
  bankHoliday: "Bank holiday",
};

export const CLOSURE_COLOURS: Record<ClosureKind, string> = {
  minderHoliday: "#9A6FB5", // plum
  bankHoliday: "#5C93C4", // sky
};

const bh = (date: string, label: string): Closure => ({
  id: `bh-${date}`,
  kind: "bankHoliday",
  start: date,
  end: date,
  label,
});

// England & Wales bank holidays (GOV.UK). Substitute days included:
// Boxing Day 2026 falls on a Saturday → Monday 28 December; Christmas and
// Boxing Day 2027 both fall at the weekend → 27 and 28 December.
export const UK_BANK_HOLIDAYS: Closure[] = [
  bh("2026-01-01", "New Year's Day"),
  bh("2026-04-03", "Good Friday"),
  bh("2026-04-06", "Easter Monday"),
  bh("2026-05-04", "Early May bank holiday"),
  bh("2026-05-25", "Spring bank holiday"),
  bh("2026-08-31", "Summer bank holiday"),
  bh("2026-12-25", "Christmas Day"),
  bh("2026-12-28", "Boxing Day (substitute)"),
  bh("2027-01-01", "New Year's Day"),
  bh("2027-03-26", "Good Friday"),
  bh("2027-03-29", "Easter Monday"),
  bh("2027-05-03", "Early May bank holiday"),
  bh("2027-05-31", "Spring bank holiday"),
  bh("2027-08-30", "Summer bank holiday"),
  bh("2027-12-27", "Christmas Day (substitute)"),
  bh("2027-12-28", "Boxing Day (substitute)"),
];

export function closureOn(iso: string, closures: Closure[]): Closure | undefined {
  // A childminder holiday wins over a bank holiday on the same day: it's the
  // one she's actively declared.
  const hits = closures.filter((c) => c.start <= iso && iso <= c.end);
  return hits.find((c) => c.kind === "minderHoliday") ?? hits[0];
}
