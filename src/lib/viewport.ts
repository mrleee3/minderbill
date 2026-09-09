/** Apple Home Screen web clips do not always match display-mode: standalone. */
export function isHomeScreen(mediaStandalone: boolean, appleStandalone?: boolean): boolean {
  return mediaStandalone || appleStandalone === true;
}

export interface ViewportMetrics {
  homeScreen: boolean;
  iphone: boolean;
  screenHeight: number;
  viewportHeight: number;
  scale: number;
  offsetTop: number;
  safeTop: number;
  safeBottom: number;
}

/**
 * Work around an iPhone Home Screen viewport missing a system-inset-sized
 * strip. Screen dimensions are unzoomed CSS pixels; viewport dimensions are
 * in page CSS pixels. Never apply this to browser tabs, a keyboard-sized
 * reduction, a panned viewport or a page zoomed in by the user.
 */
export function correctedViewportBottom(m: ViewportMetrics): number | null {
  if (!m.homeScreen || !m.iphone || !Number.isFinite(m.scale) ||
      m.scale <= 0 || m.scale > 1 || Math.abs(m.offsetTop) > 1) return null;
  const missing = m.screenHeight - m.viewportHeight * m.scale;
  const insetBudget = m.safeTop + m.safeBottom;
  if (!Number.isFinite(missing) || missing <= 1 || missing > insetBudget + 1) return null;
  return m.screenHeight / m.scale;
}

export function installViewportCorrection(): () => void {
  const root = document.documentElement;
  const media = window.matchMedia("(display-mode: standalone)");
  const vv = window.visualViewport;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  let frame = 0;
  const update = () => {
    frame = 0;
    const insets = getComputedStyle(probe);
    // Older iPhones keep screen dimensions in portrait coordinates.
    const angle = window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
    const landscape = Math.abs(angle) % 180 === 90;
    const height = landscape
      ? Math.min(screen.width, screen.height)
      : Math.max(screen.width, screen.height);
    const bottom = correctedViewportBottom({
      homeScreen: isHomeScreen(media.matches, (navigator as Navigator & { standalone?: boolean }).standalone),
      iphone: /iPhone|iPod/.test(navigator.userAgent),
      screenHeight: height,
      viewportHeight: vv?.height ?? innerHeight,
      scale: vv?.scale ?? 1,
      offsetTop: vv?.offsetTop ?? 0,
      safeTop: parseFloat(insets.paddingTop) || 0,
      safeBottom: parseFloat(insets.paddingBottom) || 0,
    });
    if (bottom === null) {
      root.removeAttribute("data-viewport-corrected");
      root.style.removeProperty("--tab-viewport-bottom");
    } else {
      root.style.setProperty("--tab-viewport-bottom", `${bottom}px`);
      root.setAttribute("data-viewport-corrected", "");
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const targets: [EventTarget, string][] = [
    [window, "resize"], [window, "orientationchange"], [window, "pageshow"],
    [document, "visibilitychange"], [document, "focusin"], [document, "focusout"],
    [media, "change"],
  ];
  if (vv) targets.push([vv, "resize"], [vv, "scroll"]);
  targets.forEach(([target, event]) => target.addEventListener(event, schedule));
  // iOS can settle the initial viewport after the first paint without resize.
  const timers = [100, 500, 1000].map(ms => window.setTimeout(schedule, ms));
  update();
  return () => {
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    targets.forEach(([target, event]) => target.removeEventListener(event, schedule));
    probe.remove();
    root.removeAttribute("data-viewport-corrected");
    root.style.removeProperty("--tab-viewport-bottom");
  };
}
