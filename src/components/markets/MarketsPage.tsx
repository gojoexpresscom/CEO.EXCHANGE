import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { useMarketsData, type MarketRow } from "../../hooks/useMarketsData";
import BottomNav from "../nav/BottomNav";
import MarketIcon from "./MarketIcon";
import { formatPct, formatPrice, formatVolume } from "../../lib/format";
import { sessionBadgeLabel, sessionStatusLabel } from "../../lib/marketSession";
import type { NavPage } from "../../lib/types";

type Props = {
  onTrade: (symbol: string) => void;
  onNavigate: (page: NavPage) => void;
};

/** Primary top-level categories (video structure) */
type Primary = "Watchlist" | "Crypto" | "TradFi" | "Alpha";

/** Market type row */
type MarketType =
  | "Spot"
  | "Perpetual"
  | "Expiry"
  | "Options"
  | "Arbitrage";

/** Sort / activity filters */
type SortFilter =
  | "Hot"
  | "New"
  | "Gainer"
  | "Loser"
  | "Sol Eco"
  | "Volume";

const PRIMARIES: Primary[] = ["Watchlist", "Crypto", "TradFi", "Alpha"];
const MARKET_TYPES: MarketType[] = [
  "Spot",
  "Perpetual",
  "Expiry",
  "Options",
  "Arbitrage",
];
const SORT_FILTERS: SortFilter[] = [
  "Hot",
  "New",
  "Gainer",
  "Loser",
  "Sol Eco",
  "Volume",
];
const QUOTES = ["USDT", "USDC", "BTC", "ETH"] as const;

export default function MarketsPage({ onTrade, onNavigate }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [primary, setPrimary] = useState<Primary>("Crypto");
  const [marketType, setMarketType] = useState<MarketType>("Spot");
  const [sortFilter, setSortFilter] = useState<SortFilter>("Hot");
  const [quote, setQuote] = useState<(typeof QUOTES)[number] | "All">("USDT");

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const {
    spotMarkets,
    perpetualMarkets,
    loading,
    error,
    toggleFavorite,
    refresh,
  } = useMarketsData(userId);

  const emptyReason = useMemo((): string | null => {
    // TradFi catalog not connected yet — not the same as "Market Closed"
    if (primary === "TradFi") return "No TradFi markets available yet";
    if (primary === "Alpha") return "No Alpha markets available yet";
    if (primary === "Crypto") {
      // Crypto/Bybit is 24/7 — never show a weekend freeze message here
      if (marketType === "Expiry") return "Expiry markets coming soon";
      if (marketType === "Options") return "Options markets coming soon";
      if (marketType === "Arbitrage") return "Arbitrage markets coming soon";
    }
    return null;
  }, [primary, marketType]);

  const filtered = useMemo(() => {
    if (emptyReason) return [] as MarketRow[];

    let list: MarketRow[] = [];

    if (primary === "Watchlist") {
      const all = [...spotMarkets, ...perpetualMarkets];
      list = all.filter((m) => m.isFavorite);
    } else if (primary === "Crypto") {
      if (marketType === "Spot") {
        list = spotMarkets.filter(
          (m) => m.market_type === "spot" || m.kind === "spot"
        );
      } else if (marketType === "Perpetual") {
        list = perpetualMarkets.length
          ? perpetualMarkets
          : spotMarkets.filter((m) => m.market_type === "perpetual");
      } else {
        list = [];
      }
    }

    if (quote !== "All") {
      list = list.filter(
        (m) => m.quote_asset.toUpperCase() === quote.toUpperCase()
      );
    }

    const q = search.trim().toUpperCase().replace(/\s+/g, "");
    if (q) {
      list = list.filter((m) => {
        const sym = `${m.base_asset}/${m.quote_asset}`.toUpperCase();
        const compact = `${m.base_asset}${m.quote_asset}`.toUpperCase();
        return (
          m.base_asset.toUpperCase().includes(q) ||
          m.quote_asset.toUpperCase().includes(q) ||
          m.symbol.toUpperCase().includes(q) ||
          sym.includes(q) ||
          compact.includes(q)
        );
      });
    }

    if (sortFilter === "Gainer") {
      list = list
        .filter((m) => m.change_24h != null && m.change_24h > 0)
        .sort((a, b) => (b.change_24h ?? 0) - (a.change_24h ?? 0));
    } else if (sortFilter === "Loser") {
      list = list
        .filter((m) => m.change_24h != null && m.change_24h < 0)
        .sort((a, b) => (a.change_24h ?? 0) - (b.change_24h ?? 0));
    } else if (sortFilter === "Volume") {
      list = [...list].sort(
        (a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0)
      );
    } else if (sortFilter === "Hot") {
      list = [...list].sort((a, b) => {
        const score = (m: MarketRow) =>
          (m.volume_24h ?? 0) * Math.abs(m.change_24h ?? 0);
        return score(b) - score(a);
      });
    } else if (sortFilter === "New") {
      const withDate = list.filter((m) => m.listed_at);
      if (withDate.length) {
        list = withDate.sort(
          (a, b) =>
            new Date(b.listed_at || 0).getTime() -
            new Date(a.listed_at || 0).getTime()
        );
      }
    } else if (sortFilter === "Sol Eco") {
      list = list.filter((m) => {
        const cat = (m.market_category || "").toLowerCase();
        const base = m.base_asset.toUpperCase();
        const quoteA = m.quote_asset.toUpperCase();
        const sym = m.symbol.toUpperCase();
        return (
          base === "SOL" ||
          quoteA === "SOL" ||
          sym.includes("SOL") ||
          cat.includes("sol")
        );
      });
    }

    return list;
  }, [
    emptyReason,
    primary,
    marketType,
    quote,
    search,
    sortFilter,
    spotMarkets,
    perpetualMarkets,
  ]);

  const showTypeRow = primary === "Crypto";
  const showSortRow = primary === "Crypto" || primary === "Watchlist";

  return (
    <div style={styles.page}>
      <style>{`
        .ceo-pair-row {
          opacity: 0;
          transform: translateY(6px);
          animation: ceoPairFadeIn 0.35s ease forwards;
          animation-delay: calc(var(--pair-index, 0) * 50ms);
        }
        @keyframes ceoPairFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ceo-pair-row {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `}</style>

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
        {PRIMARIES.map((c) => (
          <button
            key={c}
            type="button"
            style={{
              ...styles.tab,
              ...(primary === c ? styles.tabActive : {}),
            }}
            onClick={() => setPrimary(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {showTypeRow && (
        <div style={styles.typeRow}>
          {MARKET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              style={{
                ...styles.typeChip,
                ...(marketType === t ? styles.typeActive : {}),
              }}
              onClick={() => setMarketType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {showSortRow && (
        <div style={styles.filterRow}>
          <div style={styles.sortRow}>
            {SORT_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                style={{
                  ...styles.sortChip,
                  ...(sortFilter === f ? styles.sortActive : {}),
                }}
                onClick={() => setSortFilter(f)}
              >
                {f}
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
        </div>
      )}

      {!emptyReason && (
        <div style={styles.colHead}>
          <span style={styles.colPair}>Pair</span>
          <span style={styles.colPrice}>Price</span>
          <span style={styles.colChg}>24h</span>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <div>Unable to load market data</div>
          <div style={styles.errorDetail}>{error}</div>
          <button
            type="button"
            style={styles.retry}
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !spotMarkets.length && !perpetualMarkets.length && (
        <div style={styles.skeletonWrap}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={styles.skeletonRow} />
          ))}
        </div>
      )}

      {!loading && !error && emptyReason && (
        <div style={styles.empty}>
          <div style={styles.emptyTitle}>{emptyReason}</div>
          <div style={styles.emptyHint}>
            Categories stay available for the planned CEO EXCHANGE market
            structure. No placeholder data is shown.
          </div>
        </div>
      )}

      {!loading && !error && !emptyReason && !filtered.length && (
        <div style={styles.empty}>
          {primary === "Watchlist"
            ? userId
              ? "No favorites yet — tap ★ on a pair to add it"
              : "Sign in to use Watchlist"
            : search
              ? "No markets found"
              : marketType === "Perpetual" && !perpetualMarkets.length
                ? "No perpetual market data available yet"
                : "No markets match this filter"}
        </div>
      )}

      <div style={styles.list}>
        {filtered.map((m, i) => {
          const up = (m.change_24h ?? 0) >= 0;
          const hasPrice = m.last_price != null;
          return (
            <div
              key={`${m.kind}-${m.symbol}`}
              role="button"
              tabIndex={0}
              className="ceo-pair-row"
              style={{
                ...styles.row,
                ["--pair-index" as string]: i,
              } as CSSProperties}
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

              <MarketIcon
                symbol={m.base_asset}
                size={32}
                iconUrlProp={m.icon_url}
              />

              <div style={styles.pairInfo}>
                <span style={styles.pairSym}>
                  {m.base_asset}
                  <span style={styles.pairQuote}>/{m.quote_asset}</span>
                  {m.kind === "perpetual" ? (
                    <span style={styles.perpTag}>PERP</span>
                  ) : null}
                  {m.session_status === "closed" ? (
                    <span style={styles.closedTag}>Closed</span>
                  ) : null}
                </span>
                <span style={styles.pairVol}>
                  {(() => {
                    const badge = sessionBadgeLabel(m.session_status);
                    if (badge === "Closed") return "Market Closed";
                    if (badge === "Unavailable")
                      return "Market data temporarily unavailable";
                    if (m.volume_24h != null)
                      return `${formatVolume(m.volume_24h)} ${m.quote_asset}`;
                    if (hasPrice) return " ";
                    return "Waiting for price…";
                  })()}
                  {m.kind === "perpetual" &&
                  m.funding_rate != null &&
                  Number.isFinite(m.funding_rate)
                    ? ` · Fund ${m.funding_rate >= 0 ? "+" : ""}${(m.funding_rate * 100).toFixed(4)}%`
                    : ""}
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
  searchWrap: {
    margin: "12px 16px 10px",
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
    gap: 2,
    padding: "0 12px 6px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    flexShrink: 0,
    background: "transparent",
    border: "none",
    color: "#777",
    fontSize: 14,
    fontWeight: 600,
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  tabActive: {
    color: "#f5b51b",
    background: "rgba(245,181,27,0.12)",
  },
  typeRow: {
    display: "flex",
    gap: 4,
    padding: "0 12px 8px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  typeChip: {
    flexShrink: 0,
    background: "transparent",
    border: "none",
    color: "#666",
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  typeActive: {
    color: "#fff",
    background: "#1a1a1a",
    borderBottom: "2px solid #f5b51b",
  },
  filterRow: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "0 12px 8px",
  },
  sortRow: {
    display: "flex",
    gap: 4,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  sortChip: {
    flexShrink: 0,
    background: "transparent",
    border: "none",
    color: "#777",
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 8px",
    borderRadius: 6,
    cursor: "pointer",
  },
  sortActive: {
    color: "#f5b51b",
  },
  quotes: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
  },
  quoteChip: {
    flexShrink: 0,
    background: "#141414",
    border: "1px solid #1f1f1f",
    color: "#999",
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 11px",
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
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  pairQuote: { color: "#888", fontWeight: 600 },
  perpTag: {
    fontSize: 9,
    fontWeight: 800,
    color: "#f5b51b",
    background: "rgba(245,181,27,0.12)",
    padding: "1px 4px",
    borderRadius: 4,
    letterSpacing: "0.02em",
  },
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
    padding: "40px 24px",
    textAlign: "center",
    color: "#666",
    fontSize: 13,
  },
  emptyTitle: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },
  emptyHint: {
    color: "#555",
    fontSize: 12,
    lineHeight: 1.45,
    maxWidth: 280,
    margin: "0 auto",
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
