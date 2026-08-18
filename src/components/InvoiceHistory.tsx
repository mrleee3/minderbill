import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type Invoice } from "../db";
import { monthLabel } from "../lib/dates";
import { formatPence } from "../engine/invoice";
import type { DetailedLine } from "../engine/monthInvoice";
import { renderPrintHTML } from "../lib/invoiceHtml";
import { getBusiness, type Business } from "../lib/settings";
import { useSwipe } from "../lib/useSwipe";
import { A4Preview } from "./A4Preview";

/**
 * A child's invoice history: newest first, swipe left/right to move between
 * them, or jump straight to a month with the picker.
 */
export function InvoiceHistory({ child }: { child: ChildContract }) {
  const invoices =
    useLiveQuery(
      () => db.invoices.where("childId").equals(child.id!).toArray(),
      [child.id]
    ) ?? [];
  const [business, setBusiness] = useState<Business | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    getBusiness().then(setBusiness);
  }, []);

  // Newest first; only the latest version of each period.
  const latest = Object.values(
    invoices.reduce<Record<string, Invoice>>((acc, inv) => {
      const cur = acc[inv.period];
      if (!cur || inv.version > cur.version) acc[inv.period] = inv;
      return acc;
    }, {})
  ).sort((a, b) => b.period.localeCompare(a.period));

  const swipe = useSwipe(
    () => setIndex((i) => Math.min(i + 1, latest.length - 1)), // left = older
    () => setIndex((i) => Math.max(i - 1, 0))
  );

  if (latest.length === 0) {
    return (
      <p className="hint">
        No invoices generated for {child.name} yet. Generate one from the Invoices tab and it
        will appear here.
      </p>
    );
  }

  const inv = latest[Math.min(index, latest.length - 1)];
  const paid = inv.paidPence >= inv.totalPence && inv.totalPence > 0;

  return (
    <div className="form">
      <div className="date-nav">
        <button
          className="nav-btn"
          onClick={() => setIndex((i) => Math.min(i + 1, latest.length - 1))}
          disabled={index >= latest.length - 1}
          aria-label="Older invoice"
        >
          ‹
        </button>
        <div className="date-label">
          <strong>{monthLabel(`${inv.period}-01`)}</strong>
          <span className="hint">
            {index + 1} of {latest.length}
            {inv.version > 1 ? ` · v${inv.version}` : ""}
          </span>
        </div>
        <button
          className="nav-btn"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          aria-label="Newer invoice"
        >
          ›
        </button>
      </div>

      <div className="inv-line total">
        <span className="inv-label">Total {paid ? "paid" : "due"}</span>
        <span className="money">{formatPence(inv.totalPence)}</span>
      </div>

      {latest.length > 1 && (
        <select
          className="period-picker"
          value={inv.period}
          onChange={(e) => setIndex(latest.findIndex((x) => x.period === e.target.value))}
        >
          {latest.map((i) => (
            <option key={i.period} value={i.period}>
              {monthLabel(`${i.period}-01`)} — {formatPence(i.totalPence)}
            </option>
          ))}
        </select>
      )}

      <div {...swipe}>
        {business && (
          <A4Preview
            html={renderPrintHTML(
              child,
              inv.period,
              inv.lines as DetailedLine[],
              inv.totalPence,
              business,
              inv.version
            )}
          />
        )}
      </div>
      {latest.length > 1 && <p className="hint center">Swipe the invoice for other months.</p>}
    </div>
  );
}
