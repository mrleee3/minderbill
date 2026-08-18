import { useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";

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

function Screen({ tab }: { tab: Tab }) {
  switch (tab) {
    case "today":
      return (
        <Empty
          glyph="☀️"
          title="Nothing to log yet"
          hint="Add your children and their usual weekly hours, and each day will be pre-filled here — you'll only ever tap the exceptions."
        />
      );
    case "month":
      return (
        <Empty
          glyph="🗓️"
          title="Month view"
          hint="A colour-coded grid of every child's days — attended, adjusted, absences and funded weeks — will live here."
        />
      );
    case "invoices":
      return (
        <Empty
          glyph="📄"
          title="No invoices yet"
          hint="At the start of each month, generate itemised invoices for the month just gone — funded hours, top-ups and private hours all shown clearly."
        />
      );
    case "children":
      return (
        <Empty
          glyph="🧒"
          title="No children yet"
          hint="Each child gets a contract: hourly rate, usual weekly schedule, funded hours and charging policies."
        />
      );
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
        <Screen tab={tab} />
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
