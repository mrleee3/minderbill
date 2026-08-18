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
import { addDemoChildren, removeDemoData } from "../lib/demo";
import { todayISO } from "../lib/dates";
import { academicYearOf } from "../lib/terms";

export function Settings() {
  const [biz, setBiz] = useState<Business>(DEFAULT_BUSINESS);
  const [blocks, setBlocks] = useState<TermBlock[]>([]);
  const [savedTick, setSavedTick] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getBusiness().then(setBiz);
    getTermBlocks().then(setBlocks);
  }, []);

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
    } catch {
      setMsg("That file couldn't be read as a MinderBill backup.");
    }
  }

  return (
    <div className="form">
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

      <div className="form-section">Funded term dates</div>
      <p className="hint">
        Prefilled from Surrey school term dates for 2025/26 and 2026/27 (the 2026/27 year has a
        two-week October half term).
        Funded hours only apply on days inside these blocks. Check them against Surrey's Early
        Years Funded Dates calendar — INSET days are not funded.
      </p>
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
      <p className="hint">
        Academic year {ay.label}: <strong>{fundedCount} funded weeks</strong> (LA standard is 38).
      </p>

      <div className="form-section">Backup</div>
      <p className="hint">
        Everything lives only on this phone — export a backup regularly and keep it somewhere safe.
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
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
