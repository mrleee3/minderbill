import { useEffect, useRef, useState } from "react";

const A4_WIDTH_PX = 794; // 210mm at 96dpi

/**
 * Renders the invoice at true A4 and scales it to fit the available width,
 * so what's on screen is exactly the printed page.
 */
export function A4Preview({ html }: { html: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.42);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / A4_WIDTH_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="a4-frame" ref={frame}>
      <div
        className="a4-page"
        style={{ "--a4-scale": scale } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
