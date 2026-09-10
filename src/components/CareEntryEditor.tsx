import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CareIcon } from "./CareIcon";
import type { CareEntry } from "../db";

export function CareEntryEditor({ entry, isNew, onSave, onClose, onRemove }: {
  entry: CareEntry;
  isNew: boolean;
  onSave: (entry: CareEntry) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState({ ...entry });
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const update = (change: Partial<CareEntry>) => setDraft(old => ({ ...old, ...change }));
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    heading.current?.setAttribute("autofocus", "");
    element.showModal();
    // Keep the editor visible without opening the iPhone keyboard on arrival.
    heading.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={dialog} className="care-dialog" aria-labelledby={titleId}
      onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <form className="form" onSubmit={event => { event.preventDefault(); if (valid) onSave(draft); }}>
        <h2 id={titleId} ref={heading} tabIndex={-1}><CareIcon kind={entry.kind} />{isNew ? "Add" : "Edit"} {entry.label.toLowerCase()}</h2>
        <label className="field">
          <span>Time</span>
          <input type="time" required value={draft.time} onChange={event => update({ time: event.target.value })} />
        </label>
        {draft.kind === "food" && <label className="field">
          <span>How much eaten?</span>
          <select value={draft.eaten ?? ""} onChange={event => update({ eaten: event.target.value as CareEntry["eaten"] || undefined })}>
            <option value="">Not recorded</option>
            <option value="all">All</option><option value="most">Most</option>
            <option value="some">Some</option><option value="none">None</option>
          </select>
        </label>}
        {draft.kind === "drink" && <label className="field">
          <span>Amount drunk (ml, optional)</span>
          <input type="number" min="0" step="1" inputMode="numeric" value={draft.amountMl ?? ""} placeholder="e.g. 120"
            onChange={event => update({ amountMl: event.target.value === "" ? undefined : Number(event.target.value) })} />
        </label>}
        <label className="field">
          <span>Details (optional)</span>
          <textarea rows={2} value={draft.details ?? ""} onChange={event => update({ details: event.target.value })}
            placeholder={draft.kind === "food" ? "e.g. pasta and peas" : draft.kind === "toileting" ? "e.g. used potty independently" : "e.g. offered a cup with lunch"} />
        </label>
        {!valid && <p className="hint warn">Enter a time for this entry.</p>}
        <div className="care-dialog-actions">
          <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!valid}>{isNew ? "Add entry" : "Save changes"}</button>
        </div>
        {!isNew && <button type="button" className="btn-quiet care-delete" onClick={onRemove}>Remove entry</button>}
      </form>
    </dialog>, document.body
  );
}
