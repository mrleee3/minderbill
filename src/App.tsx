import { useState, type CSSProperties } from "react";
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
import { todayISO, fmtDateLong } from "./lib/dates";
import { useEffect } from "react";
import { findUnconfirmed } from "./lib/confirm";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

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

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(todayISO());
  const [pending, setPending] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  // Recheck whenever logs or confirmations change, so the nudge clears the
  // moment she confirms.
  const stamp = useLiveQuery(
    async () => `${await db.confirms.count()}-${await db.dayLogs.count()}-${await db.children.count()}`,
    []
  );
  useEffect(() => {
    findUnconfirmed().then(setPending);
  }, [stamp]);

  const openOldest = () => {
    const oldest = pending[pending.length - 1];
    if (!oldest) return;
    setDate(oldest);
    setTab("today");
  };

  return (
    <>
      <UpdateBanner />
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

      <main className="screen">
        <Screen tab={tab} date={date} setDate={setDate} />
      </main>
      <div id="print-root" aria-hidden="true" />
      <nav className="tabbar" style={{ "--tab-index": TABS.findIndex((t) => t.id === tab) } as CSSProperties}>
        <span className="tab-indicator" aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
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
