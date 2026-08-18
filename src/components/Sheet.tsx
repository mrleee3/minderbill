import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  // Rendered into document.body, NOT inside .screen. iOS treats a scrolling
  // container (overflow + -webkit-overflow-scrolling) as its own stacking
  // context, so a fixed overlay inside it can never paint above the fixed
  // tab bar no matter how high its z-index is.
  return createPortal(
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
