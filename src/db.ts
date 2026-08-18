import Dexie, { type EntityTable } from "dexie";

// All data is local-first: children's personal data and money never leave
// the device. Backup = JSON export via the share sheet (Settings, later).
// Money is ALWAYS integer pence; durations are ALWAYS integer minutes.

export interface ChildContract {
  id?: number;
  name: string;
  color?: string; // display colour (see CHILD_COLOURS)
  demo?: boolean; // demo data, removable in Settings
  dob?: string; // ISO date — drives entitlement age gates
  startDate?: string;
  /** Hourly rates with effective-from dates (versioned; never edit history). */
  rates: { fromDate: string; pencePerHour: number }[];
  /** Usual weekly schedule; minutes from midnight. null = not attending. */
  schedule: ({ startMin: number; endMin: number } | null)[]; // index 0 = Monday
  funding: {
    fundedMinutesPerWeek: number; // with THIS setting (may be a split share)
    model: "term-time"; // stretched mode is MVP3
    laRatePencePerHour?: number;
    minEffectivePencePerHour?: number; // e.g. 800 for the £8 minimum
    topUpLabel: string; // editable invoice wording
  } | null;
  policies: {
    childSick: "full" | "half" | "none";
    familyHoliday: "full" | "half" | "none";
    minderHoliday: "full" | "half" | "none";
    minderSick: "full" | "half" | "none";
    bankHoliday: "full" | "half" | "none";
  };
  payer?: { name?: string; method?: ("bank" | "tfc")[]; tfcReference?: string };
}

export type AbsenceReason =
  | "childSick"
  | "familyHoliday"
  | "minderHoliday"
  | "minderSick"
  | "bankHoliday"
  | "closed"
  | "other";

export interface DayLog {
  id?: number;
  childId: number;
  date: string; // ISO date
  startMin: number;
  endMin: number;
  absence?: AbsenceReason;
  note?: string;
  confirmed: boolean;
}

export interface Invoice {
  id?: number;
  childId: number;
  period: string; // "2026-08" — calendar month, billed in arrears
  version: number; // regeneration creates a new version, never mutates
  createdAt: string;
  lines: unknown[]; // engine InvoiceLine[] snapshot (immutable)
  totalPence: number;
  paidPence: number;
}

export interface Setting {
  key: string;
  value: unknown; // term calendar, business details, invoice footer, etc.
}

export const db = new Dexie("minderbill") as Dexie & {
  children: EntityTable<ChildContract, "id">;
  dayLogs: EntityTable<DayLog, "id">;
  invoices: EntityTable<Invoice, "id">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  children: "++id, name",
  dayLogs: "++id, [childId+date], date, childId",
  invoices: "++id, [childId+period], period, childId",
  settings: "key",
});
