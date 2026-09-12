import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChildContract } from "../db";
import { ageLabel, todayISO } from "../lib/dates";
import { effectiveRatePence, scheduleSummary } from "../lib/schedule";
import { formatPence } from "../engine/invoice";
import { useDesktop } from "../lib/useDesktop";
import { WorkspaceDetail, useWorkspaceNavigation } from "../components/Workspace";
import { ChildForm } from "../components/ChildForm";
import { InvoiceHistory } from "../components/InvoiceHistory";
import { Collapsible } from "../components/Collapsible";
import { childColour } from "../lib/settings";
import { addDemoChildren } from "../lib/demo";
import { ChildDiary } from "../components/ChildDiary";
import { IconDiary, IconInvoices } from "../components/Icons";

type SheetState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; child: ChildContract }
  | { mode: "invoices"; child: ChildContract }
  | { mode: "diary"; child: ChildContract };

export function Children() {
  const desktop = useDesktop();
  const childrenQ = useLiveQuery(() => db.children.toArray(), []);
  const loading = childrenQ === undefined;
  const children = childrenQ ?? [];
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const today = todayISO();
  const [search, setSearch] = useState("");
  const canLeave = useWorkspaceNavigation();
  const choose = (next: SheetState) => { if (canLeave()) setSheet(next); };
  const matches = (c: ChildContract) => !desktop || c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());

  // Keep the open sheet in step with live edits (e.g. after saving).
  useEffect(() => {
    if (sheet.mode !== "edit" && sheet.mode !== "invoices" && sheet.mode !== "diary") return;
    const fresh = children.find((c) => c.id === sheet.child.id);
    if (fresh && fresh !== sheet.child) setSheet({ ...sheet, child: fresh });
  }, [children]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLeft = (c: ChildContract) => !!c.endDate && c.endDate < today;
  const active = children.filter((c) => !hasLeft(c) && matches(c));
  const archived = children.filter(c => hasLeft(c) && matches(c));

  const card = (c: ChildContract, i: number, archivedCard = false) => (
    <div key={c.id} className={`child-card${"child" in sheet && sheet.child.id === c.id ? " selected" : ""}${archivedCard ? " archived" : ""}`}>
      <button className="card-tap" onClick={() => choose({ mode: "edit", child: c })}>
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
      <button className="card-action" aria-label={`Diary for ${c.name}`} title="Diary" onClick={() => choose({ mode: "diary", child: c })}>
        <IconDiary />
      </button>
      <button
        className="card-action"
        aria-label={`Invoices for ${c.name}`}
        onClick={() => choose({ mode: "invoices", child: c })}
      >
        <IconInvoices />
      </button>
    </div>
  );

  return (
    <div className="workspace children-workspace">
      <section className="workspace-list" aria-label="Children list">
      <label className="desktop-search">Find a child<input type="search" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {!!search && !active.length && !archived.length && <p className="hint">No children match this name.</p>}
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
        <button className="btn-primary" onClick={() => choose({ mode: "new" })}>
          + Add child
        </button>
      )}
      {!loading && children.length === 0 && (
        <button className="btn-quiet" onClick={() => addDemoChildren()}>
          Or add two demo children to see it working
        </button>
      )}

      </section>
      <WorkspaceDetail
        open={sheet.mode !== "closed"}
        title={
          sheet.mode === "new"
            ? "Add child"
            : sheet.mode === "diary"
              ? `${sheet.child.name} — diary`
            : sheet.mode === "invoices"
              ? `${sheet.child.name} — invoices`
              : sheet.mode === "edit"
                ? sheet.child.name
                : ""
        }
        onClose={() => choose({ mode: "closed" })}
      >
        {"child" in sheet && <div className="desktop-detail-tabs" role="group" aria-label="Child sections">{(["edit", "diary", "invoices"] as const).map(mode => <button key={mode} className={`chip${sheet.mode === mode ? " on" : ""}`} aria-pressed={sheet.mode === mode} onClick={() => { if (sheet.mode !== mode) choose({ mode, child: sheet.child }); }}>{mode === "edit" ? "Contract" : mode === "diary" ? "Diary" : "Invoices"}</button>)}</div>}
        {sheet.mode === "new" && (
          <ChildForm key="new" existing={null} onDone={() => setSheet({ mode: "closed" })} />
        )}
        {sheet.mode === "edit" && (
          <ChildForm key={sheet.child.id} existing={sheet.child} onDone={() => setSheet({ mode: "closed" })} />
        )}
        {sheet.mode === "invoices" && <InvoiceHistory key={sheet.child.id} child={sheet.child} />}
        {sheet.mode === "diary" && <ChildDiary key={sheet.child.id} child={sheet.child} />}
      </WorkspaceDetail>
    </div>
  );
}
