import { useRef, type TouchEvent } from "react";

/**
 * Horizontal swipe detection for month/invoice paging. Ignores gestures that
 * are mostly vertical so page scrolling still works normally.
 */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      if (dx < 0) onLeft();
      else onRight();
    },
  };
}
