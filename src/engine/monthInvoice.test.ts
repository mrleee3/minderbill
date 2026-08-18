import { describe, expect, it } from "vitest";
import type { ChildContract, DayLog } from "../db";
import type { TermBlock } from "../data/surrey";
import { buildMonthInvoice, policyFor } from "./monthInvoice";

// Mon–Wed 8:00–17:30 (9.5 h/day, 28.5 h/wk), £8/hr, funded 15 h/wk,
// LA £6.42 → top-up £1.58/hr.
const child: ChildContract = {
  id: 1,
  name: "Ava",
  rates: [{ fromDate: "2026-01-01", pencePerHour: 800 }],
  schedule: [
    { startMin: 480, endMin: 1050 },
    { startMin: 480, endMin: 1050 },
    { startMin: 480, endMin: 1050 },
    null,
    null,
    null,
    null,
  ],
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
};

// September 2026 fully in term; October part-term.
const terms: TermBlock[] = [{ start: "2026-09-01", end: "2026-10-16", label: "Autumn 1" }];

describe("buildMonthInvoice", () => {
  it("splits funded weeks into funded/top-up/private and prices them", () => {
    // Sept 2026: Tue 1st … Wed 30th. Weeks with Mon in Sept: 7,14,21,28.
    // Week of Aug 31: Mon 31 Aug out of month; Tue 1 + Wed 2 in month.
    const inv = buildMonthInvoice(child, "2026-09", [], terms);
    // Term starts Tue 1 Sept: Mon 31 Aug is out of term (all private, and
    // out of month); Tue consumes 570 of the 900 cap; Wed 330 funded + 240.
    const w0 = inv.trace[0];
    expect(w0.funded).toBe(true);
    expect(w0.days[0].inMonth).toBe(false);
    expect(w0.days[0].fundedMin).toBe(0);
    expect(w0.days[0].privateMin).toBe(570);
    expect(w0.days[1].fundedMin).toBe(570);
    expect(w0.days[1].privateMin).toBe(0);
    expect(w0.days[2].fundedMin).toBe(330);
    expect(w0.days[2].privateMin).toBe(240);

    // Full weeks 7/14/21: 900 funded + 810 private each. Week of 28th:
    // Mon 28 (570 funded), Tue 29 (330 f + 240 p), Wed 30 (570 p).
    // In-month funded: 900/week for all five weeks touching September.
    const funded = inv.lines.find((l) => l.kind === "funded")!;
    expect(funded.minutes).toBe(5 * 900); // 4500
    const topup = inv.lines.find((l) => l.kind === "topup")!;
    expect(topup.ratePencePerHour).toBe(158);
    expect(topup.amountPence).toBe(Math.round((4500 * 158) / 60)); // £118.50
    const priv = inv.lines.find((l) => l.kind === "private")!;
    expect(priv.minutes).toBe(240 + 3 * 810 + 810); // 3480
    expect(priv.amountPence).toBe(Math.round((3480 * 800) / 60)); // £464.00
    expect(inv.totalPence).toBe(topup.amountPence + priv.amountPence);
  });

  it("charges everything privately outside term", () => {
    const inv = buildMonthInvoice(child, "2026-08", [], terms);
    expect(inv.lines).toHaveLength(1);
    expect(inv.lines[0].kind).toBe("private");
  });

  it("applies absence policies (full keeps charge, none zeroes it)", () => {
    const logs: DayLog[] = [
      { childId: 1, date: "2026-09-08", startMin: 480, endMin: 1050, absence: "childSick", confirmed: true },
      { childId: 1, date: "2026-09-09", startMin: 480, endMin: 1050, absence: "minderHoliday", confirmed: true },
    ];
    const inv = buildMonthInvoice(child, "2026-09", logs, terms);
    const week = inv.trace.find((w) => w.monday === "2026-09-07")!;
    expect(week.days[1].chargeMinutes).toBe(570); // sick, full rate
    expect(week.days[2].chargeMinutes).toBe(0); // minder holiday, no charge
    // Week total charge 1140 < 900 funded cap? No: 570+570=1140 → 900 funded + 240 private.
    expect(week.days.reduce((s, d) => s + d.fundedMin, 0)).toBe(900);
    expect(week.days.reduce((s, d) => s + d.privateMin, 0)).toBe(240);
  });

  it("half-rate policy halves the chargeable minutes", () => {
    const halfChild: ChildContract = {
      ...child,
      policies: { ...child.policies, familyHoliday: "half" },
    };
    const logs: DayLog[] = [
      { childId: 1, date: "2026-09-08", startMin: 480, endMin: 1050, absence: "familyHoliday", confirmed: true },
    ];
    const inv = buildMonthInvoice(halfChild, "2026-09", logs, terms);
    const week = inv.trace.find((w) => w.monday === "2026-09-07")!;
    expect(week.days[1].chargeMinutes).toBe(285);
  });

  it("no funding config means one private line only", () => {
    const unfunded = { ...child, funding: null };
    const inv = buildMonthInvoice(unfunded, "2026-09", [], terms);
    expect(inv.lines).toHaveLength(1);
    expect(inv.lines[0].kind).toBe("private");
    expect(inv.lines[0].minutes).toBe(14 * 570); // 14 scheduled days in Sept 2026
  });
});

describe("policyFor", () => {
  it("maps closed to the minder-holiday policy and other to full", () => {
    expect(policyFor(child, "closed")).toBe("none");
    expect(policyFor(child, "other")).toBe("full");
  });
});
