// Custom flat iOS-style icons: 24px grid, 1.7px strokes, round caps/joins,
// single accent fill for the "active" state. Drawn for this app rather than
// pulled from a set — each one names its screen literally (a sun for the
// day, a grid for the month, a document for invoices, figures for children,
// sliders for settings).

type IconProps = { active?: boolean };

const S = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconToday({ active }: IconProps) {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="4.2" fill={active ? "currentColor" : "none"} opacity={active ? 0.18 : 1} />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.2v1.9M12 18.9v1.9M20.8 12h-1.9M5.1 12H3.2M18.2 5.8l-1.35 1.35M7.15 16.85 5.8 18.2M18.2 18.2l-1.35-1.35M7.15 7.15 5.8 5.8" />
    </svg>
  );
}

export function IconMonth({ active }: IconProps) {
  return (
    <svg {...S}>
      <rect x="3.2" y="5" width="17.6" height="15.8" rx="3.4" />
      <path d="M3.2 9.6h17.6M8.2 3.2v3.6M15.8 3.2v3.6" />
      <rect x="7" y="12.6" width="3.1" height="3.1" rx="1" fill="currentColor" opacity={active ? 1 : 0.35} stroke="none" />
      <rect x="13.9" y="12.6" width="3.1" height="3.1" rx="1" fill="currentColor" opacity={active ? 0.5 : 0.18} stroke="none" />
    </svg>
  );
}

export function IconInvoices({ active }: IconProps) {
  return (
    <svg {...S}>
      <path d="M5.6 3.4h9.1l4.7 4.7v12.5H5.6z" fill={active ? "currentColor" : "none"} opacity={active ? 0.13 : 1} />
      <path d="M5.6 3.4h9.1l4.7 4.7v12.5H5.6z" />
      <path d="M14.4 3.6v4.6h4.7" />
      <path d="M8.9 12.4h6.2M8.9 15.7h6.2M8.9 19h3.4" />
    </svg>
  );
}

export function IconChildren({ active }: IconProps) {
  return (
    <svg {...S}>
      <circle cx="9.6" cy="8.4" r="3.5" fill={active ? "currentColor" : "none"} opacity={active ? 0.16 : 1} />
      <circle cx="9.6" cy="8.4" r="3.5" />
      <path d="M3.4 20.4c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6" />
      <circle cx="17.3" cy="10.2" r="2.5" />
      <path d="M17.3 15.1c2.1 0 3.5 1.6 3.5 3.6" />
    </svg>
  );
}

export function IconSettings({ active }: IconProps) {
  return (
    <svg {...S}>
      <path d="M4 7.4h9.4M17.9 7.4h2.1M4 16.6h2.6M11.1 16.6h8.9" />
      <circle cx="15.7" cy="7.4" r="2.4" fill={active ? "currentColor" : "none"} opacity={active ? 0.18 : 1} />
      <circle cx="15.7" cy="7.4" r="2.4" />
      <circle cx="8.8" cy="16.6" r="2.4" fill={active ? "currentColor" : "none"} opacity={active ? 0.18 : 1} />
      <circle cx="8.8" cy="16.6" r="2.4" />
    </svg>
  );
}
