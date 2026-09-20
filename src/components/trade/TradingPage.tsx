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
import { getLiveExecutionProvider } from "../../trading/providers";
import TradingChart, {
  computeMALegend,
  intervalToSeconds,
  type IndicatorId,
  type ChartStyle,
  type ChartDisplaySettings,
  type DrawingTool,
  type TradingChartHandle,
  type CandleInfo,
} from "./TradingChart";
import { formatPrice } from "../../lib/format";

type Props = {
  symbol: string;
  onBack: () => void;
  /** Guest: primary CTA opens existing AuthScreen instead of placing orders. */
  onRequireAuth?: () => void;
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
type BottomTab = "orders" | "positions" | "assets" | "borrowings";
type OrderSide = "buy" | "sell";
/** Must match SUPPORTED_TIMEFRAMES in useBybitMarketData. */
type Tf =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "1w"
  | "1M";
/** Supported by current backend: limit (and market UI only). Others are UI-only / coming soon. */
type OrderType =
  | "limit"
  | "market"
  | "tp_sl"
  | "conditional"
  | "oco"
  | "trailing_stop"
  | "chase_limit"
  | "scaled"
  | "twap"
  | "iceberg";

type ViewMode = "terminal" | "chart";

/** Quick chips on the chart timeframe bar */
const TFS_QUICK: Tf[] = ["15m", "1h", "4h", "1d"];
/** Full list for the "More" sheet — every interval the Bybit feed accepts */
const TFS_ALL: Tf[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
  "1w",
  "1M",
];

const ORDER_TYPE_OPTIONS: {
  id: OrderType;
  label: string;
  supported: boolean;
}[] = [
  { id: "limit", label: "Limit", supported: true },
  { id: "market", label: "Market", supported: true },
  { id: "tp_sl", label: "TP/SL", supported: false },
  { id: "conditional", label: "Conditional", supported: false },
  { id: "oco", label: "OCO", supported: false },
  { id: "trailing_stop", label: "Trailing Stop", supported: false },
  { id: "chase_limit", label: "Chase Limit Order", supported: false },
  { id: "scaled", label: "Scaled Order", supported: false },
  { id: "twap", label: "TWAP", supported: false },
  { id: "iceberg", label: "Iceberg", supported: false },
];

const PCT_STEPS = [0, 25, 50, 75, 100] as const;

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

export default function TradingPage({ symbol: propSymbol, onBack, onRequireAuth }: Props) {
  const [symbol, setSymbol] = useState(() => routeSymbol(propSymbol || "BTCUSDT"));
  const [pair, setPair] = useState<Pair | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [tf, setTf] = useState<Tf>("15m");
  const [showMoreTf, setShowMoreTf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartFsRef = useRef<HTMLDivElement | null>(null);
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
  const [hasSession, setHasSession] = useState(false);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeOk, setNoticeOk] = useState(false);
  const [showPairs, setShowPairs] = useState(false);
  const [pairQ, setPairQ] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("terminal");
  const [chartTab, setChartTab] = useState<"chart" | "overview">("chart");
  const [showMA, setShowMA] = useState(true);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorId[]>(["ma"]);
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candlestick");
  const [chartHeight, setChartHeight] = useState(380);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("none");
  const [showDrawBar, setShowDrawBar] = useState(false);
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [showDateJump, setShowDateJump] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const [jumpTime, setJumpTime] = useState("00:00");
  const [candleInfo, setCandleInfo] = useState<CandleInfo | null>(null);
  const [chartDisplay, setChartDisplay] = useState<ChartDisplaySettings>({
    lastTradedPrice: true,
    grid: true,
    maxPrice: true,
    minPrice: true,
    countdown: false,
  });
  /** Chart overlays driven by real orders table */
  const [showTradeHistoryOnChart, setShowTradeHistoryOnChart] = useState(true);
  const [showCurrentOrdersOnChart, setShowCurrentOrdersOnChart] = useState(true);
  const [showAvgBuyOnChart, setShowAvgBuyOnChart] = useState(true);
  const [showAvgSellOnChart, setShowAvgSellOnChart] = useState(false);
  const [modifyTarget, setModifyTarget] = useState<Order | null>(null);
  const [modifyPrice, setModifyPrice] = useState("");
  const [modifyAmount, setModifyAmount] = useState("");
  const chartApiRef = useRef<TradingChartHandle | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [showOrderTypeMenu, setShowOrderTypeMenu] = useState(false);
  const [postOnly, setPostOnly] = useState(true);
  const [tpSl, setTpSl] = useState(false);
  const [tabAnim, setTabAnim] = useState(false);
  const pctTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setHasSession(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Keep isFullscreen in sync when user exits via system gesture
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const {
    ticker,
    candles,
    book,
    trades,
    status: feedStatus,
    loadHistoryAround,
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
    if (!wallet.exists || wallet.available <= 0) {
      if (pct === 0) {
        setAmount("");
        setOrderValue("");
      }
      return;
    }
    // For market orders use last/ask/bid as reference price for sizing
    const refPrice =
      orderType === "market"
        ? side === "buy"
          ? ask ?? last ?? Number(price)
          : bid ?? last ?? Number(price)
        : Number(price);
    if (side === "buy") {
      if (!Number.isFinite(refPrice) || refPrice <= 0) return;
      const spend = (wallet.available * pct) / 100;
      setOrderValue(String(Number(spend.toFixed(8))));
      setAmount(String(Number((spend / refPrice).toFixed(8))));
    } else {
      const qty = (wallet.available * pct) / 100;
      setAmount(String(Number(qty.toFixed(8))));
      if (Number.isFinite(refPrice) && refPrice > 0) {
        setOrderValue(String(Number((qty * refPrice).toFixed(8))));
      }
    }
  };

  /** Drag / click on percentage track */
  const onPctTrackPointer = (clientX: number) => {
    const el = pctTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const pct = Math.round(ratio * 4) * 25; // snap to 0/25/50/75/100
    applyPct(pct);
  };

  const selectOrderType = (id: OrderType) => {
    const opt = ORDER_TYPE_OPTIONS.find((o) => o.id === id);
    if (!opt) return;
    if (!opt.supported) {
      setNotice(`${opt.label} is coming soon.`);
      setNoticeOk(false);
      setShowOrderTypeMenu(false);
      return;
    }
    setOrderType(id);
    setShowOrderTypeMenu(false);
    if (id === "market") {
      // Market: clear price seed sensitivity; size still uses ref price
      setPriceTouched(true);
    } else if (id === "limit") {
      setPriceTouched(false);
    }
  };

  const switchBottomTab = (t: BottomTab) => {
    if (t === bottom) return;
    setTabAnim(true);
    setBottom(t);
    window.setTimeout(() => setTabAnim(false), 220);
  };

  const orderTypeLabel =
    ORDER_TYPE_OPTIONS.find((o) => o.id === orderType)?.label ?? "Limit";

  const placeOrder = async () => {
    if (!pair) return;
    const isMarket = orderType === "market";
    const execPrice = isMarket
      ? side === "buy"
        ? ask ?? last
        : bid ?? last
      : np;
    if (!isMarket && (!Number.isFinite(np) || np <= 0)) {
      setNotice("Enter a valid limit price.");
      setNoticeOk(false);
      return;
    }
    if (isMarket && (execPrice == null || !Number.isFinite(execPrice) || execPrice <= 0)) {
      setNotice("Market price unavailable. Try again.");
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(na) || na <= 0) {
      setNotice("Enter a valid quantity.");
      setNoticeOk(false);
      return;
    }
    const checkTotal =
      isMarket && execPrice != null ? execPrice * na : total;
    if (
      !wallet.exists ||
      wallet.available <= 0 ||
      checkTotal > wallet.available + 1e-12
    ) {
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
    // Live Bybit execution via bybit-private (session JWT only; no API keys).
    const exec = getLiveExecutionProvider();
    const data = await exec.placeOrder({
      trading_pair: pair.symbol,
      side,
      order_type: isMarket ? "market" : "limit",
      price: isMarket ? undefined : np,
      amount: na,
    });
    setSubmitting(false);
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
      setNotice(
        String(data.message || "Live order routing is not enabled yet."),
      );
      setNoticeOk(false);
      return;
    }
    if (!data?.order_id && !data?.bybit_order_id) {
      setNotice("The server did not return an order id.");
      setNoticeOk(false);
      return;
    }
    setNotice(
      `${isMarket ? "Market" : "Limit"} ${side.toUpperCase()} submitted${
        data?.bybit_order_id ? ` · ${data.bybit_order_id}` : ""
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
    const exec = getLiveExecutionProvider();
    const data = await exec.cancelOrder({ order_id: orderId });
    setCancellingId(null);
    if (data?.error) {
      setNotice(String(data.error));
      setNoticeOk(false);
      return;
    }
    setNotice("Order cancelled.");
    setNoticeOk(true);
    void loadUser();
  };

  /**
   * Real modify_order via bybit-private (Bybit POST /v5/order/amend on server).
   * No optimistic UI success — waits for server response, then refreshes orders.
   */
  const modifyOrder = async (
    orderId: string,
    price: number,
    amount?: number,
  ): Promise<boolean> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Sign in to modify orders.");
      setNoticeOk(false);
      return false;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setNotice("Invalid price.");
      setNoticeOk(false);
      return false;
    }
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      setNotice("Invalid amount.");
      setNoticeOk(false);
      return false;
    }
    setCancellingId(orderId);
    const exec = getLiveExecutionProvider();
    const data = await exec.modifyOrder({
      order_id: orderId,
      price,
      ...(amount !== undefined ? { amount } : {}),
    });
    setCancellingId(null);
    if (data?.error) {
      setNotice(String(data.error));
      setNoticeOk(false);
      return false;
    }
    if (!data?.order_id) {
      setNotice("Modify was not confirmed by the server.");
      setNoticeOk(false);
      return false;
    }
    setNotice(
      `Order updated · ${Number(data.price).toFixed(2)}${
        data.bybit_order_id ? ` · ${data.bybit_order_id}` : ""
      }`,
    );
    setNoticeOk(true);
    void loadUser();
    return true;
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

  /**
   * Real average fill prices from the user's orders table.
   * Uses filled_amount when present, else amount for filled statuses.
   * No invented values — null when insufficient data.
   */
  const avgFills = useMemo(() => {
    let buyNotional = 0;
    let buyQty = 0;
    let sellNotional = 0;
    let sellQty = 0;
    for (const o of orders) {
      if (pair && o.trading_pair !== pair.symbol) continue;
      const s = (o.status || "").toLowerCase();
      const filled =
        o.filled_amount != null && o.filled_amount > 0
          ? Number(o.filled_amount)
          : s === "filled" || s === "closed"
            ? Number(o.amount)
            : 0;
      const px = o.price != null ? Number(o.price) : null;
      if (!filled || px == null || !Number.isFinite(px) || px <= 0) continue;
      if ((o.side || "").toLowerCase() === "buy") {
        buyNotional += px * filled;
        buyQty += filled;
      } else if ((o.side || "").toLowerCase() === "sell") {
        sellNotional += px * filled;
        sellQty += filled;
      }
    }
    return {
      avgBuy: buyQty > 0 ? buyNotional / buyQty : null,
      avgSell: sellQty > 0 ? sellNotional / sellQty : null,
    };
  }, [orders, pair]);

  /** Filled-order markers for the chart (time + price from real rows). */
  const tradeMarkers = useMemo(() => {
    if (!showTradeHistoryOnChart) return [];
    return orders
      .filter((o) => {
        if (pair && o.trading_pair !== pair.symbol) return false;
        const s = (o.status || "").toLowerCase();
        const filled =
          (o.filled_amount != null && o.filled_amount > 0) ||
          s === "filled" ||
          s === "closed" ||
          s === "partially_filled";
        return filled && o.price != null;
      })
      .map((o) => ({
        time: o.created_at,
        price: Number(o.price),
        side: (o.side || "").toLowerCase() as "buy" | "sell",
        id: o.id,
      }));
  }, [orders, pair, showTradeHistoryOnChart]);

  /** Open limit orders as price levels on the chart. */
  const openOrderLevels = useMemo(() => {
    if (!showCurrentOrdersOnChart) return [];
    return openOrders
      .filter((o) => o.price != null && Number(o.price) > 0)
      .map((o) => ({
        id: o.id,
        price: Number(o.price),
        side: (o.side || "").toLowerCase() as "buy" | "sell",
      }));
  }, [openOrders, showCurrentOrdersOnChart]);

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

  // Buy/Sell volume ratio for depth indicator (approximate from visible book)
  const bookRatio = useMemo(() => {
    let bidVol = 0;
    let askVol = 0;
    for (const r of bids as any[]) bidVol += Number(r.amount || 0);
    for (const r of asks as any[]) askVol += Number(r.amount || 0);
    const total = bidVol + askVol;
    if (total <= 0) return { buy: 50, sell: 50 };
    const buy = Math.round((bidVol / total) * 100);
    return { buy, sell: 100 - buy };
  }, [bids, asks]);

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
  const changeStr =
    change24 != null
      ? `${change24 >= 0 ? "+" : ""}${change24.toFixed(2)}%`
      : "—";

  const maxBuyQty =
    side === "buy" && Number.isFinite(np) && np > 0 && wallet.available > 0
      ? wallet.available / np
      : 0;

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header style={S.header}>
        <button type="button" style={S.iconBtn} onClick={onBack} aria-label="Back">
          ←
        </button>
        <div style={S.headerTitle}>Trade</div>
        <button
          type="button"
          style={S.iconBtn}
          onClick={() => {
            // ONE fullscreen control: real Fullscreen API on the chart workspace
            const el = chartFsRef.current;
            if (!el) {
              // If chart not mounted yet, switch to chart view first
              setViewMode("chart");
              return;
            }
            if (document.fullscreenElement) {
              void document.exitFullscreen().then(() => setIsFullscreen(false));
            } else {
              void el.requestFullscreen?.().then(() => setIsFullscreen(true));
            }
          }}
          aria-label="Fullscreen chart"
          title="Fullscreen chart"
        >
          {isFullscreen ? "✕" : "⛶"}
        </button>
      </header>

      {/* ── Pair row ── */}
      <div style={S.pairRow}>
        <button
          type="button"
          style={S.pairSelect}
          onClick={() => setShowPairs(true)}
        >
          <span style={S.pairSym}>
            {pair ? `${base}/${quote}` : "—"}
          </span>
          <span style={S.chev}>▾</span>
        </button>
        <span
          style={{
            ...S.changePct,
            color: changeUp ? "#22c55e" : "#ef4444",
          }}
        >
          {changeStr}
        </span>
        <div style={S.pairControls}>
          <span style={S.mmBadge}>MM</span>
          <span style={S.mmPct}>0.00%</span>
          {/* Top-right segmented control — exact match to exchange reference */}
          <div style={S.segControl} role="group" aria-label="View mode">
            <button
              type="button"
              style={{
                ...S.segBtn,
                ...(viewMode === "chart" ? S.segBtnOn : {}),
              }}
              onClick={() => setViewMode("chart")}
              aria-label="Chart view"
              aria-pressed={viewMode === "chart"}
            >
              {/* Candlestick — bold, matches picture */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 2v4H6.5v12H8v4h2v-4h1.5V6H10V2H8zm1.5 6h-1v10h1V8zM16 4v3h-1.5v10H16v3h2v-3h1.5V7H18V4h-2zm1.5 5h-1v8h1V9z" />
              </svg>
            </button>
            <button
              type="button"
              style={{
                ...S.segBtn,
                ...(viewMode === "terminal" ? S.segBtnOn : {}),
              }}
              onClick={() => setViewMode("terminal")}
              aria-label="Order book view"
              aria-pressed={viewMode === "terminal"}
            >
              {/* Document list — bold, matches picture right icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-6-6H5zm0 2h9v5h5v11H5V5zm2 8h10v2H7v-2zm0 4h7v2H7v-2z" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            style={S.favBtn}
            onClick={() => void toggleFavorite()}
            aria-label="Favorite"
          >
            {favorite ? "★" : "☆"}
          </button>
        </div>
      </div>

      {/* ── Chart view (matches reference video structure) ── */}
      {viewMode === "chart" && (
        <section
          ref={chartFsRef}
          style={{
            ...S.chartZone,
            ...(isFullscreen
              ? {
                  position: "fixed" as const,
                  inset: 0,
                  zIndex: 100,
                  background: "#0a0a0a",
                  maxWidth: "100%",
                }
              : {}),
          }}
          className="ceo-fade-in"
        >
          <div style={S.chartScroll}>
          {/* Chart | Overview tabs */}
          <div style={S.chartMainTabs}>
            {(
              [
                { id: "chart" as const, label: "Chart" },
                { id: "overview" as const, label: "Overview" },
              ]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                style={{
                  ...S.chartMainTab,
                  ...(chartTab === t.id ? S.chartMainTabOn : {}),
                }}
                onClick={() => setChartTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {chartTab === "overview" ? (
            <div style={S.overviewPanel}>
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>📄</div>
                <div style={S.emptyText}>No Available Data</div>
              </div>
            </div>
          ) : (
            <>
              {/* Live price header */}
              <div style={S.chartPriceHead}>
                <div>
                  <div
                    style={{
                      ...S.chartLastPrice,
                      color:
                        flash === "up"
                          ? "#14c982"
                          : flash === "down"
                            ? "#f23645"
                            : changeUp
                              ? "#14c982"
                              : "#f23645",
                    }}
                  >
                    {last != null ? formatPrice(last) : "—"}
                  </div>
                  <div style={S.chartLastSub}>
                    ≈ {last != null ? formatPrice(last) : "—"} USD
                  </div>
                </div>
                <div style={S.chartStats}>
                  <div style={S.chartStatRow}>
                    <span style={S.chartStatLabel}>24h High</span>
                    <span>{high24 != null ? formatPrice(high24) : "—"}</span>
                  </div>
                  <div style={S.chartStatRow}>
                    <span style={S.chartStatLabel}>24h Low</span>
                    <span>{low24 != null ? formatPrice(low24) : "—"}</span>
                  </div>
                  <div style={S.chartStatRow}>
                    <span style={S.chartStatLabel}>24h Vol</span>
                    <span>
                      {vol24 != null
                        ? vol24 >= 1e6
                          ? `${(vol24 / 1e6).toFixed(2)}M`
                          : vol24 >= 1e3
                            ? `${(vol24 / 1e3).toFixed(1)}K`
                            : vol24.toFixed(0)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeframe row — real intervals via useBybitMarketData */}
              <div style={S.tfRow}>
                <span style={S.tfLabel}>Time</span>
                {TFS_QUICK.map((t) => (
                  <button
                    key={t}
                    type="button"
                    style={{ ...S.tfChip, ...(tf === t ? S.tfActive : {}) }}
                    onClick={() => setTf(t)}
                  >
                    {t === "1d" ? "1D" : t}
                  </button>
                ))}
                <button
                  type="button"
                  style={{
                    ...S.tfChip,
                    ...(TFS_ALL.includes(tf) && !TFS_QUICK.includes(tf)
                      ? S.tfActive
                      : {}),
                  }}
                  onClick={() => setShowMoreTf(true)}
                >
                  {TFS_ALL.includes(tf) && !TFS_QUICK.includes(tf)
                    ? tf === "1d"
                      ? "1D"
                      : tf === "1w"
                        ? "1W"
                        : tf === "1M"
                          ? "1M"
                          : tf
                    : "More"}
                  ▾
                </button>
              </div>

              {/* MA legend when MA active */}
              {activeIndicators.includes("ma") && (() => {
                const ma = computeMALegend(candles as any);
                return (
                  <div style={S.maLegend}>
                    <span style={{ color: "#f0b90b" }}>
                      MA7: {ma.ma7 != null ? formatPrice(ma.ma7) : "—"}
                    </span>
                    <span style={{ color: "#5b8def" }}>
                      MA14: {ma.ma14 != null ? formatPrice(ma.ma14) : "—"}
                    </span>
                    <span style={{ color: "#c77dff" }}>
                      MA28: {ma.ma28 != null ? formatPrice(ma.ma28) : "—"}
                    </span>
                  </div>
                );
              })()}

              {/* Candle OHLC from crosshair */}
              {candleInfo && (
                <div style={S.maLegend}>
                  <span>O {formatPrice(candleInfo.open)}</span>
                  <span>H {formatPrice(candleInfo.high)}</span>
                  <span>L {formatPrice(candleInfo.low)}</span>
                  <span
                    style={{
                      color:
                        candleInfo.changePct != null && candleInfo.changePct >= 0
                          ? "#14c982"
                          : "#f23645",
                    }}
                  >
                    C {formatPrice(candleInfo.close)}
                    {candleInfo.changePct != null
                      ? ` (${candleInfo.changePct >= 0 ? "+" : ""}${candleInfo.changePct.toFixed(2)}%)`
                      : ""}
                  </span>
                  <span style={{ color: "#848e9c" }}>
                    Vol {candleInfo.volume.toFixed(3)}
                  </span>
                </div>
              )}

              {/* Drawing toolbar — only when enabled */}
              {showDrawBar && (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    overflowX: "auto",
                    padding: "6px 8px",
                    background: "#111",
                    borderBottom: "1px solid #1a1a1a",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {(
                    [
                      ["trend", "╱"],
                      ["ray", "↗"],
                      ["hline", "─"],
                      ["vline", "│"],
                      ["fib", "Fib"],
                      ["rect", "▭"],
                      ["circle", "○"],
                      ["brush", "✎"],
                      ["measure", "↔"],
                      ["arrow", "→"],
                      ["text", "T"],
                      ["eraser", "⌫"],
                    ] as [DrawingTool, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      style={{
                        ...S.indChip,
                        minWidth: 36,
                        ...(drawingTool === id ? S.indChipOn : {}),
                      }}
                      onClick={() =>
                        setDrawingTool((t) => (t === id ? "none" : id))
                      }
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    style={S.indChip}
                    onClick={() => chartApiRef.current?.clearDrawings()}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    style={S.indChip}
                    onClick={() => {
                      setShowDrawBar(false);
                      setDrawingTool("none");
                    }}
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Candlestick chart */}
              <div style={S.chartBox}>
                {candles.length > 0 ? (
                  <TradingChart
                    ref={chartApiRef}
                    candles={candles as any}
                    height={chartHeight}
                    activeIndicators={activeIndicators}
                    chartStyle={chartStyle}
                    display={chartDisplay}
                    drawingTool={drawingTool}
                    intervalSec={intervalToSeconds(tf)}
                    onCandleInfo={setCandleInfo}
                    avgBuy={showAvgBuyOnChart ? avgFills.avgBuy : null}
                    avgSell={showAvgSellOnChart ? avgFills.avgSell : null}
                    tradeMarkers={tradeMarkers}
                    openOrderLevels={openOrderLevels}
                  />
                ) : (
                  <div style={S.chartEmpty}>
                    {feedStatus === "connecting" || loading
                      ? "Connecting to live market data…"
                      : "No candle data for this pair yet."}
                  </div>
                )}
              </div>

              {/* Chart tool row: pen / settings / date / others */}
              <div style={S.indRow}>
                <button
                  type="button"
                  style={{
                    ...S.indChip,
                    ...(showDrawBar ? S.indChipOn : {}),
                  }}
                  onClick={() => {
                    setShowDrawBar((v) => !v);
                    if (showDrawBar) setDrawingTool("none");
                  }}
                  title="Drawing tools"
                >
                  ✎
                </button>
                <button
                  type="button"
                  style={S.indChip}
                  onClick={() => setShowChartSettings(true)}
                  title="Chart settings"
                >
                  ⚙
                </button>
                <button
                  type="button"
                  style={S.indChip}
                  onClick={() => {
                    const now = new Date();
                    setJumpDate(now.toISOString().slice(0, 10));
                    setJumpTime(
                      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
                    );
                    setShowDateJump(true);
                  }}
                  title="Jump to date"
                >
                  📅
                </button>
                <button
                  type="button"
                  style={S.indChip}
                  onClick={() => setShowOthers(true)}
                  title="Chart style"
                >
                  ▤
                </button>
              </div>

              {/* Indicator row — all calculate from real candle data */}
              <div style={S.indRow}>
                {(
                  [
                    { id: "ma" as IndicatorId, label: "MA" },
                    { id: "ema" as IndicatorId, label: "EMA" },
                    { id: "boll" as IndicatorId, label: "BOLL" },
                    { id: "sar" as IndicatorId, label: "SAR" },
                    { id: "mavol" as IndicatorId, label: "MAVOL" },
                    { id: "macd" as IndicatorId, label: "MACD" },
                    { id: "kdj" as IndicatorId, label: "KDJ" },
                    { id: "rsi" as IndicatorId, label: "RSI" },
                    { id: "wr" as IndicatorId, label: "WR" },
                  ]
                ).map((ind) => {
                  const on = activeIndicators.includes(ind.id);
                  return (
                    <button
                      key={ind.id}
                      type="button"
                      style={{
                        ...S.indChip,
                        ...(on ? S.indChipOn : {}),
                      }}
                      onClick={() => {
                        setActiveIndicators((prev) => {
                          if (prev.includes(ind.id)) {
                            const next = prev.filter((x) => x !== ind.id);
                            setShowMA(next.includes("ma"));
                            return next;
                          }
                          const next = [...prev, ind.id];
                          setShowMA(next.includes("ma"));
                          return next;
                        });
                      }}
                    >
                      {ind.label}
                    </button>
                  );
                })}
              </div>

              {/* Order Book | Trades under chart */}
              <div style={S.microTabs}>
                <button
                  type="button"
                  style={{
                    ...S.microTab,
                    ...(micro === "book" ? S.microTabOn : {}),
                  }}
                  onClick={() => setMicro("book")}
                >
                  Order Book
                </button>
                <button
                  type="button"
                  style={{
                    ...S.microTab,
                    ...(micro === "trades" ? S.microTabOn : {}),
                  }}
                  onClick={() => setMicro("trades")}
                >
                  Trades
                </button>
              </div>

              {micro === "book" ? (
                <div style={S.chartBookWrap}>
                  <div style={S.depthRatio}>
                    <span style={S.depthBuy}>B {bookRatio.buy}%</span>
                    <div style={S.depthBarTrack}>
                      <div
                        style={{
                          ...S.depthBarFill,
                          width: `${bookRatio.buy}%`,
                          background: "#14c982",
                        }}
                      />
                      <div
                        style={{
                          ...S.depthBarFill,
                          width: `${bookRatio.sell}%`,
                          background: "#f23645",
                        }}
                      />
                    </div>
                    <span style={S.depthSell}>S {bookRatio.sell}%</span>
                  </div>
                  <div style={S.chartBookGrid}>
                    <div style={S.chartBookCol}>
                      <div style={S.chartBookHead}>Buy</div>
                      {bids.slice(0, 8).map((r: any) => (
                        <button
                          key={`cb-${Number(r.price)}`}
                          type="button"
                          style={S.chartBookRow}
                          onClick={() => {
                            setPriceTouched(true);
                            setPrice(String(r.price));
                          }}
                        >
                          <span style={{ color: "#14c982" }}>
                            {formatPrice(Number(r.price))}
                          </span>
                          <span style={{ color: "#888" }}>
                            {Number(r.amount || 0).toFixed(4)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={S.chartBookCol}>
                      <div style={S.chartBookHead}>Sell</div>
                      {asks.slice(0, 8).map((r: any) => (
                        <button
                          key={`ca-${Number(r.price)}`}
                          type="button"
                          style={S.chartBookRow}
                          onClick={() => {
                            setPriceTouched(true);
                            setPrice(String(r.price));
                          }}
                        >
                          <span style={{ color: "#f23645" }}>
                            {formatPrice(Number(r.price))}
                          </span>
                          <span style={{ color: "#888" }}>
                            {Number(r.amount || 0).toFixed(4)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={S.tapeList}>
                  {(trades || []).slice(0, 20).length === 0 ? (
                    <div style={S.emptyMini}>Waiting for trades…</div>
                  ) : (
                    (trades || []).slice(0, 20).map((t: any, i: number) => (
                      <div key={t.id || i} style={S.tapeRow}>
                        <span style={{ color: "#666" }}>
                          {fmtTime(t.created_at || "")}
                        </span>
                        <span
                          style={{
                            color:
                              Number(t.price) >= (last || 0)
                                ? "#14c982"
                                : "#f23645",
                            fontWeight: 600,
                          }}
                        >
                          {formatPrice(Number(t.price))}
                        </span>
                        <span style={{ textAlign: "right", color: "#aaa" }}>
                          {Number(t.amount || 0).toFixed(5)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

            </>
          )}
          </div>

          {/* Fixed bottom Buy / Sell — always visible, does not scroll away */}
          {chartTab === "chart" && (
            <div style={S.chartBuySellBar}>
              <button
                type="button"
                style={S.chartBuyBtn}
                onClick={() => {
                  setSide("buy");
                  setViewMode("terminal");
                }}
              >
                Buy
                <span style={S.chartBuySellPrice}>
                  {ask != null
                    ? formatPrice(ask)
                    : last != null
                      ? formatPrice(last)
                      : "—"}
                </span>
              </button>
              <div style={S.chartQtyMid}>
                <div style={{ fontSize: 10, color: "#666" }}>Quantity</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{base}</div>
              </div>
              <button
                type="button"
                style={S.chartSellBtn}
                onClick={() => {
                  setSide("sell");
                  setViewMode("terminal");
                }}
              >
                Sell
                <span style={S.chartBuySellPrice}>
                  {bid != null
                    ? formatPrice(bid)
                    : last != null
                      ? formatPrice(last)
                      : "—"}
                </span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Main terminal: Form (left) + Order Book (right) ── */}
      {viewMode === "terminal" && (
      <div style={S.terminal} className="ceo-fade-in">
        {/* LEFT: Order form */}
        <div style={S.formCol}>
          {/* Buy / Sell segmented */}
          <div style={S.sideRow}>
            <button
              type="button"
              style={{
                ...S.sideBtn,
                ...(side === "buy" ? S.sideBuyOn : {}),
              }}
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
              style={{
                ...S.sideBtn,
                ...(side === "sell" ? S.sideSellOn : {}),
              }}
              onClick={() => {
                setSide("sell");
                setPriceTouched(false);
                setActivePct(null);
              }}
            >
              Sell
            </button>
          </div>

          {/* Available */}
          <div style={S.availRow}>
            <span style={S.availLabel}>Available</span>
            <span style={S.availVal}>
              {wallet.exists ? formatPrice(wallet.available) : "0"} {wallet.asset}
            </span>
          </div>

          {/* Order type dropdown trigger */}
          <button
            type="button"
            style={S.orderTypeTrigger}
            onClick={() => setShowOrderTypeMenu(true)}
            aria-haspopup="listbox"
            aria-expanded={showOrderTypeMenu}
          >
            <span>{orderTypeLabel}</span>
            <span style={S.orderTypeChevron}>{showOrderTypeMenu ? "▴" : "▾"}</span>
          </button>

          {/* Price — hidden for market orders */}
          {orderType !== "market" && (
            <div style={S.field}>
              <span style={S.fieldLabel}>Price</span>
              <input
                style={S.input}
                inputMode="decimal"
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder="0.00"
              />
              <span style={S.suffix}>{quote}</span>
            </div>
          )}
          {orderType === "market" && (
            <div style={S.marketHint}>Market · best available price</div>
          )}

          {/* Quantity */}
          <div style={S.field}>
            <span style={S.fieldLabel}>Quantity</span>
            <input
              style={S.input}
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
            />
            <span style={S.suffix}>{base}</span>
          </div>

          {/* Percentage slider — real interactive control */}
          <div
            ref={pctTrackRef}
            style={S.pctTrack}
            onClick={(e) => onPctTrackPointer(e.clientX)}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              onPctTrackPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) onPctTrackPointer(e.clientX);
            }}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={activePct ?? 0}
            aria-label="Order size percentage"
          >
            <div style={S.pctLine} />
            <div
              style={{
                ...S.pctLineFill,
                width: `${activePct ?? 0}%`,
              }}
            />
            {PCT_STEPS.map((p) => (
              <button
                key={p}
                type="button"
                style={{
                  ...S.pctDot,
                  left: `${p}%`,
                  ...(activePct === p ? S.pctDotOn : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  applyPct(p);
                }}
                aria-label={`${p}%`}
              />
            ))}
          </div>
          <div style={S.pctLabels}>
            {PCT_STEPS.map((p) => (
              <button
                key={p}
                type="button"
                style={{
                  ...S.pctLabel,
                  ...(activePct === p ? S.pctLabelOn : {}),
                }}
                onClick={() => applyPct(p)}
              >
                {p}%
              </button>
            ))}
          </div>

          {/* Order Value */}
          <div style={S.field}>
            <span style={S.fieldLabel}>Order Value</span>
            <input
              style={S.input}
              inputMode="decimal"
              value={orderValue}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="0.00"
            />
            <span style={S.suffix}>{quote}</span>
          </div>

          {/* Max Buy / Sell */}
          <div style={S.maxRow}>
            <span style={S.maxLabel}>
              {side === "buy" ? "Max. Buy" : "Max. Sell"}
            </span>
            <span style={S.maxVal}>
              {side === "buy"
                ? `${maxBuyQty > 0 ? maxBuyQty.toFixed(6) : "0.000000"} ${base}`
                : `${wallet.exists ? formatPrice(wallet.available) : "0"} ${base}`}
            </span>
          </div>

          {/* TP/SL + Post-Only (visual; TP/SL not backed by backend yet) */}
          <div style={S.optRow}>
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={tpSl}
                onChange={(e) => {
                  setTpSl(e.target.checked);
                  if (e.target.checked) {
                    setNotice("TP/SL is coming soon and is not sent with the order.");
                    setNoticeOk(false);
                  }
                }}
                style={S.checkbox}
              />
              TP/SL
            </label>
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={postOnly}
                onChange={(e) => setPostOnly(e.target.checked)}
                style={S.checkbox}
              />
              Post-Only
            </label>
            <span style={S.tifBadge}>GTC ▾</span>
          </div>

          {/* CTA */}
          {!hasSession ? (
            <button
              type="button"
              style={{
                ...S.cta,
                background: "linear-gradient(180deg, #ffca3a, #f5b51b)",
                color: "#111",
              }}
              onClick={() => {
                if (onRequireAuth) onRequireAuth();
                else setNotice("Sign in to place orders.");
              }}
            >
              Log In
            </button>
          ) : (
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
                  ? `Buy ${base}`
                  : `Sell ${base}`}
            </button>
          )}
        </div>

        {/* RIGHT: Order book */}
        <div style={S.bookCol}>
          <div style={S.bookHead}>
            <span>Price</span>
            <span style={{ textAlign: "right" }}>Qty</span>
          </div>
          <div style={S.bookHeadSub}>
            <span>({quote})</span>
            <span style={{ textAlign: "right" }}>({base})</span>
          </div>

          {/* Asks (sell) — red */}
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
                        background: "rgba(239,68,68,0.15)",
                        right: 0,
                        left: "auto",
                      }}
                    />
                    <span style={{ color: "#ef4444", position: "relative", zIndex: 1, fontWeight: 600 }}>
                      {formatPrice(Number(r.price))}
                    </span>
                    <span style={{ position: "relative", zIndex: 1, textAlign: "right", color: "#ccc" }}>
                      {qty ? qty.toFixed(4) : "—"}
                    </span>
                  </button>
                );
              })}

              {/* Mid / last price */}
              <div
                style={{
                  ...S.midPrice,
                  color:
                    flash === "up"
                      ? "#22c55e"
                      : flash === "down"
                        ? "#ef4444"
                        : "#f5f5f5",
                }}
              >
                {last != null ? formatPrice(last) : loading ? "…" : "—"}
                <span style={S.midApprox}>
                  ≈ {last != null ? formatPrice(last) : "—"} USD
                </span>
              </div>

              {/* Bids (buy) — green */}
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
                        background: "rgba(34,197,94,0.15)",
                        right: 0,
                        left: "auto",
                      }}
                    />
                    <span style={{ color: "#22c55e", position: "relative", zIndex: 1, fontWeight: 600 }}>
                      {formatPrice(Number(r.price))}
                    </span>
                    <span style={{ position: "relative", zIndex: 1, textAlign: "right", color: "#ccc" }}>
                      {qty ? qty.toFixed(4) : "—"}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* B/S depth bar */}
          <div style={S.depthRatio}>
            <span style={S.depthBuy}>B {bookRatio.buy}%</span>
            <div style={S.depthBarTrack}>
              <div
                style={{
                  ...S.depthBarFill,
                  width: `${bookRatio.buy}%`,
                  background: "#22c55e",
                }}
              />
              <div
                style={{
                  ...S.depthBarFill,
                  width: `${bookRatio.sell}%`,
                  background: "#ef4444",
                }}
              />
            </div>
            <span style={S.depthSell}>S {bookRatio.sell}%</span>
          </div>

          {/* Compact book controls */}
          <div style={S.bookControls}>
            <select style={S.bookSelect} defaultValue="0.1" aria-label="Tick size">
              <option value="0.1">0.1</option>
              <option value="1">1</option>
              <option value="10">10</option>
            </select>
            <button type="button" style={S.bookIconBtn} onClick={() => setMicro("book")}>
              ≡
            </button>
          </div>
        </div>
      </div>
      )}

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

      {/* ── Bottom tabs ── */}
      <section style={S.bottomZone}>
        <div style={S.bottomTabs}>
          {(
            [
              { id: "orders", label: `Orders(${openOrders.length})` },
              { id: "positions", label: "Positions(0)" },
              { id: "assets", label: "Assets" },
              { id: "borrowings", label: "Borrowings(0)" },
            ] as { id: BottomTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              style={{
                ...S.bottomTab,
                ...(bottom === t.id ? S.bottomTabOn : {}),
              }}
              onClick={() => switchBottomTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={S.bottomFilter}>
          <label style={S.checkLabel}>
            <input type="checkbox" defaultChecked style={S.checkbox} />
            All Markets
          </label>
        </div>

        {/* Content by tab — smooth enter */}
        {bottom === "orders" && (
          <div style={S.list} className={tabAnim ? "ceo-tab-enter" : undefined}>
            {openOrders.length === 0 && historyOrders.length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>📄</div>
                <div style={S.emptyText}>No Available Data</div>
              </div>
            ) : (
              <>
                {openOrders.length > 0 && (
                  <>
                    <div style={S.subHead}>Open</div>
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
                        <div style={{ display: "flex", gap: 6 }}>
                          {(o.order_type || "").toLowerCase() !== "market" && (
                            <button
                              type="button"
                              style={S.cancelBtn}
                              disabled={cancellingId === o.id}
                              onClick={() => {
                                setModifyTarget(o);
                                setModifyPrice(
                                  o.price != null ? String(o.price) : "",
                                );
                                setModifyAmount(String(o.amount ?? ""));
                              }}
                            >
                              Modify
                            </button>
                          )}
                          <button
                            type="button"
                            style={S.cancelBtn}
                            disabled={cancellingId === o.id}
                            onClick={() => void cancelOrder(o.id)}
                          >
                            {cancellingId === o.id ? "…" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {historyOrders.length > 0 && (
                  <>
                    <div style={S.subHead}>History</div>
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
                  </>
                )}
              </>
            )}
          </div>
        )}

        {bottom === "positions" && (
          <div
            style={S.emptyState}
            className={tabAnim ? "ceo-tab-enter" : undefined}
          >
            <div style={S.emptyIcon}>📄</div>
            <div style={S.emptyText}>No Available Data</div>
          </div>
        )}

        {bottom === "assets" && (
          <div style={S.list} className={tabAnim ? "ceo-tab-enter" : undefined}>
            {wallets.filter(
              (w) => Number(w.balance) > 0 || Number(w.locked_balance) > 0,
            ).length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>📄</div>
                <div style={S.emptyText}>No Available Data</div>
              </div>
            ) : (
              wallets
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
                })
            )}
          </div>
        )}

        {bottom === "borrowings" && (
          <div
            style={S.emptyState}
            className={tabAnim ? "ceo-tab-enter" : undefined}
          >
            <div style={S.emptyIcon}>📄</div>
            <div style={S.emptyText}>No Available Data</div>
          </div>
        )}
      </section>

      <div style={{ height: 20 }} />

      {/* Order type dropdown — matches reference sheet */}
      {showOrderTypeMenu && (
        <div
          style={S.orderTypeBackdrop}
          onClick={() => setShowOrderTypeMenu(false)}
          className="ceo-menu-backdrop"
        >
          <div
            style={S.orderTypeMenu}
            onClick={(e) => e.stopPropagation()}
            className="ceo-menu-panel"
            role="listbox"
            aria-label="Order type"
          >
            {ORDER_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={orderType === opt.id}
                style={{
                  ...S.orderTypeItem,
                  ...(orderType === opt.id ? S.orderTypeItemOn : {}),
                  ...(!opt.supported ? S.orderTypeItemDisabled : {}),
                }}
                onClick={() => selectOrderType(opt.id)}
              >
                <span>{opt.label}</span>
                {!opt.supported && (
                  <span style={S.comingSoon}>Soon</span>
                )}
              </button>
            ))}
            <div style={S.orderTypeDivider} />
            <button
              type="button"
              style={S.orderTypeAbout}
              onClick={() => {
                setShowOrderTypeMenu(false);
                setNotice(
                  "Limit and Market are live. Advanced types (TP/SL, OCO, TWAP, etc.) are coming soon.",
                );
                setNoticeOk(true);
              }}
            >
              About order types
              <span style={{ marginLeft: 6 }}>↗</span>
            </button>
          </div>
        </div>
      )}

      {/* Modify order sheet — real bybit-private amend */}
      {modifyTarget && (
        <div
          style={S.sheet}
          onClick={() => {
            if (cancellingId !== modifyTarget.id) setModifyTarget(null);
          }}
        >
          <div style={S.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Modify order</div>
            <div style={{ fontSize: 13, color: "#848e9c", marginBottom: 12 }}>
              {(modifyTarget.side || "").toUpperCase()}{" "}
              {modifyTarget.order_type} · {modifyTarget.trading_pair}
            </div>
            <label style={{ display: "block", fontSize: 12, color: "#848e9c" }}>
              Price
            </label>
            <input
              style={{
                width: "100%",
                boxSizing: "border-box",
                margin: "6px 0 12px",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "#eee",
                fontSize: 15,
              }}
              inputMode="decimal"
              value={modifyPrice}
              onChange={(e) => setModifyPrice(e.target.value)}
            />
            <label style={{ display: "block", fontSize: 12, color: "#848e9c" }}>
              Amount
            </label>
            <input
              style={{
                width: "100%",
                boxSizing: "border-box",
                margin: "6px 0 16px",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "#eee",
                fontSize: 15,
              }}
              inputMode="decimal"
              value={modifyAmount}
              onChange={(e) => setModifyAmount(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{
                  ...S.tfChip,
                  flex: 1,
                  justifyContent: "center",
                  padding: 12,
                }}
                disabled={cancellingId === modifyTarget.id}
                onClick={() => setModifyTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  border: 0,
                  borderRadius: 10,
                  background: "#f0b90b",
                  color: "#111",
                  fontWeight: 700,
                  padding: 12,
                  cursor: "pointer",
                  opacity: cancellingId === modifyTarget.id ? 0.6 : 1,
                }}
                disabled={cancellingId === modifyTarget.id}
                onClick={async () => {
                  const px = Number(modifyPrice);
                  const amt = Number(modifyAmount);
                  const ok = await modifyOrder(
                    modifyTarget.id,
                    px,
                    Number.isFinite(amt) && amt > 0 ? amt : undefined,
                  );
                  if (ok) setModifyTarget(null);
                }}
              >
                {cancellingId === modifyTarget.id ? "…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Settings — real toggles */}
      {showChartSettings && (
        <div style={S.sheet} onClick={() => setShowChartSettings(false)}>
          <div
            style={{ ...S.sheetCard, maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={S.sheetTitle}>Chart Settings</div>
            <div style={{ color: "#848e9c", fontSize: 12, marginBottom: 8 }}>
              Chart Display
            </div>
            {(
              [
                ["lastTradedPrice", "Last Traded Price"],
                ["grid", "Grid"],
                ["maxPrice", "Max Price"],
                ["minPrice", "Min Price"],
                ["countdown", "Countdown"],
              ] as [keyof ChartDisplaySettings, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #1a1a1a",
                  fontSize: 14,
                }}
              >
                {label}
                <input
                  type="checkbox"
                  checked={chartDisplay[key]}
                  onChange={(e) =>
                    setChartDisplay((d) => ({ ...d, [key]: e.target.checked }))
                  }
                />
              </label>
            ))}
            <div
              style={{
                color: "#848e9c",
                fontSize: 12,
                margin: "14px 0 8px",
              }}
            >
              Order Display (from your real orders)
            </div>
            {(
              [
                [
                  showTradeHistoryOnChart,
                  setShowTradeHistoryOnChart,
                  "Trade History markers",
                ],
                [
                  showCurrentOrdersOnChart,
                  setShowCurrentOrdersOnChart,
                  "Current Orders levels",
                ],
                [
                  showAvgBuyOnChart,
                  setShowAvgBuyOnChart,
                  `Avg. Buy${avgFills.avgBuy != null ? ` (${formatPrice(avgFills.avgBuy)})` : " (no fills)"}`,
                ],
                [
                  showAvgSellOnChart,
                  setShowAvgSellOnChart,
                  `Avg. Sell${avgFills.avgSell != null ? ` (${formatPrice(avgFills.avgSell)})` : " (no fills)"}`,
                ],
              ] as [boolean, (v: boolean) => void, string][]
            ).map(([checked, set, label], i) => (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #1a1a1a",
                  fontSize: 14,
                }}
              >
                {label}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => set(e.target.checked)}
                />
              </label>
            ))}
            <div
              style={{
                color: "#666",
                fontSize: 11,
                marginTop: 8,
                lineHeight: 1.4,
              }}
            >
              Place / Cancel / Modify use bybit-private. Chart open-order
              levels refresh from live orders after modify. Customize
              Buy/Sell Mode still needs a product decision.
            </div>
            <div
              style={{
                color: "#848e9c",
                fontSize: 12,
                margin: "14px 0 8px",
              }}
            >
              Chart Height
            </div>
            <input
              type="range"
              min={240}
              max={560}
              step={10}
              value={chartHeight}
              onChange={(e) => setChartHeight(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              {chartHeight}px
            </div>
            <button
              type="button"
              style={{
                ...S.tfChip,
                marginTop: 16,
                width: "100%",
                justifyContent: "center",
                padding: 12,
              }}
              onClick={() => setShowChartSettings(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Jump to Date — real viewport jump on loaded candles */}
      {showDateJump && (
        <div style={S.sheet} onClick={() => setShowDateJump(false)}>
          <div style={S.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Jump to Date</div>
            <div style={{ color: "#848e9c", fontSize: 12, marginBottom: 8 }}>
              Select Date
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="date"
                value={jumpDate}
                onChange={(e) => setJumpDate(e.target.value)}
                style={{
                  flex: 1,
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  color: "#eee",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              />
              <input
                type="time"
                value={jumpTime}
                onChange={(e) => setJumpTime(e.target.value)}
                style={{
                  width: 110,
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  color: "#eee",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{
                  ...S.tfChip,
                  flex: 1,
                  justifyContent: "center",
                  padding: 12,
                }}
                onClick={() => {
                  chartApiRef.current?.resetView();
                  setShowDateJump(false);
                }}
              >
                Reset
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  border: 0,
                  borderRadius: 10,
                  background: "#f0b90b",
                  color: "#111",
                  fontWeight: 700,
                  padding: 12,
                  cursor: "pointer",
                }}
                onClick={async () => {
                  const iso = `${jumpDate}T${jumpTime}:00`;
                  // Always try to load real historical klines around the target
                  setNotice("Loading historical candles…");
                  setNoticeOk(true);
                  const loaded = await loadHistoryAround(iso);
                  // Give React a tick to push new candles into the chart
                  await new Promise((r) => setTimeout(r, 120));
                  const ok = chartApiRef.current?.jumpToDate(iso);
                  if (!ok && !loaded) {
                    setNotice(
                      "Could not load candles for that date from Bybit. Try another date or timeframe.",
                    );
                    setNoticeOk(false);
                  } else {
                    setNotice(
                      loaded
                        ? "Jumped to selected date (historical data loaded)."
                        : "Jumped within already-loaded candles.",
                    );
                    setNoticeOk(true);
                  }
                  setShowDateJump(false);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Others — chart style (real) */}
      {showOthers && (
        <div style={S.sheet} onClick={() => setShowOthers(false)}>
          <div style={S.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Chart Style</div>
            {(
              [
                ["candlestick", "Candlestick"],
                ["line", "Line"],
              ] as [ChartStyle, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  border: 0,
                  borderBottom: "1px solid #1a1a1a",
                  background: "transparent",
                  color: "#eee",
                  fontSize: 14,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setChartStyle(id);
                  setShowOthers(false);
                }}
              >
                {label}
                {chartStyle === id ? (
                  <span style={{ color: "#f0b90b" }}>✓</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeframe More sheet — real intervals only */}
      {showMoreTf && (
        <div style={S.sheet} onClick={() => setShowMoreTf(false)}>
          <div style={S.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Select timeframe</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                padding: "8px 0 12px",
              }}
            >
              {TFS_ALL.map((t) => (
                <button
                  key={t}
                  type="button"
                  style={{
                    ...S.tfChip,
                    padding: "10px 0",
                    justifyContent: "center",
                    ...(tf === t ? S.tfActive : {}),
                  }}
                  onClick={() => {
                    setTf(t);
                    setShowMoreTf(false);
                  }}
                >
                  {t === "1d" ? "1D" : t === "1w" ? "1W" : t === "1M" ? "1M" : t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <b>{orderType === "market" ? "Market" : "Limit"}</b>
              {orderType !== "market" && (
                <>
                  <span>Price</span>
                  <b>
                    {formatPrice(np)} {quote}
                  </b>
                </>
              )}
              <span>Quantity</span>
              <b>
                {na} {base}
              </b>
              <span>Total</span>
              <b>
                {formatPrice(
                  orderType === "market" && (ask ?? last)
                    ? (ask ?? last ?? 0) * na
                    : total,
                )}{" "}
                {quote}
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
    minHeight: "100dvh",
    background: "#0a0a0a",
    color: "#eee",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    overflowX: "hidden",
    // Extra bottom space so fixed Buy/Sell never covers last rows
    paddingBottom: 72,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    paddingTop: "calc(8px + env(safe-area-inset-top))",
    borderBottom: "1px solid #1a1a1a",
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(10,10,10,0.95)",
    backdropFilter: "blur(12px)",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#f5f5f5",
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 36,
    height: 36,
    border: 0,
    borderRadius: 8,
    background: "transparent",
    color: "#ccc",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pairRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px 6px",
    flexWrap: "wrap",
  },
  pairSelect: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    border: 0,
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    padding: 0,
  },
  pairSym: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  chev: {
    color: "#888",
    fontSize: 11,
  },
  changePct: {
    fontSize: 13,
    fontWeight: 600,
  },
  pairControls: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  mmBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.4)",
    borderRadius: 4,
    padding: "1px 5px",
  },
  mmPct: {
    fontSize: 11,
    color: "#888",
  },
  segControl: {
    display: "inline-flex",
    alignItems: "center",
    background: "#141416",
    borderRadius: 22,
    padding: 3,
    gap: 1,
    border: "none",
    height: 34,
  },
  segBtn: {
    width: 36,
    height: 28,
    border: 0,
    borderRadius: 15,
    background: "transparent",
    color: "#6b6b6b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.18s ease, color 0.18s ease",
    padding: 0,
    flexShrink: 0,
  },
  segBtnOn: {
    background: "#2c2c30",
    color: "#ffffff",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "inline-block",
  },
  favBtn: {
    width: 28,
    height: 28,
    border: 0,
    background: "transparent",
    color: "#f5b51b",
    fontSize: 16,
    cursor: "pointer",
  },
  orderTypeTrigger: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "#121214",
    border: "1px solid #1c1c1f",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 6,
    color: "#eee",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  orderTypeChevron: {
    color: "#888",
    fontSize: 11,
  },
  marketHint: {
    fontSize: 11,
    color: "#888",
    padding: "6px 4px 8px",
  },
  orderTypeBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 60,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "22%",
  },
  orderTypeMenu: {
    width: "min(320px, 88vw)",
    background: "#1a1a1e",
    borderRadius: 12,
    border: "1px solid #2a2a2e",
    padding: "6px 0",
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
    maxHeight: "70vh",
    overflowY: "auto",
  },
  orderTypeItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#ddd",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
  },
  orderTypeItemOn: {
    color: "#f5b51b",
    fontWeight: 700,
  },
  orderTypeItemDisabled: {
    color: "#666",
  },
  comingSoon: {
    fontSize: 10,
    color: "#555",
    border: "1px solid #333",
    borderRadius: 4,
    padding: "1px 6px",
  },
  orderTypeDivider: {
    height: 1,
    background: "#2a2a2e",
    margin: "4px 12px",
  },
  orderTypeAbout: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#888",
    padding: "12px 16px",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
  },
  chartZone: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    padding: 0,
    borderBottom: "1px solid #141414",
  },
  chartScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    background: "#0a0a0a",
    // Space for fixed compact Buy/Sell bar
    paddingBottom: 64,
  },
  chartMainTabs: {
    display: "flex",
    gap: 16,
    padding: "4px 12px 0",
    borderBottom: "1px solid #1a1a1a",
  },
  chartMainTab: {
    border: 0,
    background: "transparent",
    color: "#777",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 0 10px",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
  },
  chartMainTabOn: {
    color: "#f5f5f5",
    borderBottomColor: "#f5b51b",
  },
  chartPriceHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "10px 12px 6px",
  },
  chartLastPrice: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -0.5,
    lineHeight: 1.15,
    transition: "color 0.2s ease",
  },
  chartLastSub: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  chartStats: {
    textAlign: "right",
    fontSize: 11,
    color: "#aaa",
  },
  chartStatRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginBottom: 2,
  },
  chartStatLabel: {
    color: "#555",
  },
  tfRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px 6px",
    overflowX: "auto",
  },
  tfLabel: {
    fontSize: 11,
    color: "#666",
    marginRight: 2,
  },
  tfChip: {
    border: "1px solid #1c1c1f",
    background: "#0e0e10",
    color: "#888",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  tfActive: {
    borderColor: "#2a2110",
    color: "#f5b51b",
    background: "rgba(245,181,27,0.08)",
  },
  maLegend: {
    display: "flex",
    gap: 12,
    padding: "0 12px 6px",
    fontSize: 10,
    fontWeight: 600,
    flexWrap: "wrap",
  },
  chartBox: {
    margin: "0",
    overflow: "hidden",
    background: "#000",
  },
  chartEmpty: {
    height: 320,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
    fontSize: 12,
  },
  indRow: {
    display: "flex",
    gap: 4,
    padding: "6px 8px",
    overflowX: "auto",
    borderTop: "1px solid #141414",
  },
  indChip: {
    border: 0,
    background: "transparent",
    color: "#777",
    fontSize: 11,
    fontWeight: 600,
    padding: "6px 8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  indChipOn: {
    color: "#f5b51b",
  },
  chartBookWrap: {
    padding: "4px 8px 8px",
  },
  chartBookGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  chartBookCol: {},
  chartBookHead: {
    fontSize: 11,
    color: "#666",
    fontWeight: 600,
    marginBottom: 4,
  },
  chartBookRow: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    border: 0,
    background: "transparent",
    padding: "3px 0",
    fontSize: 11,
    cursor: "pointer",
  },
  tapeList: {
    padding: "4px 12px 8px",
    maxHeight: 200,
    overflowY: "auto",
  },
  tapeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    fontSize: 11,
    padding: "4px 0",
    color: "#ccc",
  },
  chartBuySellBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    paddingBottom: "max(8px, env(safe-area-inset-bottom))",
    borderTop: "1px solid #1a1a1a",
    background: "#0a0a0a",
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 480,
    margin: "0 auto",
    zIndex: 40,
    boxSizing: "border-box",
  },
  chartBuyBtn: {
    flex: 1,
    border: 0,
    borderRadius: 22,
    background: "#14c982",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    padding: "8px 8px 6px",
    minHeight: 44,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  chartSellBtn: {
    flex: 1,
    border: 0,
    borderRadius: 22,
    background: "#f23645",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    padding: "8px 8px 6px",
    minHeight: 44,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  chartBuySellPrice: {
    fontSize: 11,
    fontWeight: 600,
    opacity: 0.95,
  },
  chartQtyMid: {
    textAlign: "center",
    minWidth: 56,
  },
  overviewPanel: {
    minHeight: 280,
  },
  microTabs: {
    display: "flex",
    gap: 16,
    padding: "8px 12px 4px",
    borderTop: "1px solid #141414",
  },
  microTab: {
    border: 0,
    background: "transparent",
    color: "#777",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 0",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
  },
  microTabOn: {
    color: "#f5f5f5",
    borderBottomColor: "#f5b51b",
  },
  terminal: {
    display: "flex",
    gap: 0,
    padding: "8px 8px 0",
    minHeight: 380,
  },
  formCol: {
    flex: "1 1 52%",
    minWidth: 0,
    paddingRight: 8,
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  bookCol: {
    flex: "1 1 48%",
    minWidth: 0,
    borderLeft: "1px solid #1a1a1a",
    paddingLeft: 6,
    display: "flex",
    flexDirection: "column",
  },
  sideRow: {
    display: "flex",
    gap: 0,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #1c1c1f",
  },
  sideBtn: {
    flex: 1,
    border: 0,
    background: "#121214",
    color: "#777",
    padding: "9px 0",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  sideBuyOn: {
    background: "#16a34a",
    color: "#fff",
  },
  sideSellOn: {
    background: "#dc2626",
    color: "#fff",
  },
  availRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    fontSize: 11,
  },
  availLabel: { color: "#777" },
  availVal: { color: "#ccc", fontWeight: 600 },
  typeSelect: {
    display: "flex",
    gap: 0,
    marginBottom: 8,
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid #1c1c1f",
  },
  typeBtn: {
    flex: 1,
    border: 0,
    background: "#0e0e10",
    color: "#777",
    padding: "7px 0",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  typeBtnOn: {
    background: "#1a1a1e",
    color: "#f5f5f5",
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#121214",
    border: "1px solid #1c1c1f",
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    color: "#777",
    minWidth: 52,
    flexShrink: 0,
  },
  input: {
    border: 0,
    background: "transparent",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    outline: "none",
    width: "100%",
    minWidth: 0,
  },
  suffix: {
    color: "#666",
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
  pctTrack: {
    position: "relative",
    height: 28,
    margin: "4px 2px 0",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
  },
  pctLine: {
    position: "absolute",
    left: 6,
    right: 6,
    top: "50%",
    height: 2,
    marginTop: -1,
    background: "#2a2a2e",
    borderRadius: 1,
    pointerEvents: "none",
  },
  pctLineFill: {
    position: "absolute",
    left: 6,
    top: "50%",
    height: 2,
    marginTop: -1,
    background: "#f5b51b",
    borderRadius: 1,
    pointerEvents: "none",
    transition: "width 0.15s ease",
  },
  pctDot: {
    position: "absolute",
    top: "50%",
    width: 14,
    height: 14,
    marginTop: -7,
    marginLeft: -7,
    borderRadius: "50%",
    border: "2px solid #444",
    background: "#0a0a0a",
    cursor: "pointer",
    padding: 0,
    zIndex: 2,
    transition: "border-color 0.15s ease, background 0.15s ease, transform 0.15s ease",
  },
  pctDotOn: {
    borderColor: "#f5b51b",
    background: "#f5b51b",
    transform: "scale(1.15)",
  },
  pctLabels: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 2,
  },
  pctLabel: {
    border: 0,
    background: "transparent",
    color: "#555",
    fontSize: 10,
    cursor: "pointer",
    padding: "2px 0",
    transition: "color 0.15s ease",
  },
  pctLabelOn: {
    color: "#f5b51b",
    fontWeight: 700,
  },
  maxRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    marginBottom: 8,
    color: "#777",
  },
  maxLabel: {},
  maxVal: { color: "#aaa" },
  optRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#aaa",
    cursor: "pointer",
  },
  checkbox: {
    width: 14,
    height: 14,
    accentColor: "#f5b51b",
  },
  tifBadge: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#888",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    padding: "2px 6px",
  },
  cta: {
    width: "100%",
    border: 0,
    borderRadius: 10,
    padding: "12px 0",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 2,
  },
  bookHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    fontSize: 10,
    color: "#666",
    padding: "2px 4px",
    fontWeight: 600,
  },
  bookHeadSub: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    fontSize: 9,
    color: "#444",
    padding: "0 4px 4px",
  },
  bookRow: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#ccc",
    fontSize: 11,
    padding: "3px 4px",
    textAlign: "left",
    cursor: "pointer",
    lineHeight: 1.35,
  },
  depthBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 0,
    transition: "width 0.2s ease-out",
  },
  midPrice: {
    textAlign: "left",
    fontSize: 14,
    fontWeight: 800,
    padding: "6px 4px",
    letterSpacing: -0.3,
    transition: "color 0.2s ease",
  },
  midApprox: {
    display: "block",
    fontSize: 10,
    fontWeight: 500,
    color: "#666",
    marginTop: 1,
  },
  depthRatio: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 4px 4px",
    fontSize: 10,
    fontWeight: 700,
  },
  depthBuy: { color: "#22c55e", minWidth: 36 },
  depthSell: { color: "#ef4444", minWidth: 36, textAlign: "right" },
  depthBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    display: "flex",
    background: "#1a1a1a",
  },
  depthBarFill: {
    height: "100%",
  },
  bookControls: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 4px 2px",
    marginTop: "auto",
  },
  bookSelect: {
    background: "#121214",
    border: "1px solid #1c1c1f",
    color: "#ccc",
    borderRadius: 4,
    fontSize: 11,
    padding: "3px 6px",
  },
  bookIconBtn: {
    border: "1px solid #1c1c1f",
    background: "#121214",
    color: "#888",
    borderRadius: 4,
    width: 26,
    height: 26,
    fontSize: 14,
    cursor: "pointer",
  },
  notice: {
    margin: "8px 12px",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 12,
  },
  bottomZone: {
    marginTop: 4,
    borderTop: "1px solid #1a1a1a",
    padding: "0 0 8px",
  },
  bottomTabs: {
    display: "flex",
    gap: 0,
    overflowX: "auto",
    borderBottom: "1px solid #1a1a1a",
    padding: "0 8px",
  },
  bottomTab: {
    border: 0,
    background: "transparent",
    color: "#777",
    padding: "10px 10px 8px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderBottom: "2px solid transparent",
  },
  bottomTabOn: {
    color: "#f5f5f5",
    borderBottomColor: "#f5b51b",
  },
  bottomFilter: {
    padding: "8px 12px 4px",
    fontSize: 11,
  },
  list: {
    padding: "4px 12px 8px",
  },
  subHead: {
    fontSize: 10,
    color: "#666",
    fontWeight: 700,
    margin: "8px 0 4px",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  orderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #141416",
    fontSize: 12,
  },
  orderMeta: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },
  cancelBtn: {
    border: "1px solid #333",
    background: "transparent",
    color: "#ccc",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    cursor: "pointer",
  },
  assetRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #141416",
    fontSize: 12,
  },
  emptyMini: {
    padding: "12px 4px",
    textAlign: "center",
    color: "#555",
    fontSize: 11,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 16px",
    minHeight: 140,
  },
  emptyIcon: {
    fontSize: 36,
    opacity: 0.35,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#555",
  },
  sheet: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    zIndex: 50,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheetCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "78vh",
    background: "#0e0e11",
    borderRadius: "16px 16px 0 0",
    border: "1px solid #1c1c1f",
    padding: 16,
    overflow: "auto",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 12,
  },
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
  * { box-sizing: border-box; }
  button:active { transform: scale(0.98); }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

  .ceo-fade-in {
    animation: ceoFadeIn 0.2s ease both;
  }
  .ceo-tab-enter {
    animation: ceoTabEnter 0.22s ease both;
  }
  .ceo-menu-backdrop {
    animation: ceoFadeIn 0.18s ease both;
  }
  .ceo-menu-panel {
    animation: ceoMenuUp 0.2s ease both;
  }

  @keyframes ceoFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes ceoTabEnter {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ceoMenuUp {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ceo-fade-in,
    .ceo-tab-enter,
    .ceo-menu-backdrop,
    .ceo-menu-panel {
      animation: none !important;
    }
  }
`;
