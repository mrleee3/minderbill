import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type Invoice } from "../db";
import { addMonths, fmtHours, monthLabel, todayISO } from "../lib/dates";
import { buildMonthInvoice, type DetailedLine, type MonthInvoiceResult } from "../engine/monthInvoice";
import { formatPence } from "../engine/invoice";
import { getBusiness, getTermBlocks, childColour, type Business } from "../lib/settings";
import { ABSENCE_LABELS } from "../components/DayEditor";
import { Sheet } from "../components/Sheet";
import type { TermBlock } from "../data/surrey";

function prevMonthPeriod(): string {
  return addMonths(todayISO(), -1).slice(0, 7);
}

export function Invoices() {
  const [period, setPeriod] = useState(prevMonthPeriod());
  const children = useLiveQuery(() => db.children.toArray(), []) ?? [];
  const invoices =
    useLiveQuery(() => db.invoices.where("period").equals(period).toArray(), [period]) ?? [];
  const [blocks, setBlocks] = useState<TermBlock[]>([]);
  const [business, setBiz] = useState<Business | null>(null);
  const [open, setOpen] = useState<ChildContract | null>(null);

  useEffect(() => {
    getTermBlocks().then(setBlocks);
    getBusiness().then(setBiz);
  }, []);

  const latestFor = (c: ChildContract): Invoice | undefined =>
    invoices
      .filter((i) => i.childId === c.id)
      .sort((a, b) => b.version - a.version)[0];

  return (
    <>
      <div className="date-nav">
        <button className="nav-btn" onClick={() => setPeriod(addMonths(`${period}-01`, -1).slice(0, 7))} aria-label="Previous month">‹</button>
        <div className="date-label"><strong>{monthLabel(`${period}-01`)}</strong></div>
        <button className="nav-btn" onClick={() => setPeriod(addMonths(`${period}-01`, 1).slice(0, 7))} aria-label="Next month">›</button>
      </div>

      {children.length === 0 && (
        <div className="empty">
          <span className="glyph">📄</span>
          <p><strong>No children yet</strong></p>
          <p>Add children first, then generate their monthly invoices here.</p>
        </div>
      )}

      {children.map((c, i) => {
        const inv = latestFor(c);
        const paid = inv && inv.paidPence >= inv.totalPence && inv.totalPence > 0;
        return (
          <button key={c.id} className="child-card" onClick={() => setOpen(c)}>
            <span className="avatar" style={{ background: childColour(c, i) }}>
              <span className="avatar-letter">{c.name[0]?.toUpperCase()}</span>
            </span>
            <span className="card-main">
              <span className="card-name">{c.name}</span>
              <span className="card-time money">
                {inv ? `${formatPence(inv.totalPence)} · v${inv.version}` : "Not generated"}
              </span>
            </span>
            <span className={`status-chip ${paid ? "funded" : inv ? "adjusted" : "planned"}`}>
              {paid ? "Paid" : inv ? "Generated" : "Draft"}
            </span>
          </button>
        );
      })}

      <Sheet
        open={!!open}
        title={open ? `${open.name} — ${monthLabel(`${period}-01`)}` : ""}
        onClose={() => setOpen(null)}
      >
        {open && business && (
          <InvoiceDetail
            child={open}
            period={period}
            blocks={blocks}
            business={business}
            saved={latestFor(open)}
          />
        )}
      </Sheet>
    </>
  );
}

function InvoiceDetail({
  child,
  period,
  blocks,
  business,
  saved,
}: {
  child: ChildContract;
  period: string;
  blocks: TermBlock[];
  business: Business;
  saved: Invoice | undefined;
}) {
  const [preview, setPreview] = useState<MonthInvoiceResult | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    // All of this child's logs; the engine only reads the weeks that
    // overlap the invoice month.
    db.dayLogs
      .where("childId")
      .equals(child.id!)
      .toArray()
      .then((logs) => {
        setPreview(buildMonthInvoice(child, period, logs, blocks));
      });
  }, [child, period, blocks]);

  if (!preview) return <p className="hint">Working it out…</p>;

  const lines: DetailedLine[] = saved ? (saved.lines as DetailedLine[]) : preview.lines;
  const total = saved ? saved.totalPence : preview.totalPence;
  const isStale =
    saved && JSON.stringify(saved.lines) !== JSON.stringify(preview.lines);

  async function generate() {
    const version = (saved?.version ?? 0) + 1;
    await db.invoices.add({
      childId: child.id!,
      period,
      version,
      createdAt: new Date().toISOString(),
      lines: preview!.lines,
      totalPence: preview!.totalPence,
      paidPence: saved?.paidPence ?? 0,
    });
  }

  async function togglePaid() {
    if (!saved?.id) return;
    const paid = saved.paidPence >= saved.totalPence && saved.totalPence > 0;
    await db.invoices.update(saved.id, { paidPence: paid ? 0 : saved.totalPence });
  }

  function printInvoice() {
    const el = document.getElementById("print-root");
    if (!el) return;
    el.innerHTML = renderPrintHTML(child, period, lines, total, business, saved?.version ?? 1);
    window.print();
  }

  const paid = saved && saved.paidPence >= saved.totalPence && saved.totalPence > 0;

  return (
    <div className="form">
      {lines.length === 0 && <p className="hint">No chargeable hours this month.</p>}
      {lines.map((l, i) => (
        <div key={i} className={`inv-line${l.kind === "funded" ? " funded" : ""}`}>
          <span className="inv-label">
            {l.label}
            <span className="inv-sub hours">{fmtHours(l.minutes)}{l.ratePencePerHour > 0 ? ` @ ${formatPence(l.ratePencePerHour)}/hr` : ""}</span>
          </span>
          <span className="money">{l.kind === "funded" ? "£0.00" : formatPence(l.amountPence)}</span>
        </div>
      ))}
      <div className="inv-line total">
        <span className="inv-label">Total due</span>
        <span className="money">{formatPence(total)}</span>
      </div>

      {isStale && (
        <p className="hint warn">
          Logs or settings have changed since v{saved!.version} was generated — regenerate to
          create v{saved!.version + 1}. The saved version is never silently changed.
        </p>
      )}

      <button className="btn-quiet" onClick={() => setShowTrace((s) => !s)}>
        {showTrace ? "Hide the working" : "Show the working"}
      </button>
      {showTrace && (
        <div className="trace">
          {preview.trace.map((w) => (
            <div key={w.monday} className="trace-week">
              <div className="trace-head">
                Week of {w.monday}
                <span className={`status-chip ${w.funded ? "funded" : "planned"}`}>
                  {w.funded ? "Funded week" : "Not funded"}
                </span>
              </div>
              {w.days.map((d) => (
                <div key={d.date} className={`trace-day${d.inMonth ? "" : " out"}`}>
                  <span className="hours">{d.date.slice(8)}{d.inMonth ? "" : " (prev/next month)"}</span>
                  <span>
                    {d.absence
                      ? `${ABSENCE_LABELS[d.absence]} → ${d.policy === "full" ? "full" : d.policy === "half" ? "half" : "no"} charge`
                      : fmtHours(d.minutes)}
                  </span>
                  <span className="hours">
                    {d.fundedMin > 0 && <em className="leaf">{fmtHours(d.fundedMin)} funded</em>}
                    {d.fundedMin > 0 && d.privateMin > 0 && " + "}
                    {d.privateMin > 0 && `${fmtHours(d.privateMin)} private`}
                    {d.chargeMinutes === 0 && "—"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!saved || isStale ? (
        <button className="btn-primary" onClick={generate}>
          {saved ? `Regenerate as v${saved.version + 1}` : "Generate invoice"}
        </button>
      ) : (
        <>
          <button className="btn-primary" onClick={printInvoice}>Print / save PDF</button>
          <button className="btn-quiet" onClick={togglePaid}>
            {paid ? "Mark as unpaid" : "Mark as paid"}
          </button>
        </>
      )}
    </div>
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPrintHTML(
  child: ChildContract,
  period: string,
  lines: DetailedLine[],
  total: number,
  b: Business,
  version: number
): string {
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
    <p class="foot">Government funded hours are shown at no charge. All other items are charged per our agreed terms. Thank you.</p>
  </div>`;
}
