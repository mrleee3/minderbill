import { describe, expect, it } from "vitest";
import { correctedViewportBottom, isHomeScreen, type ViewportMetrics } from "./viewport";

const reported: ViewportMetrics = {
  homeScreen: true, iphone: true, screenHeight: 932, viewportHeight: 1027,
  scale: 0.85, offsetTop: 0, safeTop: 59, safeBottom: 34,
};

describe("iPhone Home Screen viewport correction", () => {
  it("detects Apple's Home Screen mode when the media query says browser", () => {
    expect(isHomeScreen(false, true)).toBe(true);
    expect(isHomeScreen(true, false)).toBe(true);
    expect(isHomeScreen(false, undefined)).toBe(false);
  });
  it("converts the reported 85% viewport back to the full screen edge", () => {
    const bottom = correctedViewportBottom(reported)!;
    expect(bottom * reported.scale).toBeCloseTo(932);
    expect((bottom - reported.viewportHeight) * reported.scale).toBeCloseTo(59.05);
  });
  it("uses the actual screen size on a smaller iPhone at normal scale", () => {
    expect(correctedViewportBottom({ ...reported, screenHeight: 844, viewportHeight: 797, scale: 1, safeTop: 47 })).toBe(844);
  });
  it.each([
    { homeScreen: false }, { iphone: false }, { viewportHeight: 932 / 0.85 },
    { viewportHeight: 600 }, { offsetTop: 50 }, { scale: 1.5 }, { scale: 0 },
    { scale: NaN }, { viewportHeight: 1200 },
  ])("leaves normal browsers, correct viewports, keyboards and zooming alone: %j", (change) => {
    expect(correctedViewportBottom({ ...reported, ...change })).toBeNull();
  });
});
