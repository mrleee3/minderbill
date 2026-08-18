import { describe, expect, it } from "vitest";
import type { ChildContract, DayLog } from "../db";
import { effectiveRatePence, plannedSlot, resolveDay, scheduleSummary } from "./schedule";

const child: ChildContract = {
  id: 1,
  name: "Ava",
  rates: [
    { fromDate: "2026-01-01", pencePerHour: 750 },
    { fromDate: "2026-09-01", pencePerHour: 800 },
  ],
  // Mon–Wed 8:00–17:30
  schedule: [
    { startMin: 480, endMin: 1050 },
    { startMin: 480, endMin: 1050 },
    { startMin: 480, endMin: 1050 },
    null,
    null,
    null,
    null,
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
    expect(scheduleSummary(child)).toBe("Mon–Wed · 28.5 h/wk");
  });
});
