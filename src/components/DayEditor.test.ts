import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChildContract } from "../db";
import { DayEditor } from "./DayEditor";

const child: ChildContract = {
  id: 1, name: "Test child", rates: [], schedules: [], funding: null,
  policies: { childSick: "full", familyHoliday: "full", minderHoliday: "half", minderSick: "none", bankHoliday: "none" },
};

describe("absence charging explanation", () => {
  it.each([
    ["closed", "half rate"],
    ["other", "full rate"],
    ["minderSick", "no charge"],
  ] as const)("shows the invoice policy for %s", (absence, expected) => {
    const html = renderToStaticMarkup(createElement(DayEditor, {
      child, date: "2026-08-17", closures: [], log: undefined, onDone() {},
      resolved: { startMin: 480, endMin: 1050, minutes: 570, absence, source: "log" },
    }));
    expect(html).toContain(expected);
    expect(html).toContain("on the hours shown above");
  });
});
