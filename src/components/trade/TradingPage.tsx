import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { supabase } from "../../lib/supabase";
import { useBybitMarketData } from "../../trading/useBybitMarketData";
import TradingChart from "./TradingChart";
import { formatPct, formatPrice, formatVolume } from "../../lib/format";

type Props = {
  symbol: string;
  onBack: () => void;
};

type Pair = {
  id: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  is_active: boolean;
};

type Wallet = {
  asset: string;
  balance: number;
  locked_balance: number;
  escrow_balance?: number;
  account_type?: string | null;
};

type Order = {
  id: string;
  user_id: string;
  trading_pair: string;
  side: string;
  order_type: string;
  price: number | null;
  amount: number;
  filled_amount: number | null;
  status: string;
  created_at: string;
};

type MicroTab = "book" | "trades";
type BottomTab = "orders" | "assets";
type OrderSide = "buy" | "sell";
type Tf = "15m" | "1h" | "4h" | "1d";

const TFS: Tf[] = ["15m", "1h", "4h", "1d"];

function routeSymbol(fallback: string) {
  try {
    const m = window.location.pathname.match(/^\/trade\/(.+)$/i);
    return m ? decodeURIComponent(m[1]).toUpperCase() : fallback.toUpperCase();
  } catch {
    return fallback.toUpperCase();
  }
}

function compactSym(s: string) {
  return s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function TradingPage({ symbol: propSymbol, onBack }: Props) {
  const [symbol, setSymbol] = useState(() => routeSymbol(propSymbol || "BTCUSDT"));
  const [pair, setPair] = useState<Pair | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [tf, setTf] = useState<Tf>("15m");
  const [micro, setMicro] = useState<MicroTab>("book");
  const [bottom, setBottom] = useState<BottomTab>("orders");
  const [side, setSide] = useState<OrderSide>("buy");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [orderValue, setOrderValue] = useState("");
  const [activePct, setActivePct] = useState<number | null>(null);
  const [priceTouched, setPriceTouched] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeOk, setNoticeOk] = useState(false);
  const [showPairs, setShowPairs] = useState(false);
  const [pairQ, setPairQ] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const {
    ticker,
    candles,
    book,
    trades,
    status: feedStatus,
  } = useBybitMarketData(
    pair?.base_asset ?? null,
    pair?.quote_asset ?? null,
    tf,
  );

  // Live feed values (may update at high frequency — not rendered directly)
  const liveLast = ticker?.last_price != null ? Number(ticker.last_price) : null;
  const liveBid = ticker?.bid_price != null ? Number(ticker.bid_price) : null;
  const liveAsk = ticker?.ask_price != null ? Number(ticker.ask_price) : null;
  const change24 = ticker?.change_24h != null ? Number(ticker.change_24h) : null;
  const high24 = ticker?.high_24h != null ? Number(ticker.high_24h) : null;
  const low24 = ticker?.low_24h != null ? Number(ticker.low_24h) : null;
  const vol24 = ticker?.volume_24h != null ? Number(ticker.volume_24h) : null;

  /**
   * Display-layer throttle: keep the latest real book/ticker in refs, publish
   * to React state on a calm interval so the UI does not rebuild every WS tick.
   * Feed stays real and high-frequency; only presentation is batched.
   */
  const bookRef = useRef(book);
  const lastRef = useRef(liveLast);
  const bidRef = useRef(liveBid);
  const askRef = useRef(liveAsk);
  bookRef.current = book;
  lastRef.current = liveLast;
  bidRef.current = liveBid;
  askRef.current = liveAsk;

  const [displayBook, setDisplayBook] = useState(book);
  const [last, setLast] = useState(liveLast);
  const [bid, setBid] = useState(liveBid);
  const [ask, setAsk] = useState(liveAsk);

  // Visual cadence only — feed remains real-time in refs
  const BOOK_UI_MS = 450;
  const PRICE_UI_MS = 250;

  useEffect(() => {
    let bookRaf = 0;
    let priceRaf = 0;
    let lastBookPaint = 0;
    let lastPricePaint = 0;
    let alive = true;
    let lastBookSig = "";

    const bookSignature = (rows: typeof book) => {
      // Cheap stable signature so identical levels do not re-render
      let s = "";
      for (const r of rows || []) {
        s += `${r.side}:${r.price}:${r.amount}|`;
      }
      return s;
    };

    const paintBook = (ts: number) => {
      if (!alive) return;
      if (ts - lastBookPaint >= BOOK_UI_MS) {
        lastBookPaint = ts;
        const next = bookRef.current || [];
        const sig = bookSignature(next);
        if (sig !== lastBookSig) {
          lastBookSig = sig;
          setDisplayBook(next);
        }
      }
      bookRaf = requestAnimationFrame(paintBook);
    };
    const paintPrice = (ts: number) => {
      if (!alive) return;
      if (ts - lastPricePaint >= PRICE_UI_MS) {
        lastPricePaint = ts;
        const next = lastRef.current;
        setLast((prev) => {
          if (prev != null && next != null && prev !== next) {
            setFlash(next > prev ? "up" : "down");
            window.setTimeout(() => setFlash(null), 280);
          }
          return next;
        });
        setBid(bidRef.current);
        setAsk(askRef.current);
      }
      priceRaf = requestAnimationFrame(paintPrice);
    };

    bookRaf = requestAnimationFrame(paintBook);
    priceRaf = requestAnimationFrame(paintPrice);
    setDisplayBook(bookRef.current);
    lastBookSig = bookSignature(bookRef.current || []);
    setLast(lastRef.current);
    setBid(bidRef.current);
    setAsk(askRef.current);

    return () => {
      alive = false;
      cancelAnimationFrame(bookRaf);
      cancelAnimationFrame(priceRaf);
    };
  }, [pair?.symbol]);


  // Seed price from market when pair loads / side changes — never overwrite user edits
  useEffect(() => {
    if (priceTouched) return;
    const seed =
      side === "buy"
        ? ask ?? last
        : bid ?? last;
    if (seed != null && Number.isFinite(seed) && seed > 0) {
      setPrice(String(seed));
    }
  }, [pair?.symbol, side, ask, bid, last, priceTouched]);

  const loadPair = useCallback(async (sym: string) => {
    setLoading(true);
    setNotice(null);
    setPriceTouched(false);
    const target = sym.toUpperCase();
    const [{ data: one }, { data: all }] = await Promise.all([
      supabase
        .from("trading_pairs")
        .select("id,symbol,base_asset,quote_asset,is_active")
        .eq("symbol", target)
        .maybeSingle(),
      supabase
        .from("trading_pairs")
        .select("id,symbol,base_asset,quote_asset,is_active")
        .eq("is_active", true)
        .order("symbol")
        .limit(500),
    ]);
    setPairs((all as Pair[]) || []);
    let resolved = one as Pair | null;
    if (!resolved) {
      const compact = compactSym(target);
      resolved =
        ((all as Pair[]) || []).find(
          (p) =>
            compactSym(p.symbol) === compact ||
            `${p.base_asset}${p.quote_asset}`.toUpperCase() === compact,
        ) || null;
    }
    if (resolved) {
      setPair(resolved);
      setSymbol(resolved.symbol);
      window.history.replaceState(
        {},
        "",
        `/trade/${encodeURIComponent(resolved.symbol)}`,
      );
    } else {
      setPair(null);
      setNotice(`Pair ${target} not found.`);
      setNoticeOk(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPair(symbol);
  }, [symbol, loadPair]);

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUserId(null);
      setWallets([]);
      setOrders([]);
      return;
    }
    setUserId(user.id);
    const [{ data: w }, { data: o }] = await Promise.all([
      supabase
        .from("wallets")
        .select("asset,balance,locked_balance,escrow_balance,account_type")
        .eq("user_id", user.id),
      supabase
        .from("orders")
        .select(
          "id,user_id,trading_pair,side,order_type,price,amount,filled_amount,status,created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setWallets((w as Wallet[]) || []);
    setOrders((o as Order[]) || []);
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`ceo-trade-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        () => void loadUser(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        () => void loadUser(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, loadUser]);

  // Favorites
  useEffect(() => {
    if (!userId || !pair) {
      setFavorite(false);
      return;
    }
    void supabase
      .from("market_favorites")
      .select("symbol")
      .eq("user_id", userId)
      .eq("symbol", pair.symbol)
      .maybeSingle()
      .then(({ data }) => setFavorite(!!data));
  }, [userId, pair?.symbol]);

  const toggleFavorite = async () => {
    if (!userId || !pair) return;
    if (favorite) {
      await supabase
        .from("market_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("symbol", pair.symbol);
      setFavorite(false);
    } else {
      await supabase
        .from("market_favorites")
        .insert({ user_id: userId, symbol: pair.symbol });
      setFavorite(true);
    }
  };

  const base = pair?.base_asset || "—";
  const quote = pair?.quote_asset || "—";

  const wallet = useMemo(() => {
    const need = side === "buy" ? quote : base;
    const rows = wallets.filter(
      (w) =>
        w.asset?.toUpperCase() === need.toUpperCase() &&
        (!w.account_type || w.account_type === "spot" || w.account_type === "funding"),
    );
    const bal = rows.reduce((s, w) => s + Number(w.balance || 0), 0);
    const locked = rows.reduce(
      (s, w) => s + Number(w.locked_balance || 0) + Number(w.escrow_balance || 0),
      0,
    );
    const available = Math.max(0, bal - locked);
    return { asset: need, available, locked, exists: rows.length > 0 };
  }, [wallets, side, base, quote]);

  const np = Number(price);
  const na = Number(amount);
  const total =
    Number.isFinite(np) && np > 0 && Number.isFinite(na) && na > 0 ? np * na : 0;

  const onPriceChange = (v: string) => {
    setPriceTouched(true);
    setPrice(v);
    setActivePct(null);
    const p = Number(v);
    const a = Number(amount);
    if (Number.isFinite(p) && p > 0 && Number.isFinite(a) && a > 0) {
      setOrderValue(String(Number((p * a).toFixed(8))));
    }
  };

  const onAmountChange = (v: string) => {
    setAmount(v);
    setActivePct(null);
    const a = Number(v);
    const p = Number(price);
    if (Number.isFinite(p) && p > 0 && Number.isFinite(a) && a > 0) {
      setOrderValue(String(Number((p * a).toFixed(8))));
    }
  };

  const onValueChange = (v: string) => {
    setOrderValue(v);
    setActivePct(null);
    const value = Number(v);
    const p = Number(price);
    if (Number.isFinite(p) && p > 0 && Number.isFinite(value) && value > 0) {
      setAmount(String(Number((value / p).toFixed(8))));
    }
  };

  const applyPct = (pct: number) => {
    setActivePct(pct);
    if (!wallet.exists || wallet.available <= 0) return;
    if (side === "buy") {
      const p = Number(price);
      if (!Number.isFinite(p) || p <= 0) return;
      const spend = (wallet.available * pct) / 100;
      setOrderValue(String(Number(spend.toFixed(8))));
      setAmount(String(Number((spend / p).toFixed(8))));
    } else {
      const qty = (wallet.available * pct) / 100;
      setAmount(String(Number(qty.toFixed(8))));
      const p = Number(price);
      if (Number.isFinite(p) && p > 0) {
        setOrderValue(String(Number((qty * p).toFixed(8))));
      }
    }
  };

  const placeOrder = async () => {
    if (!pair) return;
    if (!Number.isFinite(np) || np <= 0) {
      setNotice("Enter a valid limit price.");
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(na) || na <= 0) {
      setNotice("Enter a valid quantity.");
      setNoticeOk(false);
      return;
    }
    if (!wallet.exists || wallet.available <= 0 || total > wallet.available + 1e-12) {
      setNotice("Insufficient balance.");
      setNoticeOk(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Sign in to place orders.");
      setNoticeOk(false);
      return;
    }
    setSubmitting(true);
    setShowReview(false);
    // Current verified execution path: Supabase Edge Function kraken-spot
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: {
        action: "place_order",
        trading_pair: pair.symbol,
        side,
        order_type: "limit",
        price: np,
        amount: na,
      },
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message || "Order failed.");
      setNoticeOk(false);
      return;
    }
    if (data?.error) {
      setNotice(
        /balance|insufficient|fund/i.test(String(data.error))
          ? "Insufficient balance."
          : String(data.error),
      );
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Live order routing is not enabled yet.");
      setNoticeOk(false);
      return;
    }
    if (!data?.order_id && !data?.kraken_order_id) {
      setNotice("The server did not return an order id.");
      setNoticeOk(false);
      return;
    }
    setNotice(
      `Limit ${side.toUpperCase()} submitted${
        data?.kraken_order_id ? ` · ref ${data.kraken_order_id}` : ""
      }.`,
    );
    setNoticeOk(true);
    setAmount("");
    setOrderValue("");
    setActivePct(null);
    void loadUser();
  };

  const cancelOrder = async (orderId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setCancellingId(orderId);
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: { action: "cancel_order", order_id: orderId },
    });
    setCancellingId(null);
    if (error) {
      setNotice(error.message || "Cancel failed.");
      setNoticeOk(false);
      return;
    }
    if (data?.error) {
      setNotice(String(data.error));
      setNoticeOk(false);
      return;
    }
    setNotice("Order cancelled.");
    setNoticeOk(true);
    void loadUser();
  };

  const openOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase();
        return (
          (s === "open" || s === "pending" || s === "partially_filled") &&
          (!pair || o.trading_pair === pair.symbol)
        );
      }),
    [orders, pair],
  );

  const historyOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase();
        return !(s === "open" || s === "pending" || s === "partially_filled");
      }),
    [orders],
  );

  // Order book levels — derived from throttled displayBook (stable keys by price)
  const asks = useMemo(() => {
    const rows = (displayBook || []).filter(
      (r: any) => r.side === "sell" || r.side === "ask",
    );
    // Nearest asks above mid (ascending price, show closest-to-mid at bottom)
    return [...rows]
      .sort((a: any, b: any) => Number(a.price) - Number(b.price))
      .slice(0, 8)
      .reverse();
  }, [displayBook]);

  const bids = useMemo(() => {
    const rows = (displayBook || []).filter(
      (r: any) => r.side === "buy" || r.side === "bid",
    );
    return [...rows]
      .sort((a: any, b: any) => Number(b.price) - Number(a.price))
      .slice(0, 8);
  }, [displayBook]);

  const maxBookQty = useMemo(() => {
    let m = 0;
    for (const r of [...asks, ...bids] as any[]) {
      m = Math.max(m, Number(r.amount || 0));
    }
    return m || 1;
  }, [asks, bids]);

  const spread =
    ask != null && bid != null && Number.isFinite(ask) && Number.isFinite(bid)
      ? ask - bid
      : null;

  const filteredPairs = useMemo(() => {
    const q = pairQ.trim().toLowerCase();
    let list = pairs;
    if (q) {
      list = list.filter((p) =>
        `${p.symbol} ${p.base_asset} ${p.quote_asset}`.toLowerCase().includes(q),
      );
    }
    return list.slice(0, 80);
  }, [pairs, pairQ]);

  const liveLabel =
    feedStatus === "connected"
      ? "LIVE"
      : feedStatus === "connecting"
        ? "SYNC"
        : "OFF";

  const changeUp = change24 != null && change24 >= 0;

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* —— Instrument header —— */}
      <header style={S.header}>
        <button type="button" style={S.iconBtn} onClick={onBack} aria-label="Back">
          ←
        </button>
        <button
          type="button"
          style={S.pairBtn}
          onClick={() => setShowPairs(true)}
        >
          <div style={S.pairSym}>
            {pair ? `${base}/${quote}` : "—"}
            <span style={S.chev}>▾</span>
          </div>
          <div style={S.pairMeta}>
            <span
              style={{
                ...S.liveDot,
                background:
                  feedStatus === "connected"
                    ? "#22c55e"
                    : feedStatus === "connecting"
                      ? "#f5b51b"
                      : "#666",
              }}
            />
            {liveLabel}
          </div>
        </button>
        <button
          type="button"
          style={S.favBtn}
          onClick={() => void toggleFavorite()}
          aria-label="Favorite"
        >
          {favorite ? "★" : "☆"}
        </button>
      </header>

      {/* —— Live price core —— */}
      <section style={S.priceCore}>
        <div
          style={{
            ...S.lastPrice,
            color:
              flash === "up"
                ? "#22c55e"
                : flash === "down"
                  ? "#ef4444"
                  : "#f5f5f5",
          }}
        >
          {last != null ? formatPrice(last) : loading ? "…" : "—"}
        </div>
        <div style={S.changeRow}>
          <span
            style={{
              ...S.changePill,
              color: changeUp ? "#22c55e" : "#ef4444",
              background: changeUp
                ? "rgba(34,197,94,0.12)"
                : "rgba(239,68,68,0.12)",
            }}
          >
            {change24 != null ? formatPct(change24) : "—"}
          </span>
          <span style={S.statTiny}>
            H {high24 != null ? formatPrice(high24) : "—"} · L{" "}
            {low24 != null ? formatPrice(low24) : "—"}
          </span>
        </div>
        <div style={S.statRow}>
          <span>Vol {vol24 != null ? formatVolume(vol24) : "—"}</span>
          <span>
            Bid {bid != null ? formatPrice(bid) : "—"} · Ask{" "}
            {ask != null ? formatPrice(ask) : "—"}
          </span>
        </div>
      </section>

      {/* —— Chart —— */}
      <section style={S.chartZone}>
        <div style={S.tfRow}>
          {TFS.map((t) => (
            <button
              key={t}
              type="button"
              style={{ ...S.tfChip, ...(tf === t ? S.tfActive : {}) }}
              onClick={() => setTf(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={S.chartBox}>
          {candles.length > 0 ? (
            <TradingChart candles={candles as any} height={260} showMA />
          ) : (
            <div style={S.chartEmpty}>
              {feedStatus === "connecting" || loading
                ? "Connecting to live market data…"
                : "No candle data for this pair yet."}
            </div>
          )}
        </div>
      </section>

      {/* —— Microstructure —— */}
      <section style={S.micro}>
        <div style={S.microTabs}>
          {(["book", "trades"] as MicroTab[]).map((t) => (
            <button
              key={t}
              type="button"
              style={{ ...S.microTab, ...(micro === t ? S.microTabOn : {}) }}
              onClick={() => setMicro(t)}
            >
              {t === "book" ? "Order Book" : "Trades"}
            </button>
          ))}
        </div>

        {micro === "book" ? (
          <div style={S.bookGrid}>
            <div style={S.bookCol}>
              <div style={S.bookHead}>
                <span>Price</span>
                <span>Size</span>
              </div>
              {/* Both sides always rendered — never hide asks when only bids update */}
              {asks.length === 0 && bids.length === 0 ? (
                <div style={S.emptyMini}>Waiting for book…</div>
              ) : (
                <>
                  {asks.map((r: any) => {
                    const qty = Number(r.amount || 0);
                    const pct = Math.min(100, (qty / maxBookQty) * 100);
                    return (
                      <button
                        key={`ask-${Number(r.price)}`}
                        type="button"
                        style={S.bookRow}
                        onClick={() => {
                          setPriceTouched(true);
                          setPrice(String(r.price));
                        }}
                      >
                        <span
                          style={{
                            ...S.depthBar,
                            width: `${pct}%`,
                            background: "rgba(239,68,68,0.12)",
                          }}
                        />
                        <span style={{ color: "#ef4444", position: "relative", zIndex: 1 }}>
                          {formatPrice(Number(r.price))}
                        </span>
                        <span style={{ position: "relative", zIndex: 1 }}>{qty || "—"}</span>
                      </button>
                    );
                  })}
                  <div style={S.spreadRow}>
                    {last != null ? formatPrice(last) : "—"}
                    <span style={{ color: "#666", fontWeight: 500, marginLeft: 8 }}>
                      · spread {spread != null ? formatPrice(spread) : "—"}
                    </span>
                  </div>
                  {bids.map((r: any) => {
                    const qty = Number(r.amount || 0);
                    const pct = Math.min(100, (qty / maxBookQty) * 100);
                    return (
                      <button
                        key={`bid-${Number(r.price)}`}
                        type="button"
                        style={S.bookRow}
                        onClick={() => {
                          setPriceTouched(true);
                          setPrice(String(r.price));
                        }}
                      >
                        <span
                          style={{
                            ...S.depthBar,
                            width: `${pct}%`,
                            background: "rgba(34,197,94,0.12)",
                          }}
                        />
                        <span style={{ color: "#22c55e", position: "relative", zIndex: 1 }}>
                          {formatPrice(Number(r.price))}
                        </span>
                        <span style={{ position: "relative", zIndex: 1 }}>{qty || "—"}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={S.tape}>
            <div style={S.bookHead}>
              <span>Price</span>
              <span>Amount</span>
              <span>Time</span>
            </div>
            {(trades || []).length === 0 && (
              <div style={S.emptyMini}>Waiting for trades…</div>
            )}
            {(trades || []).slice(0, 24).map((t: any, i: number) => {
              // Side is only colored when the feed actually provides it
              const sideT = String(t.side || "").toLowerCase();
              const known = sideT === "buy" || sideT === "sell";
              const ts = t.created_at || t.time || t.timestamp;
              return (
                <div key={`t-${i}-${t.id || ts || i}`} style={S.tapeRow}>
                  <span
                    style={{
                      color: known
                        ? sideT === "buy"
                          ? "#22c55e"
                          : "#ef4444"
                        : "#ccc",
                    }}
                  >
                    {formatPrice(Number(t.price))}
                  </span>
                  <span>{t.amount ?? "—"}</span>
                  <span style={{ color: "#666" }}>
                    {ts ? fmtTime(String(ts)) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* —— Order ticket —— */}
      <section style={S.ticket}>
        <div style={S.sideRow}>
          <button
            type="button"
            style={{ ...S.sideBtn, ...(side === "buy" ? S.sideBuyOn : {}) }}
            onClick={() => {
              setSide("buy");
              setPriceTouched(false);
              setActivePct(null);
            }}
          >
            Buy
          </button>
          <button
            type="button"
            style={{ ...S.sideBtn, ...(side === "sell" ? S.sideSellOn : {}) }}
            onClick={() => {
              setSide("sell");
              setPriceTouched(false);
              setActivePct(null);
            }}
          >
            Sell
          </button>
        </div>

        <div style={S.fieldLabel}>
          Limit · Available{" "}
          <b>
            {wallet.exists ? formatPrice(wallet.available) : "—"} {wallet.asset}
          </b>
        </div>

        <label style={S.field}>
          <span>Price</span>
          <input
            style={S.input}
            inputMode="decimal"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            placeholder="0.00"
          />
          <span style={S.suffix}>{quote}</span>
        </label>

        <label style={S.field}>
          <span>Quantity</span>
          <input
            style={S.input}
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
          />
          <span style={S.suffix}>{base}</span>
        </label>

        <label style={S.field}>
          <span>Total</span>
          <input
            style={S.input}
            inputMode="decimal"
            value={orderValue}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="0.00"
          />
          <span style={S.suffix}>{quote}</span>
        </label>

        <div style={S.pctRow}>
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              style={{ ...S.pctBtn, ...(activePct === p ? S.pctOn : {}) }}
              onClick={() => applyPct(p)}
            >
              {p}%
            </button>
          ))}
        </div>

        <button
          type="button"
          style={{
            ...S.cta,
            background: side === "buy" ? "#16a34a" : "#dc2626",
            opacity: submitting ? 0.6 : 1,
          }}
          disabled={submitting || !pair}
          onClick={() => setShowReview(true)}
        >
          {submitting
            ? "Submitting…"
            : side === "buy"
              ? `Review Buy ${base}`
              : `Review Sell ${base}`}
        </button>
      </section>

      {notice && (
        <div
          style={{
            ...S.notice,
            borderColor: noticeOk ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
            color: noticeOk ? "#86efac" : "#fca5a5",
          }}
        >
          {notice}
        </div>
      )}

      {/* —— User activity —— */}
      <section style={S.userZone}>
        <div style={S.microTabs}>
          {(["orders", "assets"] as BottomTab[]).map((t) => (
            <button
              key={t}
              type="button"
              style={{ ...S.microTab, ...(bottom === t ? S.microTabOn : {}) }}
              onClick={() => setBottom(t)}
            >
              {t === "orders" ? "Orders" : "Assets"}
            </button>
          ))}
        </div>

        {bottom === "orders" ? (
          <div style={S.list}>
            <div style={S.subHead}>Open</div>
            {openOrders.length === 0 && (
              <div style={S.emptyMini}>No open orders for this pair.</div>
            )}
            {openOrders.map((o) => (
              <div key={o.id} style={S.orderRow}>
                <div>
                  <b style={{ color: o.side === "buy" ? "#22c55e" : "#ef4444" }}>
                    {o.side.toUpperCase()}
                  </b>{" "}
                  {o.order_type} · {formatPrice(Number(o.price))}
                  <div style={S.orderMeta}>
                    {o.amount} · {o.status}
                  </div>
                </div>
                <button
                  type="button"
                  style={S.cancelBtn}
                  disabled={cancellingId === o.id}
                  onClick={() => void cancelOrder(o.id)}
                >
                  {cancellingId === o.id ? "…" : "Cancel"}
                </button>
              </div>
            ))}
            <div style={S.subHead}>History</div>
            {historyOrders.length === 0 && (
              <div style={S.emptyMini}>No recent order history.</div>
            )}
            {historyOrders.slice(0, 12).map((o) => (
              <div key={o.id} style={S.orderRow}>
                <div>
                  <b style={{ color: o.side === "buy" ? "#22c55e" : "#ef4444" }}>
                    {o.side.toUpperCase()}
                  </b>{" "}
                  {o.trading_pair} · {formatPrice(Number(o.price))}
                  <div style={S.orderMeta}>
                    {o.status} · {fmtTime(o.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={S.list}>
            {wallets.length === 0 && (
              <div style={S.emptyMini}>No wallet balances loaded.</div>
            )}
            {wallets
              .filter((w) => Number(w.balance) > 0 || Number(w.locked_balance) > 0)
              .slice(0, 20)
              .map((w, i) => {
                const locked =
                  Number(w.locked_balance || 0) + Number(w.escrow_balance || 0);
                const avail = Math.max(0, Number(w.balance || 0) - locked);
                return (
                  <div key={`${w.asset}-${i}`} style={S.assetRow}>
                    <b>{w.asset}</b>
                    <div style={{ textAlign: "right" }}>
                      <div>{formatPrice(avail)} avail</div>
                      <div style={S.orderMeta}>{formatPrice(locked)} locked</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <div style={{ height: 24 }} />

      {/* Pair sheet */}
      {showPairs && (
        <div style={S.sheet} onClick={() => setShowPairs(false)}>
          <div style={S.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Select pair</div>
            <input
              style={S.sheetSearch}
              placeholder="Search"
              value={pairQ}
              onChange={(e) => setPairQ(e.target.value)}
              autoFocus
            />
            <div style={S.sheetList}>
              {filteredPairs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  style={S.sheetRow}
                  onClick={() => {
                    setShowPairs(false);
                    setSymbol(p.symbol);
                  }}
                >
                  <span>
                    {p.base_asset}/{p.quote_asset}
                  </span>
                  <span style={{ color: "#666", fontSize: 12 }}>{p.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review sheet */}
      {showReview && (
        <div style={S.sheet} onClick={() => setShowReview(false)}>
          <div style={S.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Confirm {side.toUpperCase()}</div>
            <div style={S.reviewGrid}>
              <span>Pair</span>
              <b>
                {base}/{quote}
              </b>
              <span>Type</span>
              <b>Limit</b>
              <span>Price</span>
              <b>
                {formatPrice(np)} {quote}
              </b>
              <span>Quantity</span>
              <b>
                {na} {base}
              </b>
              <span>Total</span>
              <b>
                {formatPrice(total)} {quote}
              </b>
              <span>Available</span>
              <b>
                {formatPrice(wallet.available)} {wallet.asset}
              </b>
            </div>
            <button
              type="button"
              style={{
                ...S.cta,
                marginTop: 14,
                background: side === "buy" ? "#16a34a" : "#dc2626",
              }}
              disabled={submitting}
              onClick={() => void placeOrder()}
            >
              Confirm {side === "buy" ? "Buy" : "Sell"}
            </button>
            <button
              type="button"
              style={S.ghost}
              onClick={() => setShowReview(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#070708",
    color: "#eee",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    paddingBottom: "env(safe-area-inset-bottom)",
    maxWidth: 560,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    paddingTop: "calc(10px + env(safe-area-inset-top))",
    borderBottom: "1px solid #141416",
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(7,7,8,0.92)",
    backdropFilter: "blur(10px)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "#ccc",
    fontSize: 20,
    cursor: "pointer",
  },
  pairBtn: {
    flex: 1,
    border: 0,
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
    color: "#fff",
    padding: 0,
  },
  pairSym: { fontSize: 17, fontWeight: 800, letterSpacing: 0.2 },
  chev: { marginLeft: 6, color: "#f5b51b", fontSize: 12 },
  pairMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "inline-block",
  },
  favBtn: {
    width: 40,
    height: 40,
    border: 0,
    background: "transparent",
    color: "#f5b51b",
    fontSize: 20,
    cursor: "pointer",
  },
  priceCore: { padding: "14px 16px 8px" },
  lastPrice: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: -0.5,
    lineHeight: 1.1,
    transition: "color 0.25s ease",
  },
  changeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  changePill: {
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
  },
  statTiny: { fontSize: 11, color: "#777" },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 8,
    fontSize: 11,
    color: "#666",
  },
  chartZone: { padding: "4px 0 8px" },
  tfRow: {
    display: "flex",
    gap: 6,
    padding: "0 12px 8px",
    overflowX: "auto",
  },
  tfChip: {
    border: "1px solid #1c1c1f",
    background: "#0e0e10",
    color: "#888",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  tfActive: {
    borderColor: "#2a2110",
    color: "#f5b51b",
    background: "rgba(245,181,27,0.08)",
  },
  chartBox: {
    margin: "0 8px",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #141416",
    background: "#0a0a0c",
  },
  chartEmpty: {
    height: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
    fontSize: 13,
  },
  micro: { padding: "8px 12px" },
  microTabs: {
    display: "flex",
    gap: 4,
    marginBottom: 8,
    background: "#0e0e10",
    borderRadius: 10,
    padding: 3,
  },
  microTab: {
    flex: 1,
    border: 0,
    background: "transparent",
    color: "#777",
    padding: "8px 0",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  microTabOn: {
    background: "#161618",
    color: "#f5b51b",
  },
  bookGrid: {},
  bookCol: {},
  bookHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    fontSize: 10,
    color: "#555",
    padding: "4px 6px",
  },
  bookRow: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#ccc",
    fontSize: 12,
    padding: "5px 6px",
    textAlign: "left",
    cursor: "pointer",
  },
  depthBar: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
    transition: "width 0.25s ease-out",
  },
  spreadRow: {
    textAlign: "center",
    fontSize: 11,
    color: "#f5b51b",
    padding: "6px 0",
    fontWeight: 600,
  },
  tape: {},
  tapeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    fontSize: 12,
    padding: "5px 6px",
    color: "#ccc",
  },
  ticket: {
    margin: "8px 12px",
    padding: 14,
    borderRadius: 14,
    background: "linear-gradient(180deg, #0e0e11 0%, #0a0a0c 100%)",
    border: "1px solid #1a1a1e",
  },
  sideRow: { display: "flex", gap: 8, marginBottom: 12 },
  sideBtn: {
    flex: 1,
    border: "1px solid #222",
    background: "#121214",
    color: "#888",
    borderRadius: 10,
    padding: "10px 0",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  sideBuyOn: {
    borderColor: "rgba(34,197,94,0.45)",
    color: "#22c55e",
    background: "rgba(34,197,94,0.1)",
  },
  sideSellOn: {
    borderColor: "rgba(239,68,68,0.45)",
    color: "#ef4444",
    background: "rgba(239,68,68,0.1)",
  },
  fieldLabel: { fontSize: 12, color: "#888", marginBottom: 10 },
  field: {
    display: "grid",
    gridTemplateColumns: "70px 1fr auto",
    alignItems: "center",
    gap: 8,
    background: "#0a0a0c",
    border: "1px solid #1c1c1f",
    borderRadius: 10,
    padding: "8px 10px",
    marginBottom: 8,
    fontSize: 12,
    color: "#888",
  },
  input: {
    border: 0,
    background: "transparent",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
    width: "100%",
  },
  suffix: { color: "#666", fontSize: 12, fontWeight: 600 },
  pctRow: { display: "flex", gap: 6, margin: "10px 0 12px" },
  pctBtn: {
    flex: 1,
    border: "1px solid #1c1c1f",
    background: "#121214",
    color: "#888",
    borderRadius: 8,
    padding: "8px 0",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  pctOn: {
    borderColor: "#2a2110",
    color: "#f5b51b",
    background: "rgba(245,181,27,0.08)",
  },
  cta: {
    width: "100%",
    border: 0,
    borderRadius: 12,
    padding: "14px 0",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  notice: {
    margin: "0 12px 8px",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 12,
  },
  userZone: { padding: "4px 12px 16px" },
  list: { paddingTop: 4 },
  subHead: {
    fontSize: 11,
    color: "#666",
    fontWeight: 700,
    margin: "10px 0 6px",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  orderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #141416",
    fontSize: 13,
  },
  orderMeta: { fontSize: 11, color: "#666", marginTop: 2 },
  cancelBtn: {
    border: "1px solid #333",
    background: "transparent",
    color: "#ccc",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  assetRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #141416",
    fontSize: 13,
  },
  emptyMini: {
    padding: "16px 8px",
    textAlign: "center",
    color: "#555",
    fontSize: 12,
  },
  sheet: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 50,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheetCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "78vh",
    background: "#0e0e11",
    borderRadius: "16px 16px 0 0",
    border: "1px solid #1c1c1f",
    padding: 16,
    overflow: "auto",
  },
  sheetTitle: { fontSize: 16, fontWeight: 800, marginBottom: 12 },
  sheetSearch: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #1c1c1f",
    background: "#0a0a0c",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    marginBottom: 10,
  },
  sheetList: {},
  sheetRow: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    border: 0,
    background: "transparent",
    color: "#eee",
    padding: "12px 4px",
    borderBottom: "1px solid #141416",
    cursor: "pointer",
    fontSize: 14,
  },
  reviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    fontSize: 13,
    color: "#888",
  },
  ghost: {
    width: "100%",
    marginTop: 8,
    border: 0,
    background: "transparent",
    color: "#888",
    padding: 12,
    cursor: "pointer",
  },
};

const CSS = `
  @media (min-width: 900px) {
    /* Workstation: page can grow; sections stack denser */
  }
  button:active { transform: scale(0.98); }
`;
