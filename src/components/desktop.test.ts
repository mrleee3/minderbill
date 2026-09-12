// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db, type ChildContract } from "../db";
import { Today } from "../screens/Today";
import { Children } from "../screens/Children";
import { Invoices } from "../screens/Invoices";
import { WorkspaceProvider, WorkspaceDetail } from "./Workspace";

let root: Root;
let host: HTMLDivElement;
let desktop = true;
const changes = new Set<() => void>();
const child = (name: string): ChildContract => ({ name, startDate: "2026-01-01", rates: [{ fromDate: "2026-01-01", pencePerHour: 800 }], schedules: [{ fromDate: "2026-01-01", days: Array.from({ length: 7 }, () => ({ startMin: 480, endMin: 1050 })) }], funding: null, policies: { childSick: "full", familyHoliday: "full", minderHoliday: "none", minderSick: "none", bankHoliday: "none" } });
async function render(component: ReturnType<typeof h>) { await act(async () => { root.render(h(WorkspaceProvider, null, component)); }); }
async function wait(check: () => void) { await vi.waitFor(async () => { await act(async () => { await new Promise(r => setTimeout(r, 5)); }); check(); }); }
function button(text: string, selector = "button") { const found = Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find(b => b.textContent?.includes(text)); expect(found, `button ${text}`).toBeTruthy(); return found!; }
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(async () => {
  desktop = true; changes.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({ get matches() { return query.includes("1100") ? desktop : false; }, media: query, addEventListener: (_: string, fn: () => void) => changes.add(fn), removeEventListener: (_: string, fn: () => void) => changes.delete(fn) }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.children.bulkAdd([child("Ava"), child("Noah")]);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); await Promise.all(db.tables.map(table => table.clear())); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps desktop attendance visible beside an editor, saves twice to one log and preserves child isolation", async () => {
  await render(h(Today, { date: "2026-09-09", setDate: vi.fn() }));
  await wait(() => expect(document.querySelectorAll(".workspace-list .child-card")).toHaveLength(2));
  await click(button("Ava", ".workspace-list button"));
  expect(document.querySelector(".workspace-detail .day-editor")).toBeTruthy();
  expect(document.querySelector(".sheet-overlay")).toBeNull();
  const note = () => document.querySelector<HTMLTextAreaElement>(".day-editor textarea")!;
  await fill(note(), "Ava's note");
  await click(button("Noah", ".workspace-list button"));
  expect(window.confirm).toHaveBeenCalled();
  expect(note().value).toBe("Ava's note");
  await click(button("Save", ".day-editor button"));
  await wait(() => expect(document.querySelector(".saved-notice")).toBeTruthy());
  expect(await db.dayLogs.count()).toBe(1);
  await fill(note(), "Updated note");
  await click(button("Save", ".day-editor button"));
  await wait(() => expect(document.querySelector(".saved-notice")).toBeTruthy());
  expect(await db.dayLogs.count()).toBe(1);
  expect((await db.dayLogs.toArray())[0].note).toBe("Updated note");
  await click(button("Noah", ".workspace-list button"));
  expect(note().value).toBe("");
  await click(button("Ava", ".workspace-list button"));
  expect(note().value).toBe("Updated note");
});

it("protects edits when changing the attendance date", async () => {
  const setDate = vi.fn();
  await render(h(Today, { date: "2026-09-09", setDate }));
  await wait(() => expect(document.querySelectorAll(".workspace-list .child-card")).toHaveLength(2));
  await click(button("Ava", ".workspace-list button"));
  await fill(document.querySelector<HTMLTextAreaElement>(".day-editor textarea")!, "Unsaved");
  await click(document.querySelector<HTMLElement>('button[aria-label="Next day"]')!);
  expect(setDate).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  await click(document.querySelector<HTMLElement>('button[aria-label="Next day"]')!);
  expect(setDate).toHaveBeenCalledWith("2026-09-10");
});

it("filters children and opens contract/diary/invoices without closing the workspace", async () => {
  await render(h(Children));
  await wait(() => expect(document.querySelectorAll(".card-tap")).toHaveLength(2));
  await fill(document.querySelector<HTMLInputElement>('input[type="search"]')!, "noah");
  expect(document.querySelectorAll(".card-tap")).toHaveLength(1);
  await click(button("Noah", ".card-tap"));
  expect(document.querySelector<HTMLInputElement>('.workspace-detail input')?.value).toBe("Noah");
  await click(button("Diary", ".desktop-detail-tabs button"));
  expect(document.querySelector(".child-diary")).toBeTruthy();
  expect(document.querySelectorAll(".card-tap")).toHaveLength(1);
  await click(button("Contract", ".desktop-detail-tabs button"));
  expect(document.querySelector<HTMLInputElement>('.workspace-detail input')?.value).toBe("Noah");
});

it("switches invoice child and month without retaining another child's preview", async () => {
  await render(h(Invoices));
  await wait(() => expect(document.querySelectorAll(".workspace-list .child-card")).toHaveLength(2));
  await click(button("Ava", ".workspace-list button"));
  await wait(() => expect(document.querySelector(".workspace-detail")?.textContent).toContain("No government funding set up for Ava"));
  await click(button("Noah", ".workspace-list button"));
  await wait(() => expect(document.querySelector(".workspace-detail")?.textContent).toContain("No government funding set up for Noah"));
  expect(document.querySelector(".workspace-detail")?.textContent).not.toContain("No government funding set up for Ava");
  await fill(document.querySelector<HTMLInputElement>('input[type="month"]')!, "2026-07");
  await wait(() => expect(document.querySelector(".workspace-detail-head")?.textContent).toContain("July 2026"));
});

it("retains mobile sheets and restores page scrolling after closing", async () => {
  desktop = false;
  const onClose = vi.fn();
  await render(h(WorkspaceDetail, { open: true, title: "Mobile entry", onClose, children: h("p", null, "Form") }));
  expect(document.querySelector(".sheet-overlay")).toBeTruthy();
  expect(document.querySelector(".workspace-detail")).toBeNull();
  expect(document.body.classList.contains("sheet-open")).toBe(true);
  await click(document.querySelector<HTMLElement>('button[aria-label="Close"]')!);
  expect(onClose).toHaveBeenCalledOnce();
  await render(h(WorkspaceDetail, { open: false, title: "", onClose, children: null }));
  await act(async () => { await new Promise(r => setTimeout(r, 300)); });
  expect(document.querySelector(".sheet-overlay")).toBeNull();
  expect(document.body.classList.contains("sheet-open")).toBe(false);
});

it("keeps an unsaved entry intact across desktop/mobile resizing", async () => {
  await render(h(Today, { date: "2026-09-09", setDate: vi.fn() }));
  await wait(() => expect(document.querySelectorAll(".workspace-list .child-card")).toHaveLength(2));
  await click(button("Ava", ".workspace-list button"));
  await fill(document.querySelector<HTMLTextAreaElement>(".day-editor textarea")!, "Keep this draft");
  await act(async () => { desktop = false; changes.forEach(fn => fn()); });
  expect(document.querySelector<HTMLTextAreaElement>(".sheet-body .day-editor textarea")?.value).toBe("Keep this draft");
  await act(async () => { desktop = true; changes.forEach(fn => fn()); });
  expect(document.querySelector<HTMLTextAreaElement>(".workspace-detail .day-editor textarea")?.value).toBe("Keep this draft");
  expect(document.body.classList.contains("sheet-open")).toBe(false);
});

it("filters paid, unpaid and ungenerated invoices from latest versions", async () => {
  const kids = await db.children.toArray();
  const thirdId = await db.children.add(child("Ella"));
  await db.invoices.bulkAdd([
    { childId: kids[0].id!, period: "2026-08", version: 1, totalPence: 5000, paidPence: 0, createdAt: "2026-09-01", lines: [] },
    { childId: kids[0].id!, period: "2026-08", version: 2, totalPence: 6000, paidPence: 6000, createdAt: "2026-09-02", lines: [] },
    { childId: kids[1].id!, period: "2026-08", version: 1, totalPence: 4000, paidPence: 1000, createdAt: "2026-09-01", lines: [] },
  ]);
  await render(h(Invoices));
  await fill(document.querySelector<HTMLInputElement>('input[type="month"]')!, "2026-08");
  await wait(() => expect(document.querySelectorAll(".workspace-list .child-card")).toHaveLength(3));
  await click(button("Unpaid", ".invoice-filters button"));
  expect(document.querySelectorAll(".workspace-list .child-card")).toHaveLength(1);
  expect(document.querySelector(".workspace-list .child-card")?.textContent).toContain("Noah");
  await click(button("To generate", ".invoice-filters button"));
  expect(document.querySelector(".workspace-list .child-card")?.textContent).toContain("Ella");
  expect(thirdId).toBeTruthy();
});
