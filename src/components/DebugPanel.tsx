import { useEffect, useState } from "react";

/**
 * Temporary diagnostics for the floating tab bar. Persisted in localStorage
 * so it survives a reload — the bug only shows immediately after one, so the
 * panel has to be on screen at that moment.
 *
 * The decisive number is `gap`: the distance between the bottom of the tab
 * bar and what the browser claims is the bottom of the viewport.
 *   gap ≈ 0 but a visible gap on screen  → the viewport height is under-reported
 *   gap > 0                              → the bar is genuinely mispositioned
 */
export const DEBUG_KEY = "mb.debug";

export function debugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDebugEnabled(on: boolean) {
  try {
    localStorage.setItem(DEBUG_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

interface Sample {
  t: number;
  ih: number;
  ch: number;
  sh: number;
  vvH: number;
  vvTop: number;
  vvScale: number;
  sab: number;
  barTop: number;
  barBottom: number;
  gap: number;
  scrollY: number;
  docH: number;
}

function sample(): Sample | null {
  const bar = document.querySelector<HTMLElement>(".tabbar");
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  const vv = window.visualViewport;

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;height:env(safe-area-inset-bottom,0px);width:0;visibility:hidden";
  document.body.appendChild(probe);
  const sab = probe.getBoundingClientRect().height;
  probe.remove();

  return {
    t: Math.round(performance.now()),
    ih: window.innerHeight,
    ch: document.documentElement.clientHeight,
    sh: window.screen.height,
    vvH: Math.round(vv?.height ?? 0),
    vvTop: Math.round(vv?.offsetTop ?? 0),
    vvScale: Number((vv?.scale ?? 1).toFixed(2)),
    sab: Math.round(sab),
    barTop: Math.round(r.top),
    barBottom: Math.round(r.bottom),
    gap: Math.round(window.innerHeight - r.bottom),
    scrollY: Math.round(window.scrollY),
    docH: Math.round(document.documentElement.scrollHeight),
  };
}

export function DebugPanel() {
  const [live, setLive] = useState<Sample | null>(null);
  const [trail, setTrail] = useState<Sample[]>([]);

  useEffect(() => {
    // Snapshot the first two seconds after load — that's the window in which
    // the bar settles (or fails to).
    const marks = [0, 60, 200, 500, 1000, 2000];
    const timers = marks.map((ms) =>
      window.setTimeout(() => {
        const s = sample();
        if (s) setTrail((prev) => [...prev, s]);
      }, ms)
    );
    const tick = window.setInterval(() => setLive(sample()), 500);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, []);

  if (!live) return null;

  const mode = window.matchMedia("(display-mode: standalone)").matches
    ? "standalone"
    : "browser";

  const copy = () => {
    const text = JSON.stringify({ build: __BUILD_ID__, mode, live, trail }, null, 1);
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="debug-panel">
      <div className="debug-row">
        <strong>{__BUILD_ID__}</strong> · {mode} · sab {live.sab}
        <button onClick={copy}>copy</button>
        <button
          onClick={() => {
            setDebugEnabled(false);
            location.reload();
          }}
        >
          off
        </button>
      </div>
      <div className={`debug-gap${live.gap !== 0 ? " bad" : ""}`}>
        GAP {live.gap}px · bar {live.barTop}–{live.barBottom}
      </div>
      <div className="debug-row">
        ih {live.ih} · ch {live.ch} · sh {live.sh}
      </div>
      <div className="debug-row">
        vv {live.vvH} @{live.vvTop} ×{live.vvScale} · scrollY {live.scrollY} · doc {live.docH}
      </div>
      <div className="debug-trail">
        {trail.map((s) => (
          <span key={s.t}>
            {s.t}ms ih{s.ih} vv{s.vvH} bar{s.barBottom} gap{s.gap}
          </span>
        ))}
      </div>
    </div>
  );
}
