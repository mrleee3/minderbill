import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { boundView, zoomAt, type Point, type View } from "../lib/invoiceZoom";

/** Zoom only the document: never alter the app's viewport or browser scale. */
export function InvoiceViewer({ html, onClose }: { html: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1, fit: 1, pageHeight: 1123 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 12 });
  const points = useRef(new Map<number, Point>());
  const gesture = useRef<{ view: View; centre: Point; distance: number } | null>(null);
  const current = useRef(view); current.current = view;
  const limit = (v: View) => boundView(v, size.width, size.height, 794 * size.fit, size.pageHeight * size.fit);

  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement;
    el.showModal();
    closeButton.current?.focus({ preventScroll: true });
    document.body.classList.add("invoice-viewer-open");
    const measure = () => {
      const width = stage.current!.clientWidth, height = stage.current!.clientHeight;
      const fit = Math.min(1, Math.max(1, width - 24) / 794);
      const pageHeight = Math.max(1123, page.current!.offsetHeight);
      setSize({ width, height, fit, pageHeight });
      setView(boundView({ scale: 1, x: 0, y: 12 }, width, height, 794 * fit, pageHeight * fit));
      points.current.clear(); gesture.current = null;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current!); observer.observe(page.current!); measure();
    return () => {
      observer.disconnect(); el.close(); document.body.classList.remove("invoice-viewer-open");
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  function geometry() {
    const [a, b] = [...points.current.values()];
    return b ? { centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) }
      : { centre: a, distance: 0 };
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || points.current.size >= 2) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    points.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    gesture.current = { view: current.current, ...geometry() };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.has(event.pointerId) || !gesture.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    points.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    const now = geometry(), base = gesture.current;
    const scale = base.distance > 0 ? base.view.scale * now.distance / base.distance : base.view.scale;
    const next = limit(zoomAt(base.view, scale, base.centre, now.centre));
    current.current = next; setView(next);
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    points.current.delete(event.pointerId);
    gesture.current = points.current.size ? { view: current.current, ...geometry() } : null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function zoom(scale: number) {
    setView(v => limit(zoomAt(v, scale, { x: size.width / 2, y: size.height / 2 })));
  }
  return createPortal(<dialog ref={dialog} className="invoice-viewer" aria-label="Full-screen invoice"
    onCancel={e => { e.preventDefault(); onClose(); }}
    onKeyDown={e => { e.stopPropagation(); }} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}
    onTouchEnd={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <div className="invoice-viewer-toolbar">
      <strong>Invoice</strong>
      <div className="invoice-zoom-controls">
        <button type="button" aria-label="Zoom out" disabled={view.scale <= 1} onClick={() => zoom(view.scale - .5)}>−</button>
        <button type="button" onClick={() => setView(limit({ scale: 1, x: 0, y: 12 }))}>Fit</button>
        <button type="button" aria-label="Zoom in" disabled={view.scale >= 4} onClick={() => zoom(view.scale + .5)}>+</button>
      </div>
      <button ref={closeButton} type="button" onClick={onClose} aria-label="Close invoice">Done</button>
    </div>
    <p className="invoice-viewer-hint">Pinch to zoom · Drag to move</p>
    <div ref={stage} className="invoice-viewer-stage" onPointerDown={start} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onWheel={e => { setView(v => limit({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })); }}>
      <div ref={page} className="a4-page invoice-viewer-page" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${size.fit * view.scale})` }}
        dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  </dialog>, document.body);
}
