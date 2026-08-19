import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type Invoice } from "../db";
import { monthLabel } from "../lib/dates";
import { formatPence } from "../engine/invoice";
import type { DetailedLine } from "../engine/monthInvoice";
import { renderPrintHTML } from "../lib/invoiceHtml";
import { getBusiness, type Business } from "../lib/settings";
import { A4Preview } from "./A4Preview";
import { InvoiceActions } from "./InvoiceActions";

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

  // Carousel: every invoice sits side by side in one track. Dragging moves
  // the whole track, so the neighbouring invoice is already visible next to
  // the current one as you pull — no swap-and-bounce.
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);

  const width = () => trackRef.current?.clientWidth ?? window.innerWidth;

  const go = (target: number) => {
    const next = Math.max(0, Math.min(target, latest.length - 1));
    setAnimating(true);
    setDragX(0);
    setIndex(next);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, locked: null };
    setAnimating(false);
  };

  const onTouchMove = (e: TouchEvent) => {
    const st = startRef.current;
    if (!st) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (st.locked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      st.locked = Math.abs(dx) > Math.abs(dy) * 1.2;
    }
    if (!st.locked) return;
    // Resist pulling past the first or last invoice.
    const atEnd = (dx < 0 && index >= latest.length - 1) || (dx > 0 && index <= 0);
    setDragX(atEnd ? dx * 0.28 : dx);
  };

  const onTouchEnd = () => {
    const st = startRef.current;
    startRef.current = null;
    setAnimating(true);
    if (!st?.locked) {
      setDragX(0);
      return;
    }
    const threshold = Math.min(80, width() * 0.2);
    if (dragX <= -threshold) go(index + 1);
    else if (dragX >= threshold) go(index - 1);
    else setDragX(0);
  };

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
          onClick={() => go(index + 1)}
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
          onClick={() => go(index - 1)}
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
          onChange={(e) => go(latest.findIndex((x) => x.period === e.target.value))}
        >
          {latest.map((i) => (
            <option key={i.period} value={i.period}>
              {monthLabel(`${i.period}-01`)} — {formatPence(i.totalPence)}
            </option>
          ))}
        </select>
      )}

      <div
        className="carousel"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          className={`carousel-track${animating ? " animating" : ""}`}
          style={{ transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)` }}
          onTransitionEnd={() => setAnimating(false)}
        >
          {latest.map((item, i) => (
            <div className="carousel-slide" key={`${item.period}-v${item.version}`}>
              {/* Only the current invoice and its immediate neighbours are
                  rendered; the rest are spacers until they come into range. */}
              {business && Math.abs(i - index) <= 1 ? (
                <A4Preview
                  html={renderPrintHTML(
                    child,
                    item.period,
                    item.lines as DetailedLine[],
                    item.totalPence,
                    business,
                    item.version
                  )}
                />
              ) : (
                <div className="a4-frame placeholder" />
              )}
            </div>
          ))}
        </div>
      </div>
      {latest.length > 1 && (
        <div className="pager-dots" aria-hidden="true">
          {latest.map((x, i) => (
            <i key={x.period} className={i === index ? "on" : ""} />
          ))}
        </div>
      )}
      {latest.length > 1 && <p className="hint center">Swipe the invoice for other months.</p>}
      {business && (
        <InvoiceActions
          child={child}
          period={inv.period}
          lines={inv.lines as DetailedLine[]}
          total={inv.totalPence}
          business={business}
          version={inv.version}
        />
      )}
    </div>
  );
}
