import { describe, expect, it } from "vitest";
import { isHomeScreen } from "./viewport";

describe("Home Screen detection", () => {
  it("recognises Apple web clips when the media query says browser", () => {
    expect(isHomeScreen(false, true)).toBe(true);
  });
  it("recognises standard standalone mode", () => {
    expect(isHomeScreen(true, false)).toBe(true);
  });
  it("does not identify an ordinary browser tab as a Home Screen app", () => {
    expect(isHomeScreen(false, undefined)).toBe(false);
    expect(isHomeScreen(false, false)).toBe(false);
  });
});
