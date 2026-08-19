import { useEffect, useState } from "react";

// Checks version.json (stamped by CI) ~20s after launch, on foreground,
// and every 5 minutes. Cache-busted so the CDN edge can't serve a stale copy.
// Shows a red Restart pill when a newer build is live.

async function fetchLiveBuild(): Promise<string | null> {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { build?: string };
    return j.build ?? null;
  } catch {
    return null;
  }
}

export function UpdateBanner() {
  const [liveBuild, setLiveBuild] = useState<string | null>(null);

  useEffect(() => {
    if (__BUILD_ID__ === "dev") return;
    let disposed = false;
    const check = async () => {
      const b = await fetchLiveBuild();
      if (!disposed && b && b !== __BUILD_ID__) setLiveBuild(b);
    };
    const t = setTimeout(check, 20_000);
    const i = setInterval(check, 5 * 60_000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      disposed = true;
      clearTimeout(t);
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!liveBuild) return null;

  const restart = () => {
    const u = new URL(location.href);
    u.searchParams.set("v", liveBuild);
    // reload() rather than replace(): a same-document navigation is what
    // leaves iOS holding the previous viewport metrics.
    history.replaceState(null, "", u.toString());
    location.reload();
  };

  return (
    <button className="update-pill" onClick={restart}>
      New version — Restart
    </button>
  );
}
