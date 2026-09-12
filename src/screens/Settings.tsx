import { useEffect, useState } from "react";
import { db } from "../db";
import type { TermBlock } from "../data/surrey";
import { SURREY_TERMS_2025_26, SURREY_TERMS_2026_27, SURREY_TERMS_ALL } from "../data/surrey";
import {
  DEFAULT_BUSINESS,
  getBusiness,
  getTermBlocks,
  setBusiness,
  setTermBlocks,
  type Business,
} from "../lib/settings";
import { fundedWeeksBetween } from "../lib/terms";
import {
  CLOSURE_COLOURS,
  UK_BANK_HOLIDAYS,
  type Closure,
} from "../data/closures";
import { getClosures, setClosures as saveClosures } from "../lib/settings";
import { HolidayEditor } from "../components/HolidayEditor";
import { Collapsible } from "../components/Collapsible";
import { fmtDateLong } from "../lib/dates";
import { debugEnabled, setDebugEnabled } from "../components/DebugPanel";
import { addDemoChildren, removeDemoData } from "../lib/demo";
import { todayISO } from "../lib/dates";
import { academicYearOf } from "../lib/terms";

export function Settings() {
  const [biz, setBiz] = useState<Business>(DEFAULT_BUSINESS);
  const [blocks, setBlocks] = useState<TermBlock[]>([]);
  const [savedTick, setSavedTick] = useState(false);
  const [closures, setClosureList] = useState<Closure[]>([]);
  const [holiday, setHoliday] = useState<Closure | "new" | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getBusiness().then(setBiz);
    getTermBlocks().then(setBlocks);
    getClosures().then(setClosureList);
  }, []);

  async function persistClosures(next: Closure[]) {
    const sorted = [...next].sort((a, b) => a.start.localeCompare(b.start));
    await saveClosures(sorted);
    setClosureList(sorted);
  }

  const bizField = (key: keyof Business, label: string, placeholder = "") => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input
        value={(biz[key] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => setBiz((b) => ({ ...b, [key]: e.target.value }))}
      />
    </label>
  );

  async function saveBiz() {
    await setBusiness(biz);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  }

  async function saveBlocks(next: TermBlock[]) {
    setBlocks(next);
    await setTermBlocks(next);
  }

  const ay = academicYearOf(todayISO());
  const fundedCount = blocks.length
    ? fundedWeeksBetween(ay.start, ay.end, blocks)
    : 0;

  async function exportBackup() {
    const data = {
      exportedAt: new Date().toISOString(),
      children: await db.children.toArray(),
      dayLogs: await db.dayLogs.toArray(),
      invoices: await db.invoices.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const file = new File([blob], `minderbill-backup-${todayISO()}.json`, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "MinderBill backup" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  async function importBackup(f: File) {
    try {
      const data = JSON.parse(await f.text());
      if (!confirm("Restore this backup? It replaces everything currently in the app.")) return;
      await db.transaction("rw", db.children, db.dayLogs, db.invoices, db.settings, async () => {
        await Promise.all([db.children.clear(), db.dayLogs.clear(), db.invoices.clear(), db.settings.clear()]);
        await db.children.bulkAdd(data.children ?? []);
        await db.dayLogs.bulkAdd(data.dayLogs ?? []);
        await db.invoices.bulkAdd(data.invoices ?? []);
        await db.settings.bulkAdd(data.settings ?? []);
      });
      setMsg("Backup restored.");
      getBusiness().then(setBiz);
      getTermBlocks().then(setBlocks);
      getClosures().then(setClosureList);
    } catch {
      setMsg("That file couldn't be read as a MinderBill backup.");
    }
  }

  return (
    <div className="form settings-categories">
      <p className="hint">Manage your business, time off and app data.</p>
      <details className="settings-category" open>
        <summary><span>Holidays & closures</span><small>Your time off and bank holidays</small></summary>
        <div className="form settings-category-body">
      <p className="hint">
        Days you're closed. Every child's planned day becomes that absence automatically and is
        charged by their own policy — you can still override one child on the day itself.
      </p>
      <button className="btn-primary" onClick={() => setHoliday("new")}>+ Add holiday / closure</button>
      {(() => {
        const row = (c: Closure) => (
          <div key={c.id} className="closure-row">
            <i className="swatch" style={{ background: CLOSURE_COLOURS[c.kind] }} />
            <span className="closure-main">
              <span className="closure-label">{c.label}</span>
              <span className="hint">
                {c.start === c.end
                  ? fmtDateLong(c.start)
                  : `${fmtDateLong(c.start)} \u2013 ${fmtDateLong(c.end)}`}
              </span>
            </span>
            <button className="btn-quiet closure-edit" aria-label={`Edit ${c.label}`} onClick={() => setHoliday(c)}>Edit</button>
            <button
              className="sheet-close"
              aria-label={`Remove ${c.label}`}
              onClick={() => { if (confirm(`Remove ${c.label}? These days will use the usual attendance plan again.`)) void persistClosures(closures.filter((x) => x.id !== c.id)); }}
            >
              ✕
            </button>
          </div>
        );
        const mine = closures.filter((c) => c.kind === "minderHoliday");
        const bankAll = closures.filter((c) => c.kind === "bankHoliday");
        const today = todayISO();
        const bankUpcoming = bankAll.filter((c) => c.end >= today);
        const bankPast = bankAll.filter((c) => c.end < today);
        return (
          <>
            <Collapsible title="My holidays" count={mine.length} defaultOpen>
              {mine.length === 0 ? (
                <p className="hint">None yet — add your first closure above.</p>
              ) : (
                mine.map(row)
              )}
            </Collapsible>
            <Collapsible title="Bank holidays" count={bankAll.length}>
              {bankUpcoming.map(row)}
              {bankPast.length > 0 && (
                <Collapsible title="Earlier" count={bankPast.length}>
                  {bankPast.map(row)}
                </Collapsible>
              )}
              <button
                className="btn-quiet"
                onClick={() =>
                  persistClosures([
                    ...closures.filter((c) => c.kind !== "bankHoliday"),
                    ...UK_BANK_HOLIDAYS,
                  ])
                }
              >
                Reset UK bank holidays
              </button>
            </Collapsible>
          </>
        );
      })()}

        </div>
      </details>
      <details className="settings-category">
        <summary><span>Business & payment</span><small>Details shown on your invoices</small></summary>
        <div className="form settings-category-body">
      <div className="form-section">Business details (shown on invoices)</div>
      <div className="field-row">
        {bizField("name", "Business name")}
        {bizField("tagline", "Tagline")}
      </div>
      <div className="field-row">
        {bizField("ownerName", "Your name")}
        {bizField("ofstedReg", "Ofsted reg. no.")}
      </div>
      <div className="field-row">
        {bizField("email", "Email")}
        {bizField("phone", "Phone")}
      </div>
      <div className="form-section">Payment details (invoice footer)</div>
      {bizField("bankName", "Account name")}
      <div className="field-row">
        {bizField("sortCode", "Sort code", "00-00-00")}
        {bizField("accountNo", "Account number")}
      </div>
      {bizField("paymentNote", "Extra payment note", "e.g. Please pay within 7 days")}
      <button className="btn-primary" onClick={saveBiz}>{savedTick ? "Saved ✓" : "Save details"}</button>

        </div>
      </details>
      <details className="settings-category">
        <summary><span>Funding & term dates</span><small>Funded weeks and school terms</small></summary>
        <div className="form settings-category-body">
      <p className="hint">
        Prefilled from Surrey school term dates for 2025/26 and 2026/27 (the 2026/27 year has a
        two-week October half term).
        Funded hours only apply on days inside these blocks. Check them against Surrey's Early
        Years Funded Dates calendar — INSET days are not funded.
      </p>
      <Collapsible title="Term blocks" count={blocks.length}>
        {blocks.map((b, i) => (
          <div key={i} className="term-row">
            <input
              type="date"
              value={b.start}
              onChange={(e) => saveBlocks(blocks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
            />
            <span className="dash">–</span>
            <input
              type="date"
              value={b.end}
              onChange={(e) => saveBlocks(blocks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
            />
            <button
              className="sheet-close"
              aria-label={`Remove ${b.label}`}
              onClick={() => saveBlocks(blocks.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn-quiet"
          onClick={() => saveBlocks([...blocks, { start: todayISO(), end: todayISO(), label: "Custom" }])}
        >
          + Add term block
        </button>
        <div className="field-row">
          <button className="btn-quiet" onClick={() => saveBlocks(SURREY_TERMS_ALL)}>
            Reset to Surrey (both years)
          </button>
          <button className="btn-quiet" onClick={() => saveBlocks(SURREY_TERMS_2025_26)}>
            2025/26 only
          </button>
          <button className="btn-quiet" onClick={() => saveBlocks(SURREY_TERMS_2026_27)}>
            2026/27 only
          </button>
        </div>
      </Collapsible>
      <p className="hint">
        Academic year {ay.label}: <strong>{fundedCount} funded weeks</strong> (LA standard is 38).
      </p>

        </div>
      </details>
      <details className="settings-category">
        <summary><span>Backup & app tools</span><small>Backups, demo data and diagnostics</small></summary>
        <div className="form settings-category-body">
      <div className="form-section">Backup</div>
      <p className="hint">
        Everything lives only on this device — export a backup regularly and keep it somewhere safe.
      </p>
      <button className="btn-primary" onClick={exportBackup}>Export backup</button>
      <label className="btn-quiet file-btn">
        Restore from backup
        <input
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
        />
      </label>

      <div className="form-section">Diagnostics</div>
      <p className="hint">
        Temporary — shows live layout measurements over the app so we can pin down the tab bar
        issue. Turn it on, then reload with the update banner and screenshot the panel.
      </p>
      <label className="check-row">
        <input
          type="checkbox"
          defaultChecked={debugEnabled()}
          onChange={(e) => {
            setDebugEnabled(e.target.checked);
            location.reload();
          }}
        />
        <span>Show layout diagnostics</span>
      </label>

      <div className="form-section">Demo data</div>
      <button className="btn-quiet" onClick={() => addDemoChildren().then(() => setMsg("Demo children added."))}>
        Add demo children
      </button>
      <button
        className="btn-danger"
        onClick={() => removeDemoData().then((n) => setMsg(n ? `Removed ${n} demo children and their logs.` : "No demo data found."))}
      >
        Remove all demo data
      </button>
        </div>
      </details>
      {msg && <p className="hint" role="status">{msg}</p>}
      {holiday && <HolidayEditor closure={holiday === "new" ? undefined : holiday}
        onClose={() => setHoliday(null)} onSave={c => persistClosures([...closures.filter(x => x.id !== c.id), c])} />}
    </div>
  );
}
