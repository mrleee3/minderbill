import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ChildContract } from "../db";
import type { DetailedLine } from "../engine/monthInvoice";
import { formatPence } from "../engine/invoice";
import { monthLabel } from "./dates";
import type { Business } from "./invoiceHtml";

// Drawn from the invoice data rather than rasterising HTML: the result is a
// real vector PDF (sharp at any zoom, a few KB, selectable text) that mirrors
// the on-screen letter.

const A4 = { w: 595.28, h: 841.89 }; // points
const M = 56; // margin
const INK = rgb(0.102, 0.165, 0.196);
const GREY = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.85, 0.85, 0.85);
const LEAF = rgb(0.306, 0.608, 0.435);

export function invoiceNumber(child: ChildContract, period: string, version: number): string {
  return `JSN-${period.replace("-", "")}-${String(child.id).padStart(3, "0")}${
    version > 1 ? `-v${version}` : ""
  }`;
}

export function invoiceFileName(child: ChildContract, period: string): string {
  const safe = child.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `${safe}-${period}.pdf`;
}

export async function buildInvoicePdf(
  child: ChildContract,
  period: string,
  lines: DetailedLine[],
  total: number,
  b: Business,
  version: number
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  pdf.setTitle(`Invoice ${invoiceNumber(child, period, version)}`);
  pdf.setAuthor(b.name);
  pdf.setSubject(`Childcare invoice — ${monthLabel(`${period}-01`)}`);

  let y = A4.h - M;

  const text = (
    s: string,
    x: number,
    yy: number,
    size: number,
    font: PDFFont = serif,
    color = INK
  ) => page.drawText(s, { x, y: yy, size, font, color });

  const right = (s: string, xRight: number, yy: number, size: number, font: PDFFont = serif, color = INK) =>
    page.drawText(s, { x: xRight - font.widthOfTextAtSize(s, size), y: yy, size, font, color });

  const rule = (yy: number, thickness = 0.75, color = RULE) =>
    page.drawLine({
      start: { x: M, y: yy },
      end: { x: A4.w - M, y: yy },
      thickness,
      color,
    });

  // ---- Masthead ----
  text(b.name, M, y - 22, 26, serifBold);
  text(b.tagline, M, y - 38, 11, serifItalic, GREY);

  const contact = [b.ownerName, b.ofstedReg ? `Ofsted reg. ${b.ofstedReg}` : "", b.email, b.phone]
    .filter(Boolean) as string[];
  contact.forEach((l, i) => right(l, A4.w - M, y - 20 - i * 11, 9, serif, GREY));

  y -= 50;
  rule(y, 2, INK);
  y -= 26;

  // ---- Meta ----
  text("INVOICE", M, y, 11, serifBold);
  y -= 20;
  const meta: [string, string][] = [
    ["Invoice no.", invoiceNumber(child, period, version)],
    ["Issued", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ["Period", monthLabel(`${period}-01`)],
    ["Child", child.name],
    ...(child.payer?.name ? ([["Billed to", child.payer.name]] as [string, string][]) : []),
  ];
  for (const [k, v] of meta) {
    text(k, M, y, 9.5, serif, GREY);
    text(v, M + 95, y, 9.5);
    y -= 14;
  }

  // ---- Table ----
  y -= 12;
  const cols = { desc: M, hours: 340, rate: 430, amount: A4.w - M };
  text("DESCRIPTION", cols.desc, y, 8, serifBold, GREY);
  right("HOURS", cols.hours + 40, y, 8, serifBold, GREY);
  right("RATE", cols.rate + 50, y, 8, serifBold, GREY);
  right("AMOUNT", cols.amount, y, 8, serifBold, GREY);
  y -= 8;
  rule(y, 0.75, GREY);
  y -= 16;

  for (const l of lines) {
    text(l.label, cols.desc, y, 10.5);
    right((l.minutes / 60).toFixed(2), cols.hours + 40, y, 10.5);
    right(l.ratePencePerHour > 0 ? formatPence(l.ratePencePerHour) : "—", cols.rate + 50, y, 10.5);
    right(l.kind === "funded" ? "£0.00" : formatPence(l.amountPence), cols.amount, y, 10.5);
    y -= 10;
    rule(y);
    y -= 16;
  }

  y -= 2;
  rule(y + 10, 1.5, INK);
  text("Total due", cols.desc, y - 4, 12, serifBold);
  right(formatPence(total), cols.amount, y - 4, 12, serifBold);
  y -= 34;

  // ---- Payment ----
  const payBits = [
    b.bankName || b.sortCode || b.accountNo
      ? `Bank transfer: ${[b.bankName, b.sortCode, b.accountNo].filter(Boolean).join("  ")}`
      : "",
    child.payer?.tfcReference
      ? `Tax-Free Childcare reference: ${child.payer.tfcReference} (payments take 1–3 working days to clear)`
      : "",
    b.paymentNote ?? "",
  ].filter(Boolean) as string[];

  if (payBits.length) {
    text("PAYMENT", M, y, 8, serifBold, GREY);
    y -= 14;
    for (const p of payBits) {
      for (const line of wrap(p, serif, 10, A4.w - M * 2)) {
        text(line, M, y, 10);
        y -= 13;
      }
    }
    y -= 8;
  }

  // ---- Funded-hours note ----
  const funded = lines.find((l) => l.kind === "funded");
  if (funded) {
    const note =
      `${(funded.minutes / 60).toFixed(2)} hours this month were delivered under your government ` +
      `funded entitlement and are charged at £0. Funded hours apply during term time only; hours ` +
      `in school holidays, and any hours above the weekly entitlement, are charged at the usual rate.`;
    const wrapped = wrap(note, serif, 9.5, A4.w - M * 2 - 14);
    const blockH = wrapped.length * 12 + 14;
    page.drawRectangle({ x: M, y: y - blockH + 12, width: 2.5, height: blockH, color: LEAF });
    text("ABOUT FUNDED HOURS", M + 12, y, 8, serifBold, GREY);
    y -= 14;
    for (const line of wrapped) {
      text(line, M + 12, y, 9.5);
      y -= 12;
    }
    y -= 8;
  }

  text("All items are charged per our agreed terms. Thank you.", M, y, 9, serifItalic, GREY);

  const bytes = await pdf.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

/** Greedy word wrap to a pixel width for a given font/size. */
function wrap(s: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      out.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Draw nothing; kept so PDFPage stays imported for future page breaks. */
export type { PDFPage };
