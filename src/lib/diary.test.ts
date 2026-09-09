import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { careEntryText, diaryDays } from "./diary";
import { buildDiaryPdf } from "./diaryPdf";
import type { ChildContract, DayLog } from "../db";

const base: DayLog = { childId: 1, date: "2026-09-09", startMin: 480, endMin: 1050, confirmed: true };
const child = { id: 1, name: "Demo Ava" } as ChildContract;

describe("child diary", () => {
  it("includes care and note-only days, excludes other children, empty days and out-of-range dates", () => {
    const days = diaryDays([
      { ...base, note: "General note" },
      { ...base, date: "2026-09-08", careEntries: [{ id: "a", kind: "toileting", label: "Wet nappy", time: "10:30" }] },
      { ...base, childId: 2, note: "Private to another child" },
      { ...base, date: "2026-08-31", note: "Outside range" },
      { ...base, date: "2026-09-07", note: "  " },
    ], 1, "2026-09-01", "2026-09-09");
    expect(days.map(day => day.date)).toEqual(["2026-09-09", "2026-09-08"]);
    expect(days.every(day => day.childId === 1)).toBe(true);
  });
  it("sorts events by time without mutating saved order", () => {
    const entries = [
      { id: "b", kind: "drink" as const, label: "Milk", time: "14:30", amountMl: 0 },
      { id: "a", kind: "food" as const, label: "Lunch", time: "12:00", eaten: "most" as const, details: "Pasta" },
    ];
    const days = diaryDays([{ ...base, careEntries: entries }], 1, base.date, base.date);
    expect(days[0].careEntries?.map(e => e.id)).toEqual(["a", "b"]);
    expect(entries[0].id).toBe("b");
    expect(careEntryText(entries[0])).toContain("0 ml");
    expect(careEntryText(entries[1])).toBe("Lunch · Eaten: most · Pasta");
  });
  it("exports long notes over multiple A4 pages and accepts unsupported symbols", async () => {
    const bytes = await buildDiaryPdf(child, base.date, base.date, [{ ...base, note: "Happy today 😊\n" + "Long diary note with plenty of detail. ".repeat(350) }]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPages().every(page => Math.abs(page.getWidth() - 595.28) < 0.1)).toBe(true);
    expect(pdf.getTitle()).toBe("Demo Ava - Daily diary");
  });
});
