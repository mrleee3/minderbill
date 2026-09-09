import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ChildContract, DayLog } from "../db";
import { diaryDays, careEntryText } from "./diary";
import { fmtDateLong } from "./dates";

/** Selectable-text A4 diary, with wrapping and automatic page breaks. */
export async function buildDiaryPdf(child: ChildContract, from: string, to: string, logs: DayLog[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.17, 0.2), grey = rgb(0.4, 0.45, 0.47);
  const supported = new Set(regular.getCharacterSet());
  // Preserve unsupported symbols as their Unicode code, rather than failing
  // the export or silently dropping parts of a parent's note.
  const printable = (value: string) => Array.from(value.replace(/\r\n?/g, "\n").replace(/\t/g, "    ")).map(c =>
    c === "\n" || supported.has(c.codePointAt(0)!) ? c : `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`).join("");
  const wrap = (value: string, width: number, size: number, font: PDFFont) => {
    const result: string[] = [];
    for (const paragraph of printable(value).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (!word) continue;
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
        if (line) result.push(line);
        line = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width) { result.push(line); line = ""; }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  };
  const width = 595.28, height = 841.89, margin = 48;
  let page = pdf.addPage([width, height]), y = height - margin;
  const heading = () => {
    page.drawText("Daily diary", { x: margin, y, size: 23, font: bold, color: ink });
    y -= 25;
    for (const line of wrap(child.name, width - margin * 2, 13, bold)) {
      page.drawText(line, { x: margin, y, size: 13, font: bold, color: ink }); y -= 17;
    }
    page.drawText(`${from} to ${to}`, { x: margin, y, size: 10, font: regular, color: grey });
    y -= 15;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, color: rgb(0.9, 0.64, 0.23), thickness: 2 });
    y -= 26;
  };
  const ensure = (space: number) => {
    if (y - space < 55) { page = pdf.addPage([width, height]); y = height - margin; heading(); }
  };
  const paragraph = (value: string, size = 11, font = regular, indent = 0) => {
    for (const line of wrap(value, width - margin * 2 - indent, size, font)) {
      ensure(16);
      page.drawText(line, { x: margin + indent, y, size, font, color: ink }); y -= 16;
    }
  };
  heading();
  const days = diaryDays(logs, child.id!, from, to);
  for (const day of days) {
    ensure(62);
    paragraph(`${fmtDateLong(day.date)} ${day.date.slice(0, 4)}`, 12, bold);
    y -= 4;
    for (const entry of day.careEntries ?? []) {
      paragraph(`${entry.time}  ${careEntryText(entry)}`, 11, regular, 10);
      y -= 5;
    }
    if (day.note?.trim()) { paragraph(`Notes: ${day.note.trim()}`, 11, regular, 10); y -= 5; }
    y -= 13;
  }
  if (!days.length) paragraph("No diary entries in this date range.");
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`MinderBill  |  Page ${i + 1} of ${pages.length}`, { x: margin, y: 30, size: 9, font: regular, color: grey }));
  pdf.setTitle(`${child.name} - Daily diary`);
  pdf.setSubject(`${from} to ${to}`);
  return pdf.save();
}
