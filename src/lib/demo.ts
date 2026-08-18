import { db, type ChildContract, type DayLog } from "../db";
import { addDays, todayISO } from "./dates";

// Two contrasting demo children:
// - Demo Ava: 3yo, funded 15 h/wk, LA £6.42 vs £8 minimum → top-up applies.
// - Demo Noah: 2yo, funded 12 h/wk, LA £9.40 covers the minimum → no top-up.
// Plus a couple of sample exception logs so Month/invoices show variety.

export async function addDemoChildren(): Promise<void> {
  const slot = { startMin: 480, endMin: 1050 }; // 8:00–17:30
  const short = { startMin: 540, endMin: 900 }; // 9:00–15:00

  const ava: ChildContract = {
    name: "Demo Ava",
    color: "#5C93C4",
    demo: true,
    dob: "2023-03-14",
    startDate: "2026-01-05",
    rates: [{ fromDate: "2026-01-05", pencePerHour: 800 }],
    schedule: [slot, slot, slot, null, null, null, null],
    funding: {
      fundedMinutesPerWeek: 900,
      model: "term-time",
      laRatePencePerHour: 642,
      minEffectivePencePerHour: 800,
      topUpLabel: "Additional services charge",
    },
    policies: {
      childSick: "full",
      familyHoliday: "full",
      minderHoliday: "none",
      minderSick: "none",
      bankHoliday: "none",
    },
    payer: { name: "Demo parent", method: ["bank", "tfc"], tfcReference: "AVA1234" },
  };

  const noah: ChildContract = {
    name: "Demo Noah",
    color: "#E07856",
    demo: true,
    dob: "2024-06-02",
    startDate: "2026-04-13",
    rates: [{ fromDate: "2026-04-13", pencePerHour: 850 }],
    schedule: [null, null, null, short, short, null, null],
    funding: {
      fundedMinutesPerWeek: 720,
      model: "term-time",
      laRatePencePerHour: 940,
      minEffectivePencePerHour: 800,
      topUpLabel: "Additional services charge",
    },
    policies: {
      childSick: "full",
      familyHoliday: "full",
      minderHoliday: "none",
      minderSick: "none",
      bankHoliday: "none",
    },
    payer: { name: "Demo parent", method: ["bank"] },
  };

  const avaId = (await db.children.add(ava)) as number;
  const noahId = (await db.children.add(noah)) as number;

  // Sample exceptions in the recent past: one sick day, one late pickup,
  // one unplanned extra day.
  const today = todayISO();
  const logs: DayLog[] = [
    { childId: avaId, date: addDays(today, -7), startMin: 480, endMin: 1050, absence: "childSick", confirmed: true },
    { childId: avaId, date: addDays(today, -6), startMin: 480, endMin: 1110, note: "Late pickup", confirmed: true },
    { childId: noahId, date: addDays(today, -5), startMin: 540, endMin: 900, note: "Extra day", confirmed: true },
  ];
  await db.dayLogs.bulkAdd(logs);
}

export async function removeDemoData(): Promise<number> {
  const demos = await db.children.filter((c) => !!c.demo).toArray();
  for (const c of demos) {
    if (c.id != null) await db.dayLogs.where("childId").equals(c.id).delete();
  }
  await db.children.bulkDelete(demos.map((c) => c.id!).filter((x) => x != null));
  return demos.length;
}
