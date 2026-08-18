import { describe, expect, it } from "vitest";
import { allocateWeek, amountPence, formatPence, totalPence } from "./invoice";

// Reference scenario: 30h attended, 15h funded cap, £8/hr private,
// top-up £1.88/hr (e.g. £8.00 min effective − £6.12 LA rate).
const base = {
  weekMinutes: 30 * 60,
  fundedWeek: true,
  fundedCapMinutes: 15 * 60,
  privateRatePencePerHour: 800,
  topUpPencePerFundedHour: 188,
};

describe("allocateWeek", () => {
  it("splits a funded week into funded + top-up + private", () => {
    const lines = allocateWeek(base);
    expect(lines.map((l) => l.kind)).toEqual(["funded", "topup", "private"]);
    const [funded, topup, priv] = lines;
    expect(funded.minutes).toBe(900);
    expect(funded.amountPence).toBe(0);
    expect(topup.amountPence).toBe(15 * 188); // £28.20
    expect(priv.amountPence).toBe(15 * 800); // £120.00
    expect(totalPence(lines)).toBe(14820); // £148.20
  });

  it("charges everything privately in a non-funded (holiday) week", () => {
    const lines = allocateWeek({ ...base, fundedWeek: false });
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe("private");
    expect(lines[0].amountPence).toBe(30 * 800); // £240.00
  });

  it("caps funded minutes at actual attendance", () => {
    const lines = allocateWeek({ ...base, weekMinutes: 10 * 60 });
    expect(lines.map((l) => l.kind)).toEqual(["funded", "topup"]);
    expect(lines[0].minutes).toBe(600);
    expect(totalPence(lines)).toBe(10 * 188);
  });

  it("omits the top-up line when top-up is zero", () => {
    const lines = allocateWeek({ ...base, topUpPencePerFundedHour: 0 });
    expect(lines.map((l) => l.kind)).toEqual(["funded", "private"]);
  });

  it("returns no lines for a zero-minute week", () => {
    expect(allocateWeek({ ...base, weekMinutes: 0 })).toEqual([]);
  });

  it("rejects negative inputs", () => {
    expect(() => allocateWeek({ ...base, weekMinutes: -1 })).toThrow();
  });
});

describe("money helpers", () => {
  it("rounds half-up on partial hours", () => {
    expect(amountPence(90, 800)).toBe(1200);
    expect(amountPence(50, 800)).toBe(667); // 666.67 → 667
  });

  it("formats pence as GBP", () => {
    expect(formatPence(14820)).toBe("£148.20");
    expect(formatPence(5)).toBe("£0.05");
    expect(formatPence(-1234)).toBe("-£12.34");
  });
});
