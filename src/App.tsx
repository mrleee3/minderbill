import { useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import {
  IconChildren,
  IconInvoices,
  IconMonth,
  IconSettings,
  IconToday,
} from "./components/Icons";
import { Today } from "./screens/Today";
import { Month } from "./screens/Month";
import { Children } from "./screens/Children";
import { Invoices } from "./screens/Invoices";
import { Settings } from "./screens/Settings";
import { todayISO } from "./lib/dates";
import { useEffect } from "react";

type Tab = "today" | "month" | "invoices" | "children" | "settings";

const TABS: { id: Tab; label: string; Icon: (p: { active?: boolean }) => JSX.Element }[] = [
  { id: "today", label: "Today", Icon: IconToday },
  { id: "month", label: "Month", Icon: IconMonth },
  { id: "invoices", label: "Invoices", Icon: IconInvoices },
  { id: "children", label: "Children", Icon: IconChildren },
  { id: "settings", label: "Settings", Icon: IconSettings },
];


function Screen({
  tab,
  date,
  setDate,
}: {
  tab: Tab;
  date: string;
  setDate: (iso: string) => void;
}) {
  switch (tab) {
    case "today":
      return <Today date={date} setDate={setDate} />;
    case "month":
      return <Month />;
    case "invoices":
      return <Invoices />;
    case "children":
      return <Children />;
    case "settings":
      return <Settings />;
  }
}

function ViewportDebug() {
  const [info, setInfo] = useState("");
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;height:env(safe-area-inset-bottom,0px);width:0;visibility:hidden";
    document.body.appendChild(probe);
    const read = () => {
      const sab = probe.getBoundingClientRect().height;
      setInfo(
        `ih ${window.innerHeight} · ce ${document.documentElement.clientHeight} · ` +
          `sh ${screen.height} · vv ${Math.round(visualViewport?.height ?? 0)} · ` +
          `sab ${Math.round(sab)} · ` +
          `standalone ${(navigator as any).standalone ?? matchMedia("(display-mode: standalone)").matches}`
      );
    };
    read();
    const t = setInterval(read, 2000);
    return () => {
      clearInterval(t);
      probe.remove();
    };
  }, []);
  return <span className="debug-line hours">{info}</span>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(todayISO());
  const [debug, setDebug] = useState(false);
  return (
    <>
      <UpdateBanner />
      <header className="app-header">
        <h1 className="app-title">
          Minder<span className="bill">Bill</span>
        </h1>
        <button className="build-id" onClick={() => setDebug((d) => !d)}>
          {__BUILD_ID__}
        </button>
        {debug && <ViewportDebug />}
      </header>
      <main className="screen">
        <Screen tab={tab} date={date} setDate={setDate} />
      </main>
      <div id="print-root" aria-hidden="true" />
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="icon-wrap">
              <t.Icon active={tab === t.id} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
