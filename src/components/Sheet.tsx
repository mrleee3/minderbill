import { type ReactNode, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { shouldDismissSheet } from "../lib/sheetGesture";

export function Sheet({ open, title, onClose, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const lastContent = useRef({ title, children });
  const close = useRef(onClose);
  const gesture = useRef<{ id: number; start: number; last: number; at: number; velocity: number; distance: number } | null>(null);
  close.current = onClose;
  // Preserve the full form while its parent clears the selection on Save/Close.
  useLayoutEffect(() => { if (open) lastContent.current = { title, children }; });
  useLayoutEffect(() => {
    let frame = 0, secondFrame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    gesture.current = null;
    setDragging(false);
    setOffset(0);
    if (open) {
      setMounted(true);
      frame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setActive(true));
      });
    } else {
      setActive(false);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      timer = setTimeout(() => setMounted(false), reduced ? 0 : 280);
    }
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); clearTimeout(timer); };
  }, [open]);

  const present = open || mounted;
  useEffect(() => {
    if (!present) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("sheet-open");
    };
  }, [present]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!open || !event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, start: event.clientY, last: event.clientY, at: event.timeStamp, velocity: 0, distance: 0 };
    setDragging(true);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    g.velocity = (event.clientY - g.last) / Math.max(1, event.timeStamp - g.at);
    g.last = event.clientY; g.at = event.timeStamp;
    g.distance = Math.max(0, event.clientY - g.start);
    setOffset(g.distance);
  }
  function endDrag(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    const velocity = event.timeStamp - g.at < 100 ? g.velocity : 0;
    if (!cancelled && shouldDismissSheet(g.distance, velocity, sheet.current?.offsetHeight ?? 600)) {
      close.current();
    } else setOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  if (!present) return null;
  const content = open ? { title, children } : lastContent.current;
  return createPortal(
    <div className={`sheet-overlay${active ? " is-open" : ""}`} onClick={() => { if (open) close.current(); }}>
      <div ref={sheet} className={`sheet${dragging ? " is-dragging" : ""}`} role="dialog" aria-modal="true" aria-label={content.title}
        style={{ transform: active ? `translateY(${offset}px)` : "translateY(100%)" }} onClick={event => event.stopPropagation()}>
        <div className="sheet-drag-area" onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={event => endDrag(event)} onPointerCancel={event => endDrag(event, true)}
          onLostPointerCapture={event => endDrag(event, true)}>
          <div className="sheet-grabber" aria-hidden="true" />
          <div className="sheet-head">
            <span className="sheet-title">{content.title}</span>
            <button type="button" className="sheet-close" onClick={() => close.current()} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="sheet-body">{content.children}</div>
      </div>
    </div>, document.body
  );
}
