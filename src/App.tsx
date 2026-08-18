import { useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import { Today } from "./screens/Today";
import { Month } from "./screens/Month";
import { Children } from "./screens/Children";
import { todayISO } from "./lib/dates";

type Tab = "today" | "month" | "invoices" | "children" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "☀️" },
  { id: "month", label: "Month", icon: "🗓️" },
  { id: "invoices", label: "Invoices", icon: "📄" },
  { id: "children", label: "Children", icon: "🧒" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

function Empty({ glyph, title, hint }: { glyph: string; title: string; hint: string }) {
  return (
    <div className="empty">
      <span className="glyph">{glyph}</span>
      <p><strong>{title}</strong></p>
      <p>{hint}</p>
    </div>
  );
}

function Screen({
  tab,
  date,
  setDate,
  onPickDay,
}: {
  tab: Tab;
  date: string;
  setDate: (iso: string) => void;
  onPickDay: (iso: string) => void;
}) {
  switch (tab) {
    case "today":
      return <Today date={date} setDate={setDate} />;
    case "month":
      return <Month date={date} setDate={setDate} onPickDay={onPickDay} />;
    case "invoices":
      return (
        <Empty
          glyph="📄"
          title="No invoices yet"
          hint="At the start of each month, generate itemised invoices for the month just gone — funded hours, top-ups and private hours all shown clearly."
        />
      );
    case "children":
      return <Children />;
    case "settings":
      return (
        <Empty
          glyph="⚙️"
          title="Settings"
          hint="Term dates, your business details, invoice footer and backups will be managed here."
        />
      );
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
        <Screen
          tab={tab}
          date={date}
          setDate={setDate}
          onPickDay={(iso) => {
            setDate(iso);
            setTab("today");
          }}
        />
      </main>
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
