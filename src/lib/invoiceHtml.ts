import type { ChildContract } from "../db";
import type { DetailedLine } from "../engine/monthInvoice";
import { formatPence } from "../engine/invoice";
import { monthLabel } from "./dates";

export interface Business {
  name: string;
  tagline: string;
  ownerName?: string;
  ofstedReg?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  sortCode?: string;
  accountNo?: string;
  paymentNote?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderPrintHTML(
  child: ChildContract,
  period: string,
  lines: DetailedLine[],
  total: number,
  b: Business,
  version: number
): string {
  const fundedLine = lines.find((l) => l.kind === "funded");
  const rows = lines
    .map(
      (l) => `<tr>
        <td>${esc(l.label)}</td>
        <td class="num">${(l.minutes / 60).toFixed(2)}</td>
        <td class="num">${l.ratePencePerHour > 0 ? formatPence(l.ratePencePerHour) : "—"}</td>
        <td class="num">${l.kind === "funded" ? "£0.00" : formatPence(l.amountPence)}</td>
      </tr>`
    )
    .join("");
  const invNo = `JSN-${period.replace("-", "")}-${String(child.id).padStart(3, "0")}${version > 1 ? `-v${version}` : ""}`;
  const issued = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const payBits = [
    b.bankName || b.sortCode || b.accountNo
      ? `Bank transfer: ${esc(b.bankName ?? "")} ${esc(b.sortCode ?? "")} ${esc(b.accountNo ?? "")}`
      : "",
    child.payer?.tfcReference
      ? `Tax-Free Childcare reference: ${esc(child.payer.tfcReference)} (payments take 1–3 working days to clear)`
      : "",
    b.paymentNote ? esc(b.paymentNote) : "",
  ].filter(Boolean);

  return `
  <div class="letter">
    <header>
      <div>
        <h1>${esc(b.name)}</h1>
        <p class="tagline">${esc(b.tagline)}</p>
      </div>
      <div class="from">
        ${b.ownerName ? `<div>${esc(b.ownerName)}</div>` : ""}
        ${b.ofstedReg ? `<div>Ofsted reg. ${esc(b.ofstedReg)}</div>` : ""}
        ${b.email ? `<div>${esc(b.email)}</div>` : ""}
        ${b.phone ? `<div>${esc(b.phone)}</div>` : ""}
      </div>
    </header>
    <h2>Invoice</h2>
    <div class="meta">
      <div><span>Invoice no.</span>${invNo}</div>
      <div><span>Issued</span>${issued}</div>
      <div><span>Period</span>${monthLabel(`${period}-01`)}</div>
      <div><span>Child</span>${esc(child.name)}</div>
      ${child.payer?.name ? `<div><span>Billed to</span>${esc(child.payer.name)}</div>` : ""}
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">Total due</td><td class="num">${formatPence(total)}</td></tr></tfoot>
    </table>
    ${payBits.length ? `<div class="pay"><strong>Payment</strong>${payBits.map((p) => `<div>${p}</div>`).join("")}</div>` : ""}
    ${fundedLine ? `<div class="note"><strong>About funded hours</strong>
      <div>${(fundedLine.minutes / 60).toFixed(2)} hours this month were delivered under your government funded entitlement and are charged at £0.
      Funded hours apply during term time only; hours in school holidays, and any hours above the weekly entitlement, are charged at the usual rate.</div></div>` : ""}
    <p class="foot">All items are charged per our agreed terms. Thank you.</p>
  </div>`;
}
