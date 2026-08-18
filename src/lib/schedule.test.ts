import { describe, expect, it } from "vitest";
import type { ChildContract, DayLog } from "../db";
import { effectiveRatePence, plannedSlot, resolveDay, scheduleOn, scheduleSummary } from "./schedule";

const child: ChildContract = {
  id: 1,
  name: "Ava",
  rates: [
    { fromDate: "2026-01-01", pencePerHour: 750 },
    { fromDate: "2026-09-01", pencePerHour: 800 },
  ],
  // Mon–Wed 8:00–17:30
  schedules: [
    {
      fromDate: "2026-01-01",
      days: [
        { startMin: 480, endMin: 1050 },
        { startMin: 480, endMin: 1050 },
        { startMin: 480, endMin: 1050 },
        null,
        null,
        null,
        null,
      ],
    },
  ],
  funding: null,
  policies: {
    childSick: "full",
    familyHoliday: "full",
    minderHoliday: "none",
    minderSick: "none",
    bankHoliday: "none",
  },
};

describe("plannedSlot / resolveDay", () => {
  it("maps ISO dates to the Monday-first schedule", () => {
    expect(plannedSlot(child, "2026-08-17")).not.toBeNull(); // Monday
    expect(plannedSlot(child, "2026-08-20")).toBeNull(); // Thursday
    expect(plannedSlot(child, "2026-08-23")).toBeNull(); // Sunday
  });

  it("resolves an unlogged scheduled day from the schedule", () => {
    const r = resolveDay(child, "2026-08-18", undefined)!;
    expect(r.source).toBe("schedule");
    expect(r.minutes).toBe(570); // 9.5h
  });

  it("prefers an explicit log over the schedule", () => {
    const log: DayLog = {
      childId: 1,
      date: "2026-08-18",
      startMin: 480,
      endMin: 1110, // late pickup 18:30
      confirmed: true,
    };
    const r = resolveDay(child, "2026-08-18", log)!;
    expect(r.source).toBe("log");
    expect(r.minutes).toBe(630);
  });

  it("resolves unplanned attendance (log on an unscheduled day)", () => {
    const log: DayLog = {
      childId: 1,
      date: "2026-08-20",
      startMin: 540,
      endMin: 900,
      confirmed: true,
    };
    expect(resolveDay(child, "2026-08-20", log)!.minutes).toBe(360);
  });

  it("returns null for unscheduled, unlogged days", () => {
    expect(resolveDay(child, "2026-08-20", undefined)).toBeNull();
  });
});

describe("effectiveRatePence", () => {
  it("uses the latest rate version in force on the date", () => {
    expect(effectiveRatePence(child, "2026-08-31")).toBe(750);
    expect(effectiveRatePence(child, "2026-09-01")).toBe(800);
    expect(effectiveRatePence(child, "2027-01-01")).toBe(800);
  });

  it("falls back to the earliest version before its fromDate", () => {
    expect(effectiveRatePence(child, "2025-06-01")).toBe(750);
  });
});

describe("scheduleSummary", () => {
  it("collapses consecutive days into a range", () => {
    expect(scheduleSummary(child, "2026-08-18")).toBe("Mon–Wed · 28.5 h/wk");
  });
});


describe("versioned schedules", () => {
  const changed = {
    ...child,
    schedules: [
      ...child.schedules,
      {
        fromDate: "2026-09-01",
        days: [
          { startMin: 540, endMin: 900 },
          { startMin: 540, endMin: 900 },
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ],
  };

  it("uses the pattern in force on the date", () => {
    expect(scheduleOn(changed, "2026-08-31")[2]).not.toBeNull(); // Wed still on
    expect(scheduleOn(changed, "2026-09-01")[2]).toBeNull(); // Wed dropped
    expect(resolveDay(changed, "2026-08-19", undefined)!.minutes).toBe(570); // old Wed
    expect(resolveDay(changed, "2026-09-02", undefined)).toBeNull(); // new: no Wed
    expect(resolveDay(changed, "2026-09-01", undefined)!.minutes).toBe(360); // new Tue 9–15
  });
});

describe("contract dates", () => {
  const bounded = { ...child, startDate: "2026-02-01", endDate: "2026-08-14" };

  it("has no scheduled hours before the start date or after the end date", () => {
    expect(resolveDay(bounded, "2026-01-19", undefined)).toBeNull(); // a Monday, pre-start
    expect(resolveDay(bounded, "2026-08-17", undefined)).toBeNull(); // Monday after leaving
    expect(resolveDay(bounded, "2026-08-10", undefined)).not.toBeNull();
  });

  it("ignores stale logs outside the contract dates", () => {
    const log = { childId: 1, date: "2026-08-17", startMin: 480, endMin: 1050, confirmed: true };
    expect(resolveDay(bounded, "2026-08-17", log)).toBeNull();
  });
});

describe("closures", () => {
  const closures = [
    { id: "h1", kind: "minderHoliday" as const, start: "2026-08-17", end: "2026-08-21", label: "Summer break" },
    { id: "b1", kind: "bankHoliday" as const, start: "2026-08-31", end: "2026-08-31", label: "Summer bank holiday" },
  ];

  it("turns planned days inside a closure into that absence", () => {
    const r = resolveDay(child, "2026-08-17", undefined, closures)!; // Monday
    expect(r.absence).toBe("minderHoliday");
    expect(r.closureLabel).toBe("Summer break");
    expect(r.minutes).toBe(570); // hours unchanged; policy decides the charge
  });

  it("marks bank holidays separately", () => {
    expect(resolveDay(child, "2026-08-31", undefined, closures)!.absence).toBe("bankHoliday");
  });

  it("leaves days outside closures untouched", () => {
    expect(resolveDay(child, "2026-08-24", undefined, closures)!.absence).toBeUndefined();
  });

  it("lets an explicit log override a closure", () => {
    const log = { childId: 1, date: "2026-08-17", startMin: 480, endMin: 1050, confirmed: true };
    const r = resolveDay(child, "2026-08-17", log, closures)!;
    expect(r.absence).toBeUndefined();
    expect(r.source).toBe("log");
  });
});
