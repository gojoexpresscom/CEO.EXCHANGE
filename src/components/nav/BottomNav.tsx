import type { CSSProperties } from "react";
import type { NavPage } from "../../lib/types";

type Props = {
  active: NavPage;
  onNavigate: (page: NavPage) => void;
};

const items: { id: NavPage; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "markets", label: "Markets", icon: "chart" },
  { id: "trade", label: "Trade", icon: "trade" },
  { id: "earn", label: "TradFi", icon: "earn" },
  { id: "assets", label: "Assets", icon: "wallet" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#f5b51b" : "#888";
  const common = {
    width: 22,
    height: 22,
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-5" />
          <path d="M12 16V8" />
          <path d="M16 16v-3" />
        </svg>
      );
    case "trade":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </svg>
      );
    case "earn":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8" />
          <path d="M9.5 10.5c.5-1 1.5-1.5 2.5-1.5s2 .7 2 1.8c0 2.2-4 1.2-4 3.4 0 1 .9 1.8 2 1.8s2-.5 2.5-1.4" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 7h15a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
          <path d="M3 9h16" />
          <path d="M16 14h.01" />
        </svg>
      );
    default:
      return null;
  }
}

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav style={styles.nav} aria-label="Primary">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            style={{
              ...styles.item,
              color: isActive ? "#f5b51b" : "#888",
            }}
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <NavIcon name={item.icon} active={isActive} />
            <span style={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, CSSProperties> = {
  nav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-around",
    padding: "6px 4px calc(6px + env(safe-area-inset-bottom, 0px))",
    background: "rgba(8,8,8,0.96)",
    borderTop: "1px solid #1a1a1a",
    backdropFilter: "blur(12px)",
  },
  item: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 48,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.02em",
  },
};
