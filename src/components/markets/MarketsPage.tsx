import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { useMarketsData } from "../../hooks/useMarketsData";
import BottomNav from "../nav/BottomNav";
import {
  formatPct,
  formatPrice,
  formatVolume,
  iconUrl,
} from "../../lib/format";
import type { NavPage } from "../../lib/types";

type Props = {
  onTrade: (symbol: string) => void;
  onNavigate: (page: NavPage) => void;
};

type Category =
  | "Overview"
  | "Favorites"
  | "Spot"
  | "New"
  | "Gainers"
  | "Losers"
  | "Volume";

type SortKey = "symbol" | "price" | "change" | "volume";

const QUOTES = ["All", "USDT", "USDC", "BTC", "ETH"] as const;

export default function MarketsPage({ onTrade, onNavigate }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("Spot");
  const [quote, setQuote] = useState<(typeof QUOTES)[number]>("USDT");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { markets, loading, error, toggleFavorite, refresh } =
    useMarketsData(userId);

  const filtered = useMemo(() => {
    let list = [...markets];

    if (category === "Favorites") {
      list = list.filter((m) => m.isFavorite);
    } else if (category === "New") {
      list = list
        .filter((m) => m.listed_at)
        .sort(
          (a, b) =>
            new Date(b.listed_at || 0).getTime() -
            new Date(a.listed_at || 0).getTime()
        )
        .slice(0, 50);
    } else if (category === "Gainers") {
      list = list
        .filter((m) => m.change_24h != null && m.change_24h > 0)
        .sort((a, b) => (b.change_24h || 0) - (a.change_24h || 0));
    } else if (category === "Losers") {
      list = list
        .filter((m) => m.change_24h != null && m.change_24h < 0)
        .sort((a, b) => (a.change_24h || 0) - (b.change_24h || 0));
    } else if (category === "Volume") {
      list = list.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
    }

    if (quote !== "All") {
      list = list.filter(
        (m) => (m.quote_asset || "").toUpperCase() === quote
      );
    }

    const q = search.trim().toUpperCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.symbol.includes(q) ||
          (m.base_asset || "").includes(q) ||
          (m.base_name || "").toUpperCase().includes(q)
      );
    }

    // Secondary sort when not using category-specific order
    if (
      category === "Spot" ||
      category === "Overview" ||
      category === "Favorites"
    ) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
        else if (sortKey === "price")
          cmp = (a.last_price || 0) - (b.last_price || 0);
        else if (sortKey === "change")
          cmp = (a.change_24h || 0) - (b.change_24h || 0);
        else cmp = (a.volume_24h || 0) - (b.volume_24h || 0);
        return sortAsc ? cmp : -cmp;
      });
    }

    return list;
  }, [markets, category, quote, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Markets</h1>
        <button type="button" style={styles.refreshBtn} onClick={refresh}>
          Refresh
        </button>
      </header>

      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>⌕</span>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pairs"
          aria-label="Search markets"
        />
        {search && (
          <button
            type="button"
            style={styles.clearBtn}
            onClick={() => setSearch("")}
          >
            ×
          </button>
        )}
      </div>

      <div style={styles.catRow}>
        {(
          [
            "Overview",
            "Favorites",
            "Spot",
            "New",
            "Gainers",
            "Losers",
            "Volume",
          ] as Category[]
        ).map((c) => (
          <button
            key={c}
            type="button"
            style={{
              ...styles.catChip,
              ...(category === c ? styles.catChipActive : {}),
            }}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={styles.quoteRow}>
        {QUOTES.map((q) => (
          <button
            key={q}
            type="button"
            style={{
              ...styles.quoteChip,
              ...(quote === q ? styles.quoteChipActive : {}),
            }}
            onClick={() => setQuote(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div style={styles.colHeader}>
        <button type="button" style={styles.colBtn} onClick={() => toggleSort("symbol")}>
          Pair {sortKey === "symbol" ? (sortAsc ? "↑" : "↓") : ""}
        </button>
        <button type="button" style={styles.colBtn} onClick={() => toggleSort("price")}>
          Price {sortKey === "price" ? (sortAsc ? "↑" : "↓") : ""}
        </button>
        <button type="button" style={styles.colBtn} onClick={() => toggleSort("change")}>
          24h {sortKey === "change" ? (sortAsc ? "↑" : "↓") : ""}
        </button>
      </div>

      {error && (
        <div style={styles.errorBar}>
          {error}
          <button type="button" style={styles.retry} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {loading && !markets.length ? (
        <div style={styles.empty}>Loading markets…</div>
      ) : !filtered.length ? (
        <div style={styles.empty}>
          {category === "Favorites"
            ? "No favorites yet. Tap the star on any pair."
            : "No markets match your filters."}
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map((m) => {
            const up = (m.change_24h ?? 0) >= 0;
            return (
              <div
                key={m.symbol}
                role="button"
                tabIndex={0}
                style={styles.row}
                onClick={() => onTrade(m.symbol)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTrade(m.symbol);
                  }
                }}
              >
                <button
                  type="button"
                  style={styles.star}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFavorite(m.symbol);
                  }}
                  aria-label={m.isFavorite ? "Unfavorite" : "Favorite"}
                >
                  {m.isFavorite ? "★" : "☆"}
                </button>
                <img
                  src={iconUrl(m.base_asset)}
                  alt=""
                  width={28}
                  height={28}
                  style={styles.icon}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <div style={styles.pairInfo}>
                  <span style={styles.pairSym}>
                    {m.base_asset}
                    <span style={styles.pairQuote}>/{m.quote_asset}</span>
                  </span>
                  <span style={styles.pairVol}>
                    {formatVolume(m.volume_24h)} {m.quote_asset}
                  </span>
                </div>
                <div style={styles.priceCol}>
                  <span style={styles.price}>{formatPrice(m.last_price)}</span>
                  <span
                    style={{
                      ...styles.change,
                      background: up
                        ? "rgba(34,197,94,0.15)"
                        : "rgba(239,68,68,0.15)",
                      color: up ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {formatPct(m.change_24h)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ height: 72 }} />
      <BottomNav active="markets" onNavigate={onNavigate} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    color: "#eee",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    paddingBottom: 8,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 8px",
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  refreshBtn: {
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#c9a227",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  searchWrap: {
    margin: "4px 16px 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#121212",
    border: "1px solid #1f1f1f",
    borderRadius: 12,
    padding: "0 12px",
    minHeight: 42,
  },
  searchIcon: { color: "#666", fontSize: 16 },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: 14,
    minHeight: 40,
  },
  clearBtn: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 18,
    cursor: "pointer",
  },
  catRow: {
    display: "flex",
    gap: 6,
    padding: "0 12px 8px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  catChip: {
    flexShrink: 0,
    border: "none",
    background: "transparent",
    color: "#888",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  catChipActive: {
    color: "#f5b51b",
    background: "rgba(245,181,27,0.1)",
  },
  quoteRow: {
    display: "flex",
    gap: 6,
    padding: "0 16px 10px",
    overflowX: "auto",
  },
  quoteChip: {
    flexShrink: 0,
    border: "1px solid #1f1f1f",
    background: "#0d0d0d",
    color: "#aaa",
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 16,
    cursor: "pointer",
  },
  quoteChipActive: {
    borderColor: "#2a2110",
    color: "#f5b51b",
    background: "rgba(245,181,27,0.08)",
  },
  colHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 16px 8px",
    color: "#666",
    fontSize: 11,
  },
  colBtn: {
    background: "transparent",
    border: "none",
    color: "#666",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  list: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #111",
    color: "#eee",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  },
  star: {
    background: "transparent",
    border: "none",
    color: "#c9a227",
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    width: 22,
  },
  icon: {
    borderRadius: "50%",
    background: "#1a1a1a",
    flexShrink: 0,
  },
  pairInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  pairSym: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },
  pairQuote: {
    color: "#888",
    fontWeight: 500,
  },
  pairVol: {
    fontSize: 11,
    color: "#666",
  },
  priceCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    fontVariantNumeric: "tabular-nums",
  },
  change: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    minWidth: 58,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  empty: {
    padding: "40px 24px",
    textAlign: "center",
    color: "#777",
    fontSize: 14,
  },
  errorBar: {
    margin: "8px 16px",
    padding: "10px 12px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10,
    color: "#fca5a5",
    fontSize: 13,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  retry: {
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#f5b51b",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
};
          
