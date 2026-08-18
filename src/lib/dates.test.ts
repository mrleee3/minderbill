import { describe, expect, it } from "vitest";
import { ageLabel } from "./dates";

describe("ageLabel", () => {
  it("uses months under a year", () => {
    expect(ageLabel("2026-01-10", "2026-08-18")).toBe("7m");
    expect(ageLabel("2026-08-01", "2026-08-18")).toBe("0m");
  });

  it("uses years and months between 1 and 5", () => {
    expect(ageLabel("2023-03-14", "2026-08-18")).toBe("3y 5m");
    expect(ageLabel("2024-08-18", "2026-08-18")).toBe("2y");
  });

  it("drops months from five years on", () => {
    expect(ageLabel("2021-03-14", "2026-08-18")).toBe("5y");
  });

  it("handles a birthday not yet reached this month", () => {
    expect(ageLabel("2023-08-20", "2026-08-18")).toBe("2y 11m");
  });

  it("returns nothing without a date of birth", () => {
    expect(ageLabel(undefined, "2026-08-18")).toBe("");
  });
});
