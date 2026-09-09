import type { CareEntry } from "../db";

const TOILETING = ["Wet nappy", "Dirty nappy", "Wet + dirty nappy", "Potty", "Toilet", "Accident"];
const FOOD = ["Breakfast", "Lunch", "Dinner", "Snack"];
const DRINKS = ["Water", "Milk", "Other drink"];

export function CareNotes({ entries, onChange }: { entries: CareEntry[]; onChange: (entries: CareEntry[]) => void }) {
  const add = (kind: CareEntry["kind"], label: string) => {
    const now = new Date();
    onChange([...entries, {
      id: crypto.randomUUID(), kind, label,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    }]);
  };
  const update = (id: string, change: Partial<CareEntry>) =>
    onChange(entries.map(entry => entry.id === id ? { ...entry, ...change } : entry));

  return (
    <section className="care-notes" aria-label="Daily care notes">
      <div className="form-section">Toileting & nappies</div>
      <div className="chip-row care-shortcuts">
        {TOILETING.map(label => <button type="button" className="chip" key={label} onClick={() => add("toileting", label)}>+ {label}</button>)}
      </div>
      <div className="form-section">Food & drink</div>
      <div className="chip-row care-shortcuts">
        {FOOD.map(label => <button type="button" className="chip" key={label} onClick={() => add("food", label)}>+ {label}</button>)}
        {DRINKS.map(label => <button type="button" className="chip" key={label} onClick={() => add("drink", label)}>+ {label}</button>)}
      </div>
      <p className="hint">Tap to add an entry. Adjust the time or add details below, then Save.</p>
      <div className="care-entries" aria-live="polite">
        {entries.map(entry => (
          <div className="care-entry" key={entry.id}>
            <div className="care-entry-head">
              <strong>{entry.label}</strong>
              <input type="time" aria-label={`Time for ${entry.label}`} value={entry.time} onChange={e => update(entry.id, { time: e.target.value })} />
              <button type="button" className="care-remove" aria-label={`Remove ${entry.label} at ${entry.time}`} onClick={() => onChange(entries.filter(e => e.id !== entry.id))}>✕</button>
            </div>
            {entry.kind === "food" && (
              <label className="field">
                <span>How much eaten?</span>
                <select value={entry.eaten ?? ""} onChange={e => update(entry.id, { eaten: e.target.value as CareEntry["eaten"] || undefined })}>
                  <option value="">Not recorded</option>
                  <option value="all">All</option><option value="most">Most</option>
                  <option value="some">Some</option><option value="none">None</option>
                </select>
              </label>
            )}
            {entry.kind === "drink" && (
              <label className="field">
                <span>Amount drunk (ml, optional)</span>
                <input type="number" min="0" step="1" inputMode="numeric" value={entry.amountMl ?? ""} placeholder="e.g. 120" onChange={e => update(entry.id, { amountMl: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value))) })} />
              </label>
            )}
            <label className="field">
              <span>Details (optional)</span>
              <input value={entry.details ?? ""} onChange={e => update(entry.id, { details: e.target.value })} placeholder={entry.kind === "food" ? "e.g. pasta and peas" : entry.kind === "toileting" ? "e.g. used potty independently" : "e.g. offered a cup with lunch"} />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
