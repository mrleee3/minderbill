import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract } from "../db";
import { todayISO } from "../lib/dates";
import { effectiveRatePence, scheduleSummary } from "../lib/schedule";
import { formatPence } from "../engine/invoice";
import { Sheet } from "../components/Sheet";
import { ChildForm } from "../components/ChildForm";

export function Children() {
  const children = useLiveQuery(() => db.children.toArray(), []) ?? [];
  const [sheet, setSheet] = useState<"closed" | "new" | ChildContract>("closed");

  return (
    <>
      {children.length === 0 ? (
        <div className="empty">
          <span className="glyph">🧒</span>
          <p><strong>No children yet</strong></p>
          <p>Each child gets a contract: hourly rate, usual weekly hours, funded hours and charging policies.</p>
        </div>
      ) : (
        children.map((c) => (
          <button key={c.id} className="child-card" onClick={() => setSheet(c)}>
            <span className="avatar">{c.name[0]?.toUpperCase()}</span>
            <span className="card-main">
              <span className="card-name">{c.name}</span>
              <span className="card-time hours">
                {formatPence(effectiveRatePence(c, todayISO()))}/hr
                <span className="dot-sep">·</span>
                {scheduleSummary(c)}
              </span>
            </span>
            {c.funding && (
              <span className="status-chip funded">
                {c.funding.fundedMinutesPerWeek / 60} h funded
              </span>
            )}
          </button>
        ))
      )}

      <button className="btn-primary" onClick={() => setSheet("new")}>
        + Add child
      </button>

      <Sheet
        open={sheet !== "closed"}
        title={sheet === "new" ? "Add child" : sheet !== "closed" ? sheet.name : ""}
        onClose={() => setSheet("closed")}
      >
        {sheet !== "closed" && (
          <ChildForm
            existing={sheet === "new" ? null : sheet}
            onDone={() => setSheet("closed")}
          />
        )}
      </Sheet>
    </>
  );
}
