import type { CareEntry } from "../db";

export function CareIcon({ kind }: { kind: CareEntry["kind"] }) {
  return <span className={`care-icon care-${kind}`} aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === "toileting" ? <><path d="M4 6h16v5c0 5-4 9-8 9s-8-4-8-9V6Z"/><path d="M4 9h16M4 13c4 0 6 3 6 7M20 13c-4 0-6 3-6 7"/></>
        : kind === "food" ? <><path d="M4 3v6c0 3 6 3 6 0V3M7 3v18M19 21V3c-4 2-5 7-4 10h4"/></>
        : <><path d="M5 7h14l-2 14H7L5 7ZM13 7l2-4h4M6 12h12"/></>}
    </svg>
  </span>;
}
