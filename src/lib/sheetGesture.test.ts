import { expect, it } from "vitest";
import { shouldDismissSheet } from "./sheetGesture";

it("ignores taps and small accidental movements even at high speed", () => {
  expect(shouldDismissSheet(0, 0, 700)).toBe(false);
  expect(shouldDismissSheet(15, 2, 700)).toBe(false);
});
it("dismisses a deliberate pull relative to sheet height", () => {
  expect(shouldDismissSheet(119, 0, 700)).toBe(false);
  expect(shouldDismissSheet(120, 0, 700)).toBe(true);
  expect(shouldDismissSheet(75, 0, 300)).toBe(true);
});
it("accepts a downward flick but snaps back for upward or slow releases", () => {
  expect(shouldDismissSheet(45, 0.7, 700)).toBe(true);
  expect(shouldDismissSheet(45, -0.7, 700)).toBe(false);
  expect(shouldDismissSheet(45, 0.1, 700)).toBe(false);
});
