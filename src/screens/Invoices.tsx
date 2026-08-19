import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type Invoice } from "../db";
import { addMonths, fmtHours, monthLabel, todayISO } from "../lib/dates";
import { buildMonthInvoice, type DetailedLine, type MonthInvoiceResult } from "../engine/monthInvoice";
import { formatPence } from "../engine/invoice";
import { getBusiness, getClosures, getTermBlocks, childColour, type Business } from "../lib/settings";
import type { Closure } from "../data/closures";
import { unconfirmedInPeriod } from "../lib/confirm";
import { ABSENCE_LABELS } from "../components/DayEditor";
import { Sheet } from "../components/Sheet";
import { A4Preview } from "../components/A4Preview";
import { renderPrintHTML } from "../lib/invoiceHtml";
import { InvoiceActions } from "../components/InvoiceActions";
import type { TermBlock } from "../data/surrey";

function prevMonthPeriod(): string {
  return addMonths(todayISO(), -1).slice(0, 7);
}

export function Invoices() {
  const [period, setPeriod] = useState(prevMonthPeriod());
  const childrenQ = useLiveQuery(() => db.children.toArray(), []);
  const loading = childrenQ === undefined;
  const children = childrenQ ?? [];
  const invoices =
    useLiveQuery(() => db.invoices.where("period").equals(period).toArray(), [period]) ?? [];
  const [blocks, setBlocks] = useState<TermBlock[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [business, setBiz] = useState<Business | null>(null);
  const [open, setOpen] = useState<ChildContract | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(0);

  useEffect(() => {
    getTermBlocks().then(setBlocks);
    getClosures().then(setClosures);
    getBusiness().then(setBiz);
  }, []);

  useEffect(() => {
    unconfirmedInPeriod(period).then(setUnconfirmed);
  }, [period, invoices.length]);

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

      {unconfirmed > 0 && (
        <p className="hint warn">
          {unconfirmed} day{unconfirmed > 1 ? "s" : ""} in {monthLabel(`${period}-01`)} not yet
          confirmed. You can still invoice, but it's worth checking those days first.
        </p>
      )}

      {loading && <div className="screen-skeleton" aria-hidden="true" />}

      {!loading && children.length === 0 && (
        <div className="empty">
          <span className="glyph">📄</span>
          <p><strong>No children yet</strong></p>
          <p>Add children first, then generate their monthly invoices here.</p>
        </div>
      )}

      {children
        .filter((c) => !c.endDate || c.endDate >= `${period}-01`)
        .map((c, i) => {
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
              {c.funding && (
                <span className="card-note">
                  {c.funding.fundedMinutesPerWeek / 60} h/wk funded, term time only
                </span>
              )}
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
            closures={closures}
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
  closures,
  business,
  saved,
}: {
  child: ChildContract;
  period: string;
  blocks: TermBlock[];
  closures: Closure[];
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
        setPreview(buildMonthInvoice(child, period, logs, blocks, closures));
      });
  }, [child, period, blocks, closures]);

  if (!preview) return <p className="hint">Working it out…</p>;

  const lines: DetailedLine[] = saved ? (saved.lines as DetailedLine[]) : preview.lines;
  const total = saved ? saved.totalPence : preview.totalPence;
  const isStale = saved && JSON.stringify(saved.lines) !== JSON.stringify(preview.lines);
  const sum = preview.summary;
  const paid = saved && saved.paidPence >= saved.totalPence && saved.totalPence > 0;
  const locked = !!saved && !isStale;

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
    await db.invoices.update(saved.id, { paidPence: paid ? 0 : saved.totalPence });
  }

  async function unlock() {
    if (!saved?.id) return;
    if (!confirm(`Delete v${saved.version} and go back to a draft? The hours themselves aren't changed.`)) return;
    await db.invoices.delete(saved.id);
  }

  return (
    <div className="form">
      {/* ---- Funding summary: the heart of the invoice ---- */}
      {sum.hasFunding ? (
        <div className={`fund-panel${sum.fundedMinutes === 0 ? " none" : ""}`}>
          <div className="fund-head">
            <span>Funding this month</span>
            <span className="hours">{fmtHours(sum.fundedCapMinutes)}/week entitlement</span>
          </div>
          <div className="fund-bars">
            <div className="fund-bar">
              <span className="bar-label">Term-time hours</span>
              <span className="hours">{fmtHours(sum.termMinutes)}</span>
            </div>
            <div className="fund-bar indent">
              <span className="bar-label leaf">→ covered by funding</span>
              <span className="hours leaf">{fmtHours(sum.fundedMinutes)}</span>
            </div>
            <div className="fund-bar indent">
              <span className="bar-label">→ over the entitlement, charged</span>
              <span className="hours">{fmtHours(Math.max(0, sum.termMinutes - sum.fundedMinutes))}</span>
            </div>
            <div className="fund-bar">
              <span className="bar-label">Holiday hours (no funding)</span>
              <span className="hours">{fmtHours(sum.holidayMinutes)}</span>
            </div>
          </div>
          {sum.fundedMinutes === 0 && sum.holidayMinutes > 0 && (
            <p className="hint warn">
              No funded days this month — every day fell outside your term dates. If that's wrong,
              check Settings → Funded term dates.
            </p>
          )}
          {sum.unusedFundedMinutes > 0 && (
            <p className="hint">
              {fmtHours(sum.unusedFundedMinutes)} of entitlement went unused this month (attended
              fewer hours than the weekly allowance).
            </p>
          )}
          {sum.topUpPencePerHour > 0 && sum.fundedMinutes > 0 && (
            <p className="hint">
              Funded hours are charged at £0; the top-up of {formatPence(sum.topUpPencePerHour)}/hr
              is billed separately below.
            </p>
          )}
        </div>
      ) : (
        <p className="hint">No government funding set up for {child.name} — all hours are charged privately.</p>
      )}

      {/* ---- Itemised lines ---- */}
      {lines.length === 0 && <p className="hint">No chargeable hours this month.</p>}
      {lines.map((l, i) => (
        <div key={i} className={`inv-line${l.kind === "funded" ? " funded" : ""}`}>
          <span className="inv-label">
            {l.label}
            <span className="inv-sub hours">
              {fmtHours(l.minutes)}
              {l.ratePencePerHour > 0 ? ` @ ${formatPence(l.ratePencePerHour)}/hr` : " — paid by the council"}
            </span>
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
          Hours or settings changed since v{saved!.version} — regenerate to create v{saved!.version + 1}.
          The saved version is never silently changed.
        </p>
      )}

      <button className="btn-quiet" onClick={() => setShowTrace((v) => !v)}>
        {showTrace ? "Hide the working" : "Show the working"}
      </button>
      {showTrace && (
        <div className="trace">
          {preview.trace.map((w) => (
            <div key={w.monday} className="trace-week">
              <div className="trace-head">
                Week of {w.monday}
                <span className={`status-chip ${w.funded ? "funded" : "planned"}`}>
                  {w.funded ? "Term time" : "Holiday"}
                </span>
              </div>
              {w.days.map((d) => (
                <div key={d.date} className={`trace-day${d.inMonth ? "" : " out"}`}>
                  <span className="hours">{d.date.slice(8)}{d.inMonth ? "" : " (other month)"}</span>
                  <span>
                    {d.absence
                      ? `${ABSENCE_LABELS[d.absence]} → ${d.policy === "full" ? "full" : d.policy === "half" ? "half" : "no"} charge`
                      : fmtHours(d.minutes)}
                  </span>
                  <span className="hours">
                    {d.fundedMin > 0 && <em className="leaf">{fmtHours(d.fundedMin)} funded</em>}
                    {d.fundedMin > 0 && d.privateMin > 0 && " + "}
                    {d.privateMin > 0 && `${fmtHours(d.privateMin)} charged`}
                    {d.chargeMinutes === 0 && "—"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ---- Inline A4 preview: always shown ---- */}
      {lines.length > 0 && (
        <>
          <div className="form-section">
            {locked ? `Invoice preview \u00b7 v${saved!.version}` : "Preview \u00b7 draft"}
          </div>
          <A4Preview
            html={renderPrintHTML(child, period, lines, total, business, saved?.version ?? 1)}
          />
          {!locked && (
            <p className="hint">
              Draft — generate to lock this version before sending.
            </p>
          )}
        </>
      )}

      {!locked ? (
        <button className="btn-primary" onClick={generate}>
          {saved ? `Regenerate as v${saved.version + 1}` : "Generate invoice"}
        </button>
      ) : (
        <>
          <InvoiceActions
            child={child}
            period={period}
            lines={lines}
            total={total}
            business={business}
            version={saved!.version}
          />
          <button className="btn-quiet" onClick={togglePaid}>
            {paid ? "Mark as unpaid" : "Mark as paid"}
          </button>
          <button className="btn-danger" onClick={unlock}>
            Undo v{saved!.version} — back to draft
          </button>
        </>
      )}
    </div>
  );
}
