// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HolidayEditor } from "./HolidayEditor";
import { Settings } from "../screens/Settings";
import { A4Preview } from "./A4Preview";
import { DateCalendar } from "./DateCalendar";
import { db } from "../db";
import { getClosures } from "../lib/settings";
import { boundView, zoomAt } from "../lib/invoiceZoom";

let host: HTMLDivElement, root: Root;
const click = async (el: HTMLElement) => { await act(async () => el.click()); };
const button = (label: string) => {
  const el = [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.getAttribute("aria-label") === label || b.textContent === label);
  expect(el, label).toBeTruthy(); return el!;
};
async function settle(check: () => void) { await vi.waitFor(async () => { await act(async () => { await new Promise(r => setTimeout(r, 5)); }); check(); }); }
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
  await db.open(); await db.settings.clear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("selects an inclusive holiday range across months, and edits the same closure", async () => {
  const save = vi.fn().mockResolvedValue(undefined), close = vi.fn();
  const original = { id: "existing", start: "2026-09-10", end: "2026-09-12", label: "Trip", kind: "minderHoliday" as const };
  await act(async () => root.render(<HolidayEditor closure={original} onSave={save} onClose={close} />));
  await click(button("Tue 29 Sept 2026"));
  await click(button("Next calendar month"));
  await click(button("Fri 2 Oct 2026"));
  expect(document.querySelector('[role="status"]')?.textContent).toContain("4 days");
  await click(button("Save dates"));
  expect(save).toHaveBeenCalledWith({ ...original, start: "2026-09-29", end: "2026-10-02" });
  expect(close).toHaveBeenCalledOnce();
});

it("handles reverse selection and saving a single day", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  await act(async () => root.render(<HolidayEditor closure={{ id: "one", kind: "minderHoliday", label: "", start: "2026-09-10", end: "2026-09-12" }} onSave={save} onClose={() => {}} />));
  await click(button("Sun 20 Sept 2026")); await click(button("Fri 18 Sept 2026"));
  expect(document.querySelector('[role="status"]')?.textContent).toContain("3 days");
  await click(button("Tue 22 Sept 2026")); await click(button("Save dates"));
  expect(save.mock.calls[0][0]).toMatchObject({ start: "2026-09-22", end: "2026-09-22" });
});

it("does not save on cancel and keeps a failed save open for retry", async () => {
  const save = vi.fn().mockRejectedValue(new Error("storage")), close = vi.fn();
  await act(async () => root.render(<HolidayEditor onSave={save} onClose={close} />));
  expect(button("Save dates").disabled).toBe(true);
  await click(button("Cancel")); expect(save).not.toHaveBeenCalled();
  await click(document.querySelector<HTMLButtonElement>(".range-day")!);
  await click(button("Save dates"));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't save");
  expect(close).toHaveBeenCalledOnce(); expect(button("Save dates").disabled).toBe(false);
});

it("saves holiday edits through Settings without duplicating existing records", async () => {
  await db.settings.put({ key: "closures", value: [{ id: "test", start: "2026-09-10", end: "2026-09-12", kind: "minderHoliday", label: "Test break" }] });
  await act(async () => root.render(<Settings />));
  await settle(() => expect(document.body.textContent).toContain("Test break"));
  expect(document.querySelectorAll(".settings-category")).toHaveLength(4);
  await click(button("Edit Test break"));
  await click(button("Tue 15 Sept 2026")); await click(button("Thu 17 Sept 2026"));
  await click(button("Save dates"));
  await settle(() => expect(document.querySelector(".holiday-dialog")).toBeNull());
  expect(await getClosures()).toEqual([{ id: "test", start: "2026-09-15", end: "2026-09-17", kind: "minderHoliday", label: "Test break" }]);
  expect(document.querySelector(".holiday-dialog")).toBeNull();
});

it("opens invoice zoom in a top-layer dialog and restores focus and app viewport", async () => {
  const meta = document.createElement("meta"); meta.name = "viewport"; meta.content = "width=device-width, initial-scale=1.0, user-scalable=no"; document.head.append(meta);
  await act(async () => root.render(<A4Preview html='<div class="letter"><h1>Test invoice</h1></div>' />));
  const open = button("View invoice full screen"); open.focus(); await click(open);
  expect(document.querySelector(".invoice-viewer[open]")).toBeTruthy();
  expect(document.body.classList.contains("invoice-viewer-open")).toBe(true);
  const fitTransform = (document.querySelector(".invoice-viewer-page") as HTMLElement).style.transform;
  await click(button("Zoom in"));
  expect((document.querySelector(".invoice-viewer-page") as HTMLElement).style.transform).not.toBe(fitTransform);
  await click(button("Fit"));
  expect((document.querySelector(".invoice-viewer-page") as HTMLElement).style.transform).toBe(fitTransform);
  await click(button("Close invoice"));
  expect(document.querySelector(".invoice-viewer")).toBeNull();
  expect(document.activeElement).toBe(open);
  expect(document.body.classList.contains("invoice-viewer-open")).toBe(false);
  expect(meta.content).toBe("width=device-width, initial-scale=1.0, user-scalable=no"); meta.remove();
});

it("anchors pinch zoom to the fingers and bounds panning and zoom", () => {
  expect(zoomAt({ scale: 1, x: 10, y: 20 }, 2, { x: 110, y: 220 })).toEqual({ scale: 2, x: -90, y: -180 });
  expect(zoomAt({ scale: 2, x: 10, y: 20 }, 8, { x: 0, y: 0 }).scale).toBe(4);
  expect(zoomAt({ scale: 2, x: 10, y: 20 }, .1, { x: 0, y: 0 }).scale).toBe(1);
  expect(boundView({ scale: 2, x: -9999, y: -9999 }, 400, 700, 376, 800)).toEqual({ scale: 2, x: -352, y: -912 });
});

it("opens a calendar on the displayed month and chooses a date in another month", async () => {
  const choose = vi.fn(), close = vi.fn();
  await act(async () => root.render(<DateCalendar date="2026-09-14" onChoose={choose} onClose={close} />));
  expect(button("Mon 14 Sept 2026").getAttribute("aria-pressed")).toBe("true");
  await click(button("Next calendar month"));
  await click(button("Fri 2 Oct 2026"));
  expect(choose).toHaveBeenCalledWith("2026-10-02");
  await click(button("Cancel")); expect(close).toHaveBeenCalledOnce();
});

it("handles two-finger zoom, then one-finger pan without changing the surrounding invoice carousel", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(700);
  const carouselTouch = vi.fn();
  await act(async () => root.render(<div onTouchStart={carouselTouch}><A4Preview html='<div class="letter">Invoice</div>' /></div>));
  await click(button("View invoice full screen"));
  const stage = document.querySelector<HTMLElement>(".invoice-viewer-stage")!;
  stage.setPointerCapture = vi.fn(); stage.hasPointerCapture = () => false;
  const pointer = async (type: string, id: number, x: number, y: number) => {
    await act(async () => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, "pointerId", { value: id }); stage.dispatchEvent(event);
    });
  };
  const transform = () => (document.querySelector(".invoice-viewer-page") as HTMLElement).style.transform;
  const fit = transform();
  await pointer("pointerdown", 1, 100, 200); await pointer("pointerdown", 2, 200, 200);
  await pointer("pointermove", 2, 300, 200);
  expect(transform()).not.toBe(fit);
  const zoomed = transform();
  await pointer("pointerup", 2, 300, 200); await pointer("pointermove", 1, 80, 160);
  expect(transform()).not.toBe(zoomed);
  await act(async () => stage.dispatchEvent(new Event("touchstart", { bubbles: true })));
  expect(carouselTouch).not.toHaveBeenCalled();
  await pointer("pointerup", 1, 80, 160);
  await click(button("Fit")); expect(transform()).toBe(fit);
});
