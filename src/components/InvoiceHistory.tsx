import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract, type Invoice } from "../db";
import { monthLabel } from "../lib/dates";
import { formatPence } from "../engine/invoice";
import type { DetailedLine } from "../engine/monthInvoice";
import { renderPrintHTML } from "../lib/invoiceHtml";
import { getBusiness, type Business } from "../lib/settings";
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

  // Drag-to-page: the invoice follows the finger, then either settles back
  // or slides out and the neighbour slides in from the opposite edge.
  const [dragX, setDragX] = useState(0);
  const [gliding, setGliding] = useState(false);
  const startRef = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next > latest.length - 1) return;
    const width = window.innerWidth;
    setGliding(true);
    setDragX(delta > 0 ? -width : width); // slide the current page out
    window.setTimeout(() => {
      setGliding(false);
      setIndex(next);
      setDragX(delta > 0 ? width : -width); // place the new page off-screen
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setGliding(true);
          setDragX(0); // and bring it in
        });
      });
    }, 190);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, locked: null };
    setGliding(false);
  };

  const onTouchMove = (e: TouchEvent) => {
    const st = startRef.current;
    if (!st) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (st.locked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      st.locked = Math.abs(dx) > Math.abs(dy) * 1.2; // horizontal?
    }
    if (!st.locked) return;
    // Resist dragging past the first or last invoice.
    const atEnd = (dx < 0 && index >= latest.length - 1) || (dx > 0 && index <= 0);
    setDragX(atEnd ? dx * 0.25 : dx);
  };

  const onTouchEnd = () => {
    const st = startRef.current;
    startRef.current = null;
    if (!st?.locked) {
      setDragX(0);
      return;
    }
    const threshold = Math.min(90, window.innerWidth * 0.22);
    if (dragX <= -threshold) go(1);
    else if (dragX >= threshold) go(-1);
    else {
      setGliding(true);
      setDragX(0);
    }
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
          onClick={() => go(1)}
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
          onClick={() => go(-1)}
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
          onChange={(e) => go(latest.findIndex((x) => x.period === e.target.value) - index)}
        >
          {latest.map((i) => (
            <option key={i.period} value={i.period}>
              {monthLabel(`${i.period}-01`)} — {formatPence(i.totalPence)}
            </option>
          ))}
        </select>
      )}

      <div
        className="pager"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={`pager-page${gliding ? " gliding" : ""}`}
          style={{
            transform: `translate3d(${dragX}px,0,0)`,
            opacity: 1 - Math.min(Math.abs(dragX) / (window.innerWidth * 0.9), 0.45),
          }}
        >
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
      </div>
      {latest.length > 1 && (
        <div className="pager-dots" aria-hidden="true">
          {latest.map((x, i) => (
            <i key={x.period} className={i === index ? "on" : ""} />
          ))}
        </div>
      )}
      {latest.length > 1 && <p className="hint center">Swipe the invoice for other months.</p>}
    </div>
  );
}
