import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract } from "../db";
import { ageLabel, todayISO } from "../lib/dates";
import { effectiveRatePence, scheduleSummary } from "../lib/schedule";
import { formatPence } from "../engine/invoice";
import { Sheet } from "../components/Sheet";
import { ChildForm } from "../components/ChildForm";
import { InvoiceHistory } from "../components/InvoiceHistory";
import { Collapsible } from "../components/Collapsible";
import { childColour } from "../lib/settings";
import { addDemoChildren } from "../lib/demo";
import { IconInvoices } from "../components/Icons";

type SheetState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; child: ChildContract }
  | { mode: "invoices"; child: ChildContract };

export function Children() {
  const childrenQ = useLiveQuery(() => db.children.toArray(), []);
  const loading = childrenQ === undefined;
  const children = childrenQ ?? [];
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const today = todayISO();

  // Keep the open sheet in step with live edits (e.g. after saving).
  useEffect(() => {
    if (sheet.mode !== "edit" && sheet.mode !== "invoices") return;
    const fresh = children.find((c) => c.id === sheet.child.id);
    if (fresh && fresh !== sheet.child) setSheet({ ...sheet, child: fresh });
  }, [children]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLeft = (c: ChildContract) => !!c.endDate && c.endDate < today;
  const active = children.filter((c) => !hasLeft(c));
  const archived = children.filter(hasLeft);

  const card = (c: ChildContract, i: number, archivedCard = false) => (
    <div key={c.id} className={`child-card${archivedCard ? " archived" : ""}`}>
      <button className="card-tap" onClick={() => setSheet({ mode: "edit", child: c })}>
        <span className="avatar" style={{ background: childColour(c, i) }}>
          <span className="avatar-letter">{c.name[0]?.toUpperCase()}</span>
        </span>
        <span className="card-main">
          <span className="card-name">
            {c.name}
            {c.dob && <span className="age"> ({ageLabel(c.dob, today)})</span>}
          </span>
          <span className="card-time hours">
            {formatPence(effectiveRatePence(c, today))}/hr
            <span className="dot-sep">·</span>
            {scheduleSummary(c, today)}
          </span>
          {archivedCard && c.endDate && (
            <span className="card-note">Left {c.endDate}</span>
          )}
        </span>
      </button>
      <button
        className="card-action"
        aria-label={`Invoices for ${c.name}`}
        onClick={() => setSheet({ mode: "invoices", child: c })}
      >
        <IconInvoices />
      </button>
    </div>
  );

  return (
    <>
      {loading ? (
        <div className="screen-skeleton" aria-hidden="true" />
      ) : children.length === 0 ? (
        <div className="empty">
          <span className="glyph">🧒</span>
          <p><strong>No children yet</strong></p>
          <p>Each child gets a contract: hourly rate, usual weekly hours, funded hours and charging policies.</p>
        </div>
      ) : (
        active.map((c, i) => card(c, i))
      )}

      {archived.length > 0 && (
        <div className="archived-block">
          <Collapsible title="No longer attending" count={archived.length}>
            {archived.map((c, i) => card(c, active.length + i, true))}
          </Collapsible>
        </div>
      )}

      {!loading && (
        <button className="btn-primary" onClick={() => setSheet({ mode: "new" })}>
          + Add child
        </button>
      )}
      {!loading && children.length === 0 && (
        <button className="btn-quiet" onClick={() => addDemoChildren()}>
          Or add two demo children to see it working
        </button>
      )}

      <Sheet
        open={sheet.mode !== "closed"}
        title={
          sheet.mode === "new"
            ? "Add child"
            : sheet.mode === "invoices"
              ? `${sheet.child.name} — invoices`
              : sheet.mode === "edit"
                ? sheet.child.name
                : ""
        }
        onClose={() => setSheet({ mode: "closed" })}
      >
        {sheet.mode === "new" && (
          <ChildForm existing={null} onDone={() => setSheet({ mode: "closed" })} />
        )}
        {sheet.mode === "edit" && (
          <ChildForm existing={sheet.child} onDone={() => setSheet({ mode: "closed" })} />
        )}
        {sheet.mode === "invoices" && <InvoiceHistory child={sheet.child} />}
      </Sheet>
    </>
  );
}
