import { useEffect, useState, type CSSProperties } from "react";
import { WorkspaceProvider, useWorkspaceNavigation } from "./components/Workspace";
import { UpdateBanner } from "./components/UpdateBanner";
import { DebugPanel, debugEnabled } from "./components/DebugPanel";
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
import { todayISO, fmtDateLong } from "./lib/dates";
import { findUnconfirmed } from "./lib/confirm";
import { useLiveQuery } from "dexie-react-hooks";

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
  openDay,
}: {
  tab: Tab;
  date: string;
  setDate: (iso: string) => void;
  openDay: (iso: string) => void;
}) {
  switch (tab) {
    case "today":
      return <Today date={date} setDate={setDate} />;
    case "month":
      return <Month onOpenDay={openDay} />;
    case "invoices":
      return <Invoices />;
    case "children":
      return <Children />;
    case "settings":
      return <Settings />;
  }
}

export default function App() { return <WorkspaceProvider><AppWorkspace /></WorkspaceProvider>; }

function AppWorkspace() {
  const canLeave = useWorkspaceNavigation();
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(todayISO());
  const pending = useLiveQuery(() => findUnconfirmed(), []) ?? [];
  const [dismissed, setDismissed] = useState(false);

  // Body is the scroller now — start each tab at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const openOldest = () => {
    const oldest = pending[pending.length - 1];
    if (!oldest) return;
    if (!canLeave()) return;
    setDate(oldest);
    setTab("today");
  };

  return (
    <>
      <UpdateBanner />
      {debugEnabled() && <DebugPanel />}
      <header className="app-header">
        <h1 className="app-title">
          Minder<span className="bill">Bill</span>
        </h1>
        <span className="build-id">{__BUILD_ID__}</span>
      </header>
      {pending.length > 0 && !dismissed && tab !== "today" && (
        <button className="nudge" onClick={openOldest}>
          <span>
            <strong>
              {pending.length} day{pending.length > 1 ? "s" : ""} to confirm
            </strong>
            <span className="hint">
              Oldest: {fmtDateLong(pending[pending.length - 1])}
            </span>
          </span>
          <span
            className="nudge-x"
            role="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
          >
            ✕
          </span>
        </button>
      )}

      <main className={`screen screen-${tab}`}>
        <div className="desktop-heading"><h2>{TABS.find(t => t.id === tab)?.label}</h2><span>{tab === "today" ? "Attendance and daily care" : tab === "children" ? "Contracts, diaries and invoices" : tab === "invoices" ? "Review, generate and manage payments" : tab === "month" ? "Plan and review attendance" : "Business and preferences"}</span></div>
        <Screen tab={tab} date={date} setDate={setDate} openDay={iso => { if (canLeave()) { setDate(iso); setTab("today"); } }} />
      </main>
      <div id="print-root" aria-hidden="true" />
      <nav
        className="tabbar"
        style={{ "--tab-index": TABS.findIndex((t) => t.id === tab) } as CSSProperties}
      >
        <span className="tab-indicator" aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " active" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => { if (tab !== t.id && canLeave()) setTab(t.id); }}
          >
            <span className="icon-wrap">
              <t.Icon active={tab === t.id} />
              {t.id === "today" && pending.length > 0 && (
                <span className="tab-badge">{pending.length > 9 ? "9+" : pending.length}</span>
              )}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
