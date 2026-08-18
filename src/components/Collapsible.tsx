import { useState, type ReactNode } from "react";

/** Collapsible block for long lists that are usually left alone. */
export function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapse-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="collapse-title">
          {title}
          {count != null && <span className="collapse-count">{count}</span>}
        </span>
        <span className={`chev${open ? " open" : ""}`} aria-hidden="true">›</span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  );
}
