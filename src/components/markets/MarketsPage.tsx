import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { useMarketsData } from "../../hooks/useMarketsData";
import BottomNav from "../nav/BottomNav";
import MarketIcon from "./MarketIcon";
import { formatPct, formatPrice, formatVolume } from "../../lib/format";
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
  | "Volume"
  | "All";

const CATEGORIES: Category[] = [
  "Overview",
  "Favorites",
  "Spot",
  "New",
  "Gainers",
  "Losers",
  "Volume",
  "All",
];

const QUOTES = ["USDT", "USDC", "BTC", "ETH"] as const;

export default function MarketsPage({ onTrade, onNavigate }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("Spot");
  const [quote, setQuote] = useState<(typeof QUOTES)[number] | "All">("USDT");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname,profile_picture_url")
          .eq("id", uid)
          .maybeSingle();
        if (!alive) return;
        setNickname(profile?.nickname ?? null);
        setAvatarUrl(profile?.profile_picture_url ?? null);
      }
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

    // Quote filter
    if (quote !== "All") {
      list = list.filter(
        (m) => m.quote_asset.toUpperCase() === quote.toUpperCase()
      );
    }

    // Category
    if (category === "Favorites") {
      list = list.filter((m) => m.isFavorite);
    } else if (category === "New") {
      list = list
        .filter((m) => m.listed_at)
        .sort(
          (a, b) =>
            new Date(b.listed_at || 0).getTime() -
            new Date(a.listed_at || 0).getTime()
        );
    } else if (category === "Gainers") {
      list = list
        .filter((m) => m.change_24h != null && m.change_24h > 0)
        .sort((a, b) => (b.change_24h ?? 0) - (a.change_24h ?? 0));
    } else if (category === "Losers") {
      list = list
        .filter((m) => m.change_24h != null && m.change_24h < 0)
        .sort((a, b) => (a.change_24h ?? 0) - (b.change_24h ?? 0));
    } else if (category === "Volume" || category === "Overview") {
      list = list
        .filter((m) => m.volume_24h != null)
        .sort((a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0));
    } else if (category === "Spot" || category === "All") {
      // spot = all active pairs in trading_pairs (this list is already spot)
      list = list.sort((a, b) =>
        a.symbol.localeCompare(b.symbol)
      );
    }

    // Search across base, quote, full pair
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    if (q) {
      list = list.filter((m) => {
        const base = m.base_asset.toLowerCase();
        const quoteA = m.quote_asset.toLowerCase();
        const pair = `${base}/${quoteA}`;
        const compact = `${base}${quoteA}`;
        const sym = m.symbol.toLowerCase().replace(/\s+/g, "");
        return (
          base.includes(q) ||
          quoteA.includes(q) ||
          pair.includes(q) ||
          compact.includes(q) ||
          sym.includes(q)
        );
      });
    }

    return list;
  }, [markets, category, quote, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const initial =
    (nickname || "U").trim().charAt(0).toUpperCase() || "U";

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={styles.avatar}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div style={styles.avatarFallback}>{initial}</div>
          )}
          <h1 style={styles.title}>Markets</h1>
        </div>
        <button
          type="button"
          style={styles.refreshBtn}
          onClick={() => void onRefresh()}
          disabled={refreshing || loading}
        >
          {refreshing ? "…" : "Refresh"}
        </button>
      </header>

      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>⌕</span>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pairs"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {search ? (
          <button
            type="button"
            style={styles.clearSearch}
            onClick={() => setSearch("")}
          >
            ×
          </button>
        ) : null}
      </div>

      <div style={styles.tabs}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            style={{
              ...styles.tab,
              ...(category === c ? styles.tabActive : {}),
            }}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={styles.quotes}>
        {(["All", ...QUOTES] as const).map((q) => (
          <button
            key={q}
            type="button"
            style={{
              ...styles.quoteChip,
              ...(quote === q ? styles.quoteActive : {}),
            }}
            onClick={() => setQuote(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div style={styles.colHead}>
        <span style={styles.colPair}>Pair</span>
        <span style={styles.colPrice}>Price</span>
        <span style={styles.colChg}>24h</span>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <div>Unable to load market data</div>
          <div style={styles.errorDetail}>{error}</div>
          <button type="button" style={styles.retry} onClick={() => void onRefresh()}>
            Retry
          </button>
        </div>
      )}

      {loading && !markets.length && (
        <div style={styles.skeletonWrap}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={styles.skeletonRow} />
          ))}
        </div>
      )}

      {!loading && !error && !filtered.length && (
        <div style={styles.empty}>
          {search ? "No markets found" : "No markets match this filter"}
        </div>
      )}

      <div style={styles.list}>
        {filtered.map((m) => {
          const up = (m.change_24h ?? 0) >= 0;
          const hasPrice = m.last_price != null;
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

              <MarketIcon symbol={m.base_asset} size={32} />

              <div style={styles.pairInfo}>
                <span style={styles.pairSym}>
                  {m.base_asset}
                  <span style={styles.pairQuote}>/{m.quote_asset}</span>
                </span>
                <span style={styles.pairVol}>
                  {m.volume_24h != null
                    ? `${formatVolume(m.volume_24h)} ${m.quote_asset}`
                    : hasPrice
                      ? " "
                      : "No live data"}
                </span>
              </div>

              <div style={styles.priceCol}>
                <span style={styles.price}>
                  {hasPrice ? formatPrice(m.last_price) : "—"}
                </span>
                <span
                  style={{
                    ...styles.change,
                    background: !hasPrice
                      ? "rgba(120,120,120,0.15)"
                      : up
                        ? "rgba(34,197,94,0.15)"
                        : "rgba(239,68,68,0.15)",
                    color: !hasPrice
                      ? "#888"
                      : up
                        ? "#22c55e"
                        : "#ef4444",
                  }}
                >
                  {hasPrice ? formatPct(m.change_24h) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

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
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #2a2110",
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#1a1a1a",
    border: "1px solid #2a2110",
    color: "#c9a227",
    fontWeight: 800,
    fontSize: 13,
    display: "grid",
    placeItems: "center",
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
    minWidth: 0,
  },
  clearSearch: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  tabs: {
    display: "flex",
    gap: 4,
    padding: "0 12px 8px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    flexShrink: 0,
    background: "transparent",
    border: "none",
    color: "#777",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  tabActive: {
    color: "#f5b51b",
    background: "rgba(245,181,27,0.1)",
  },
  quotes: {
    display: "flex",
    gap: 6,
    padding: "0 16px 10px",
    overflowX: "auto",
  },
  quoteChip: {
    flexShrink: 0,
    background: "#141414",
    border: "1px solid #1f1f1f",
    color: "#999",
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: 20,
    cursor: "pointer",
  },
  quoteActive: {
    color: "#111",
    background: "#f5b51b",
    borderColor: "#f5b51b",
  },
  colHead: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 72px",
    gap: 8,
    padding: "4px 16px 6px 52px",
    fontSize: 11,
    color: "#666",
    fontWeight: 600,
  },
  colPair: {},
  colPrice: { textAlign: "right" },
  colChg: { textAlign: "right" },
  list: { padding: "0 8px" },
  row: {
    display: "grid",
    gridTemplateColumns: "28px 32px 1fr 90px",
    alignItems: "center",
    gap: 8,
    padding: "10px 8px",
    borderBottom: "1px solid #121212",
    cursor: "pointer",
  },
  star: {
    background: "transparent",
    border: "none",
    color: "#c9a227",
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  pairInfo: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  pairSym: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  pairQuote: { color: "#888", fontWeight: 600 },
  pairVol: {
    fontSize: 11,
    color: "#666",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  priceCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    fontVariantNumeric: "tabular-nums",
  },
  change: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 6,
    fontVariantNumeric: "tabular-nums",
  },
  empty: {
    padding: 32,
    textAlign: "center",
    color: "#666",
    fontSize: 13,
  },
  errorBox: {
    margin: "8px 16px",
    padding: 14,
    borderRadius: 12,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center",
  },
  errorDetail: { fontSize: 11, color: "#999", marginTop: 6 },
  retry: {
    marginTop: 10,
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#f5b51b",
    borderRadius: 8,
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  skeletonWrap: { padding: "0 16px" },
  skeletonRow: {
    height: 52,
    marginBottom: 8,
    borderRadius: 10,
    background:
      "linear-gradient(90deg, #121212 25%, #1a1a1a 50%, #121212 75%)",
    backgroundSize: "200% 100%",
  },
};
        
