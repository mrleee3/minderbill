export type View = { scale: number; x: number; y: number };
export type Point = { x: number; y: number };
export function zoomAt(view: View, scale: number, from: Point, to = from): View {
  const next = Math.max(1, Math.min(4, scale));
  const ratio = next / view.scale;
  return { scale: next, x: to.x - (from.x - view.x) * ratio, y: to.y - (from.y - view.y) * ratio };
}
export function boundView(view: View, width: number, height: number, pageWidth: number, pageHeight: number): View {
  const w = pageWidth * view.scale, h = pageHeight * view.scale;
  return { ...view, x: w <= width ? (width - w) / 2 : Math.min(0, Math.max(width - w, view.x)),
    y: h <= height ? 12 : Math.min(12, Math.max(height - h - 12, view.y)) };
}
