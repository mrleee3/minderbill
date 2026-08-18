import { useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import { Today } from "./screens/Today";
import { Month } from "./screens/Month";
import { Children } from "./screens/Children";
import { Invoices } from "./screens/Invoices";
import { Settings } from "./screens/Settings";
import { todayISO } from "./lib/dates";

type Tab = "today" | "month" | "invoices" | "children" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "☀️" },
  { id: "month", label: "Month", icon: "🗓️" },
  { id: "invoices", label: "Invoices", icon: "📄" },
  { id: "children", label: "Children", icon: "🧒" },
  { id: "settings", label: "Settings", icon: "⚙️" },
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
  return (
    <>
      <UpdateBanner />
      <header className="app-header">
        <h1 className="app-title">
          Minder<span className="bill">Bill</span>
        </h1>
        <span className="build-id">{__BUILD_ID__}</span>
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
              <span className="icon">{t.icon}</span>
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
