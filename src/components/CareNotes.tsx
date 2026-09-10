import { useState } from "react";
import type { CareEntry } from "../db";
import { careEntryText } from "../lib/diary";
import { CareEntryEditor } from "./CareEntryEditor";

const TOILETING = ["Wet nappy", "Dirty nappy", "Wet + dirty nappy", "Potty", "Toilet", "Accident"];
const FOOD = ["Breakfast", "Lunch", "Dinner", "Snack"];
const DRINKS = ["Water", "Milk", "Other drink"];

export function CareNotes({ entries, onChange }: { entries: CareEntry[]; onChange: (entries: CareEntry[]) => void }) {
  const [editing, setEditing] = useState<{ entry: CareEntry; isNew: boolean } | null>(null);
  const add = (kind: CareEntry["kind"], label: string) => {
    const now = new Date();
    setEditing({ isNew: true, entry: {
      id: crypto.randomUUID(), kind, label,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    } });
  };

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
      <p className="hint">Tap an activity to add details. Save the day when finished.</p>
      <div className="care-entries" aria-live="polite">
        {entries.map(entry => {
          const details = careEntryText(entry).slice(entry.label.length).replace(/^ · /, "");
          return <div className="care-entry" key={entry.id}>
            <div className="care-entry-summary">
              <div className="care-entry-heading"><time>{entry.time}</time><strong>{entry.label}</strong></div>
              {details && <p title={details}>{details}</p>}
            </div>
            <button type="button" className="care-edit" aria-label={`Edit ${entry.label} at ${entry.time}`} onClick={() => setEditing({ entry, isNew: false })}>Edit</button>
          </div>;
        })}
      </div>
      {editing && <CareEntryEditor key={editing.entry.id} entry={editing.entry} isNew={editing.isNew}
        onClose={() => setEditing(null)}
        onSave={entry => {
          onChange(editing.isNew ? [...entries, entry] : entries.map(old => old.id === entry.id ? entry : old));
          setEditing(null);
        }}
        onRemove={() => { onChange(entries.filter(entry => entry.id !== editing.entry.id)); setEditing(null); }}
      />}
    </section>
  );
}
