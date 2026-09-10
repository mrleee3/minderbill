import { afterEach, expect, it, vi } from "vitest";
import { exportPdf } from "./exportPdf";

const file = { name: "diary.pdf" } as File;
function setup(userAgent: string, canShare = true) {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { userAgent, platform: "", maxTouchPoints: 0, canShare: () => canShare, share });
  const link = { href: "", download: "", target: "", rel: "", click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal("document", { createElement: () => link, body: { appendChild: vi.fn() } });
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:pdf"), revokeObjectURL: vi.fn() });
  vi.useFakeTimers();
  return { share, link };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("uses the native file sheet for iPhone Save without opening a PDF link", async () => {
  const { share, link } = setup("iPhone");
  expect(await exportPdf(file, { title: "Diary" })).toBe("shared");
  expect(share).toHaveBeenCalledWith({ files: [file], title: "Diary" });
  expect(link.click).not.toHaveBeenCalled();
});
it("does not download or navigate after cancelling the file sheet", async () => {
  const { share, link } = setup("iPhone");
  share.mockRejectedValue(Object.assign(new Error("Cancelled"), { name: "AbortError" }));
  await expect(exportPdf(file, { title: "Diary" })).rejects.toMatchObject({ name: "AbortError" });
  expect(link.click).not.toHaveBeenCalled();
});
it("keeps desktop saving as a download and isolates any preview fallback", async () => {
  const { share, link } = setup("Desktop");
  expect(await exportPdf(file, { title: "Diary" })).toBe("downloaded");
  expect(share).not.toHaveBeenCalled();
  expect(link).toMatchObject({ target: "_blank", rel: "noopener noreferrer", download: "diary.pdf" });
  expect(link.click).toHaveBeenCalledOnce();
  expect(link.remove).toHaveBeenCalledOnce();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
});
it("isolates the download fallback when iPhone file sharing is unavailable", async () => {
  const { link } = setup("iPhone", false);
  await exportPdf(file, { title: "Diary" });
  expect(link.target).toBe("_blank");
  expect(link.click).toHaveBeenCalledOnce();
});
it("honours an explicit Share request on desktop", async () => {
  const { share } = setup("Desktop");
  await exportPdf(file, { title: "Diary" }, true);
  expect(share).toHaveBeenCalledOnce();
});
