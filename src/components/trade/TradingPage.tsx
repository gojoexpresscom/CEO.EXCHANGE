import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import TradingChart, { computeMALegend } from "./TradingChart";
import { useBybitMarketData } from "../../trading/useBybitMarketData";

type Props = { symbol?: string; onBack?: () => void; onAddFunds?: () => void };

type Pair = {
  id: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  is_active: boolean;
};

type Ticker = {
  symbol: string;
  last_price: number | null;
  bid_price: number | null;
  ask_price: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume_24h: number | null;
  change_24h: number | null;
};

type Candle = {
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type BookRow = {
  side: "buy" | "sell";
  price: number;
  amount: number;
  filled_amount: number;
};

type Wallet = {
  asset: string;
  balance: number;
  locked_balance: number;
  escrow_balance: number;
  wallet_type: string;
  account_type?: string | null;
  status?: string | null;
};

type Order = {
  id: string;
  user_id: string;
  trading_pair: string;
  side: "buy" | "sell";
  order_type: string;
  price: number;
  amount: number;
  filled_amount: number;
  status: string;
  created_at: string;
};

type RecentTrade = {
  id: string;
  trading_pair?: string;
  price: number;
  amount: number;
  created_at: string;
  side?: string;
};

type ViewMode = "standard" | "terminal";
type ContentTab = "chart" | "overview" | "data" | "feed";
type MarketTab = "chart" | "book" | "trades";
type BottomTab = "orders" | "positions" | "assets" | "borrowings" | "tx";
type KeypadField = "price" | "qty" | "value" | null;

type HotMarket = {
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  change: number | null;
  market_cap_rank: number;
  image?: string;
};

type AccountTab = "spot" | "futures" | "funding";

function routeSymbol() {
  try {
    const m = window.location.pathname.match(/^\/trade\/(.+)$/i);
    return m ? decodeURIComponent(m[1]).toUpperCase() : "";
  } catch {
    return "";
  }
}

function decimalsForTick(tick: number) {
  if (!Number.isFinite(tick) || tick <= 0) return 2;
  const s = tick.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function baseTickFor(price: number | null | undefined) {
  if (price == null || !Number.isFinite(price) || price <= 0) return 0.1;
  if (price >= 1000) return 0.1;
  if (price >= 100) return 0.01;
  if (price >= 1) return 0.001;
  if (price >= 0.01) return 0.0001;
  return 0.000001;
}

/** Real aggregation of real book levels — rounds to tick and sums quantities. */
function groupLevels(
  rows: { price: number; amt: number }[],
  tick: number,
  dir: "bid" | "ask"
) {
  const map = new Map<number, number>();
  for (const r of rows) {
    if (r.amt <= 0) continue;
    const bucket = tick > 0 ? Math.round(r.price / tick) * tick : r.price;
    map.set(bucket, (map.get(bucket) || 0) + r.amt);
  }
  const arr = Array.from(map.entries()).map(([price, amt]) => ({ price, amt }));
  arr.sort((a, b) => (dir === "ask" ? a.price - b.price : b.price - a.price));
  return arr;
}


const TF = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
] as const;

const CANCELLABLE = new Set(["open", "partially_filled"]);

function fmt(v: number | null | undefined, d = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}

function fmtPrice(v: number | null | undefined, decimals?: number) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (decimals != null) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  const a = Math.abs(v);
  const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(d, 2),
    maximumFractionDigits: d,
  });
}

function fmtQty(v: number | null | undefined, decimals = 4) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function fixedDec(v: number, d: number) {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export default function TradingPage({
  symbol: initialSymbol,
  onBack,
  onAddFunds,
}: Props) {
  const [symbol, setSymbol] = useState((initialSymbol || routeSymbol() || "BTC/USDT").toUpperCase());
  const [pair, setPair] = useState<Pair | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  const [contentTab, setContentTab] = useState<ContentTab>("chart");
  const [marketTab, setMarketTab] = useState<MarketTab>("chart");
  const [bottomTab, setBottomTab] = useState<BottomTab>("orders");
  const [orderTab, setOrderTab] = useState<"open" | "history">("open");

  const [tf, setTf] = useState<string>("15m");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [p, setP] = useState("");
  const [amount, setAmount] = useState("");
  const [orderValue, setOrderValue] = useState("");
  const [activePct, setActivePct] = useState<number | null>(null);
  const [priceTouched, setPriceTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeOk, setNoticeOk] = useState(false);
  const [showMarkets, setShowMarkets] = useState(false);
  const [marketsFilter, setMarketsFilter] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [keypadField, setKeypadField] = useState<KeypadField>(null);
  const [bookPrecision, setBookPrecision] = useState(1);
  const [accountTab, setAccountTab] = useState<AccountTab>("spot");
  const [allMarketsOrders, setAllMarketsOrders] = useState(false);
  const [hotMarkets, setHotMarkets] = useState<HotMarket[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAsset, setTransferAsset] = useState("");
  const [transferDirection, setTransferDirection] = useState<"from_spot" | "to_spot">("from_spot");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [precisionIdx, setPrecisionIdx] = useState(0);


  const {
    ticker,
    candles,
    book,
    trades,
    status: bybitStatus,
  } = useBybitMarketData(
    pair?.base_asset ?? null,
    pair?.quote_asset ?? null,
    tf
  ) as {
    ticker: Ticker | null;
    candles: Candle[];
    book: BookRow[];
    trades: RecentTrade[];
    status: string;
  };

  const loadPair = useCallback(async (sym: string) => {
    setLoading(true);
    setNotice(null);
    const [{ data: one }, { data: all }] = await Promise.all([
      supabase
        .from("trading_pairs")
        .select("id,symbol,base_asset,quote_asset,is_active")
        .eq("symbol", sym)
        .maybeSingle(),
      supabase
        .from("trading_pairs")
        .select("id,symbol,base_asset,quote_asset,is_active")
        .eq("is_active", true)
        .order("symbol")
        .limit(500),
    ]);
    setPairs((all as Pair[]) || []);
    if (one) {
      setPair(one as Pair);
      setSymbol((one as Pair).symbol);
    } else {
      const compact = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const found = ((all as Pair[]) || []).find(
        (x) =>
          x.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase() === compact ||
          `${x.base_asset}${x.quote_asset}`.toUpperCase() === compact
      );
      setPair(found || null);
      if (found) setSymbol(found.symbol);
    }
    setLoading(false);
  }, []);

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setWallets([]);
      setOrders([]);
      return;
    }
    const [{ data: w }, { data: o }] = await Promise.all([
      supabase
        .from("wallets")
        .select(
          "asset,balance,locked_balance,escrow_balance,wallet_type,account_type,status"
        )
        .eq("user_id", user.id),
      supabase
        .from("orders")
        .select(
          "id,user_id,trading_pair,side,order_type,price,amount,filled_amount,status,created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setWallets((w as Wallet[]) || []);
    setOrders((o as Order[]) || []);
  }, []);

  useEffect(() => {
    void loadPair(symbol);
  }, [symbol, loadPair]);

  useEffect(() => {
    setPrecisionIdx(0);
  }, [pair?.symbol]);


  const loadHot = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false"
      );
      if (!res.ok) return;
      const cg = (await res.json()) as Array<{
        symbol: string;
        market_cap_rank: number;
        image: string;
      }>;
      const our =
        pairs.length > 0
          ? pairs
          : ((
              await supabase
                .from("trading_pairs")
                .select("id,symbol,base_asset,quote_asset,is_active")
                .eq("is_active", true)
                .limit(300)
            ).data as Pair[]) || [];
      const matched: HotMarket[] = [];
      for (const coin of cg) {
        const sym = (coin.symbol || "").toUpperCase();
        const candidates = our.filter(
          (p) =>
            p.base_asset.toUpperCase() === sym &&
            (p.quote_asset === "USDT" ||
              p.quote_asset === "USD" ||
              p.quote_asset === "USDC")
        );
        const pick =
          candidates.find((c) => c.quote_asset === "USDT") || candidates[0];
        if (!pick) continue;
        matched.push({
          symbol: pick.symbol,
          base: pick.base_asset,
          quote: pick.quote_asset,
          price: null,
          change: null,
          market_cap_rank: coin.market_cap_rank,
          image: coin.image,
        });
        if (matched.length >= 40) break;
      }
      if (matched.length) {
        const { data: ticks } = await supabase
          .from("market_tickers")
          .select("symbol,last_price,change_24h")
          .in(
            "symbol",
            matched.map((m) => m.symbol)
          );
        const map = new Map(
          (ticks || []).map((t: { symbol: string; last_price: number; change_24h: number }) => [
            t.symbol,
            t,
          ])
        );
        for (const m of matched) {
          const t = map.get(m.symbol);
          if (t) {
            m.price = t.last_price;
            m.change = t.change_24h;
          }
        }
      }
      setHotMarkets(matched);
    } catch (e) {
      console.error("Hot markets load failed", e);
    }
  }, [pairs]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (pairs.length) void loadHot();
  }, [pairs, loadHot]);

  useEffect(() => {
    if (ticker?.last_price != null && !priceTouched && !p) {
      setP(String(ticker.last_price));
    }
  }, [ticker?.last_price, priceTouched, p]);

  useEffect(() => {
    const ch = supabase
      .channel("trade-page-account")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void loadUser()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        () => void loadUser()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pair) {
        setFavorite(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("market_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("trading_pair_id", pair.id)
        .maybeSingle();
      if (!cancelled) setFavorite(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [pair]);

  const toggleFavorite = async () => {
    if (!pair) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Sign in to manage favorites.");
      setNoticeOk(false);
      return;
    }
    if (favorite) {
      await supabase
        .from("market_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("trading_pair_id", pair.id);
      setFavorite(false);
    } else {
      await supabase.from("market_favorites").insert({
        user_id: user.id,
        trading_pair_id: pair.id,
      });
      setFavorite(true);
    }
  };

  const wallet = useMemo(() => {
    if (!pair) return null;
    const asset = side === "buy" ? pair.quote_asset : pair.base_asset;
    const rows = wallets.filter(
      (x) => x.asset.toUpperCase() === asset.toUpperCase()
    );
    const row =
      rows.find(
        (x) =>
          (x.account_type || x.wallet_type || "").toLowerCase() === "spot"
      ) ||
      rows.find((x) => (x.wallet_type || "").toLowerCase() === "spot") ||
      rows[0];
    if (!row) return { asset, available: 0, exists: false };
    const available = Math.max(
      0,
      Number(row.balance) -
        Number(row.locked_balance || 0) -
        Number(row.escrow_balance || 0)
    );
    return { asset, available, exists: true };
  }, [wallets, pair, side]);

  const fundingWallets = useMemo(
    () =>
      wallets.filter(
        (w) => (w.account_type || w.wallet_type || "").toLowerCase() === "funding"
      ),
    [wallets]
  );
  const futuresWallets = useMemo(
    () =>
      wallets.filter(
        (w) => (w.account_type || w.wallet_type || "").toLowerCase() === "futures"
      ),
    [wallets]
  );
  const spotWallets = useMemo(
    () =>
      wallets.filter(
        (w) =>
          (w.account_type || w.wallet_type || "").toLowerCase() === "spot" ||
          !w.account_type
      ),
    [wallets]
  );


  const np = Number(p);
  const na = Number(amount);
  const total =
    Number.isFinite(np) && Number.isFinite(na) && np > 0 && na > 0
      ? np * na
      : 0;

  const last = ticker?.last_price ?? null;
  const liveAsk = ticker?.ask_price ?? last;
  const liveBid = ticker?.bid_price ?? last;
  const change = ticker?.change_24h ?? null;
  const changeUp = change == null ? true : change >= 0;

  const setPercent = (pct: number) => {
    if (!wallet || !Number.isFinite(np) || np <= 0) return;
    setActivePct(pct);
    if (side === "buy") {
      const spend = (wallet.available * pct) / 100;
      const q = spend / np;
      setAmount(q > 0 ? String(Number(q.toFixed(8))) : "");
      setOrderValue(spend > 0 ? String(Number(spend.toFixed(4))) : "");
    } else {
      const q = (wallet.available * pct) / 100;
      setAmount(q > 0 ? String(Number(q.toFixed(8))) : "");
      setOrderValue(q * np > 0 ? String(Number((q * np).toFixed(4))) : "");
    }
  };

  const onPriceChange = (val: string) => {
    setPriceTouched(true);
    setP(val);
    const price = Number(val);
    const qty = Number(amount);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(qty) && qty > 0) {
      setOrderValue(String(Number((price * qty).toFixed(4))));
    }
  };

  const onQtyChange = (val: string) => {
    setAmount(val);
    setActivePct(null);
    const qty = Number(val);
    const price = Number(p);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(qty) && qty > 0) {
      setOrderValue(String(Number((price * qty).toFixed(4))));
    }
  };

  const onValueChange = (val: string) => {
    setOrderValue(val);
    setActivePct(null);
    const value = Number(val);
    const price = Number(p);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(value) && value > 0) {
      setAmount(String(Number((value / price).toFixed(8))));
    }
  };

  const placeOrder = async () => {
    if (!pair) return;
    if (orderType === "market") {
      setNotice("Market orders are not available yet. Use Limit.");
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(np) || np <= 0) {
      setNotice("Enter a valid price.");
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(na) || na <= 0) {
      setNotice("Enter a valid quantity.");
      setNoticeOk(false);
      return;
    }
    if (!wallet || !wallet.exists || wallet.available <= 0 || total > wallet.available) {
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
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: {
        action: "place_order",
        trading_pair: pair.symbol,
        side,
        order_type: orderType,
        price: orderType === "limit" ? np : undefined,
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
          : String(data.error)
      );
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Kraken live trading isn't enabled yet.");
      setNoticeOk(false);
      return;
    }
    if (!data?.order_id && !data?.kraken_order_id) {
      setNotice("The server did not return an order id.");
      setNoticeOk(false);
      return;
    }
    setNotice(
      `Order routed to Kraken${data?.kraken_order_id ? ` (ref ${data.kraken_order_id})` : ""}.`
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
      setNotice(error.message || "Unable to reach the Kraken order routing service.");
      setNoticeOk(false);
      return;
    }
    if (data?.error) {
      setNotice(String(data.error));
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Kraken live trading isn't enabled yet.");
      setNoticeOk(false);
      return;
    }
    setNotice("Cancellation confirmed with Kraken.");
    setNoticeOk(true);
    void loadUser();
  };


  const submitTransfer = async () => {
    const amt = Number(transferAmount);
    if (!transferAsset) {
      setNotice("Choose an asset to transfer.");
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setNotice("Enter a valid transfer amount.");
      setNoticeOk(false);
      return;
    }
    const fromAccount = transferDirection === "from_spot" ? "spot" : "funding";
    const toAccount = transferDirection === "from_spot" ? "funding" : "spot";
    setTransferring(true);
    const { error } = await supabase.rpc("transfer_between_accounts", {
      p_asset: transferAsset.toUpperCase(),
      p_from_account: fromAccount,
      p_to_account: toAccount,
      p_amount: amt,
      p_idempotency_key: crypto.randomUUID(),
    });
    setTransferring(false);
    if (error) {
      setNotice(error.message);
      setNoticeOk(false);
      return;
    }
    setNotice(
      `Transferred ${fmt(amt, 8)} ${transferAsset.toUpperCase()} from ${fromAccount} to ${toAccount}.`
    );
    setNoticeOk(true);
    setTransferAmount("");
    setShowTransfer(false);
    void loadUser();
  };

  // Precision grouping — real aggregation of the live book
  const baseTick = baseTickFor(ticker?.last_price ?? null);
  const precisionOptions = [baseTick, baseTick * 10, baseTick * 100];
  const tick = precisionOptions[precisionIdx] ?? baseTick;
  const bookPriceDecimals = decimalsForTick(tick);
  const bookQtyDecimals = 4;
  const bookLevelCap = viewMode === "terminal" ? 12 : 28;

  const rawAsks = book.filter((x) => x.side === "sell");
  const rawBids = book.filter((x) => x.side === "buy");

  const groupedAsks = useMemo(
    () =>
      groupLevels(
        rawAsks.map((a) => ({
          price: a.price,
          amt: a.amount - a.filled_amount,
        })),
        tick,
        "ask"
      ).slice(0, bookLevelCap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book, tick, bookLevelCap]
  );
  const groupedBids = useMemo(
    () =>
      groupLevels(
        rawBids.map((b) => ({
          price: b.price,
          amt: b.amount - b.filled_amount,
        })),
        tick,
        "bid"
      ).slice(0, bookLevelCap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book, tick, bookLevelCap]
  );

  const asks = groupedAsks.map((a) => ({
    side: "sell" as const,
    price: a.price,
    amount: a.amt,
    filled_amount: 0,
  }));
  const bids = groupedBids.map((b) => ({
    side: "buy" as const,
    price: b.price,
    amount: b.amt,
    filled_amount: 0,
  }));

  const maxAmt = Math.max(
    ...asks.map((a) => a.amount),
    ...bids.map((b) => b.amount),
    0.0001
  );
  const bidVol = bids.reduce((s, r) => s + r.amount, 0);
  const askVol = asks.reduce((s, r) => s + r.amount, 0);
  const totalVol = bidVol + askVol || 1;
  const bidPct = Math.round((bidVol / totalVol) * 100);
  const askPct = 100 - bidPct;

  const pairedRows = useMemo(() => {
    const n = Math.max(asks.length, bids.length, 1);
    const rows: {
      bidQty: number | null;
      bidPrice: number | null;
      askPrice: number | null;
      askQty: number | null;
    }[] = [];
    for (let i = 0; i < n && i < bookLevelCap; i++) {
      rows.push({
        bidQty: bids[i]?.amount ?? null,
        bidPrice: bids[i]?.price ?? null,
        askPrice: asks[i]?.price ?? null,
        askQty: asks[i]?.amount ?? null,
      });
    }
    return rows;
  }, [asks, bids, bookLevelCap]);

  const openOrders = orders.filter((x) =>
    CANCELLABLE.has(x.status.toLowerCase())
  );
  const historyOrders = orders.filter(
    (x) => !CANCELLABLE.has(x.status.toLowerCase())
  );
  const pairScoped = (list: Order[]) =>
    allMarketsOrders || !pair
      ? list
      : list.filter((o) => o.trading_pair === pair.symbol);
  const displayOrders = pairScoped(
    orderTab === "open" ? openOrders : historyOrders
  );
  const scopedOpenCount = pairScoped(openOrders).length;

  const filteredPairs = useMemo(() => {
    const q = marketsFilter.trim().toUpperCase();
    return pairs.filter(
      (x) =>
        !q ||
        x.symbol.toUpperCase().includes(q) ||
        x.base_asset.toUpperCase().includes(q)
    );
  }, [pairs, marketsFilter]);

  const ma = useMemo(() => computeMALegend(candles), [candles]);
  const liveOk =
    bybitStatus === "connected" || bybitStatus === "live" || !!ticker;

  const openTerminal = (s: "buy" | "sell") => {
    setSide(s);
    setViewMode("terminal");
    if (!priceTouched && last != null) {
      setP(String(s === "buy" ? liveAsk ?? last : liveBid ?? last));
    }
  };

  const keypadPress = (key: string) => {
    if (!keypadField) return;
    const current =
      keypadField === "price" ? p : keypadField === "qty" ? amount : orderValue;
    if (key === "back") {
      const next = current.slice(0, -1);
      if (keypadField === "price") onPriceChange(next);
      else if (keypadField === "qty") onQtyChange(next);
      else onValueChange(next);
      return;
    }
    if (key === "ok") {
      setKeypadField(null);
      return;
    }
    if (key === "." && current.includes(".")) return;
    const next = current + key;
    if (keypadField === "price") onPriceChange(next);
    else if (keypadField === "qty") onQtyChange(next);
    else onValueChange(next);
  };

  if (loading && !pair) {
    return (
      <div className="tp">
        <style>{CSS}</style>
        <div className="tp-center">Loading market…</div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="tp">
        <style>{CSS}</style>
        <div className="tp-shell">
          <button
            className="tp-back"
            onClick={onBack || (() => window.history.back())}
          >
            ←
          </button>
          <div className="tp-center">Trading pair not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tp">
      <style>{CSS}</style>
      <div className="tp-shell">
        {/* TOP BAR */}
        <header className="tp-head">
          <button
            className="tp-back"
            type="button"
            onClick={onBack || (() => window.history.back())}
            aria-label="Back"
          >
            ←
          </button>
          <div className="tp-title">Trade</div>
          <button className="tp-icon" type="button" aria-label="Expand">
            ⛶
          </button>
        </header>

        {/* PAIR + VIEW TOGGLE */}
        <div className="tp-pair-strip">
          <div className="tp-pair-left">
            <button
              className="tp-pair-btn"
              type="button"
              onClick={() => setShowMarkets(true)}
            >
              <span className="tp-pair-name">{pair.symbol}</span>
              <span className="tp-chev">▾</span>
            </button>
            {change != null && (
              <span className={`tp-chg ${changeUp ? "up" : "down"}`}>
                {changeUp ? "+" : ""}
                {fmt(change, 2)}%
              </span>
            )}
          </div>
          <div className="tp-pair-right">
            <span className={`tp-live-pill ${liveOk ? "ok" : ""}`}>
              {liveOk ? "Live" : "…"}
            </span>
            <div className="tp-view-toggle">
              <button
                type="button"
                className={`tp-view-btn ${viewMode === "standard" ? "on" : ""}`}
                onClick={() => setViewMode("standard")}
                aria-label="Standard view"
                title="Standard"
              >
                ⧉
              </button>
              <button
                type="button"
                className={`tp-view-btn ${viewMode === "terminal" ? "on" : ""}`}
                onClick={() => setViewMode("terminal")}
                aria-label="Terminal view"
                title="Terminal"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={noticeOk ? "tp-ok" : "tp-err"}
            onClick={() => setNotice(null)}
          >
            {notice}
          </div>
        )}


        {/* Account type tabs — Spot (live) / Futures (coming soon) / Funding (real balances + transfer) */}
        <div className="tp-account-tabs">
          {(
            [
              ["spot", "Spot"],
              ["futures", "Futures"],
              ["funding", "Funding"],
            ] as [AccountTab, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`tp-account-tab ${accountTab === val ? "on" : ""}`}
              onClick={() => setAccountTab(val)}
            >
              {label}
            </button>
          ))}
        </div>

        {accountTab === "futures" && (
          <div className="tp-account-panel">
            <div className="tp-coming-soon">
              <h3>Futures — Coming soon</h3>
              <p>
                Futures order routing is not connected yet. Your futures
                balance bucket is real; trading will appear here once the
                backend is live.
              </p>
            </div>
            {futuresWallets.length === 0 ? (
              <div className="tp-empty-sm">No futures balances yet.</div>
            ) : (
              futuresWallets.map((w) => (
                <div key={w.asset} className="tp-balance-card">
                  <div className="asset">{w.asset}</div>
                  <div className="row">
                    <span>Balance</span>
                    <b>{fmt(Number(w.balance), 8)}</b>
                  </div>
                  <div className="row">
                    <span>Locked</span>
                    <b>
                      {fmt(
                        Number(w.locked_balance || 0) +
                          Number(w.escrow_balance || 0),
                        8
                      )}
                    </b>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {accountTab === "funding" && (
          <div className="tp-account-panel">
            <p className="tp-funding-note">
              Funding is your internal balance ledger. Move funds between Spot
              and Funding with real transfers.
            </p>
            {fundingWallets.length === 0 ? (
              <div className="tp-empty-sm">No funding balances yet.</div>
            ) : (
              fundingWallets.map((w) => (
                <div key={w.asset} className="tp-balance-card">
                  <div className="asset">{w.asset}</div>
                  <div className="row">
                    <span>Available</span>
                    <b>
                      {fmt(
                        Math.max(
                          0,
                          Number(w.balance) -
                            Number(w.locked_balance || 0) -
                            Number(w.escrow_balance || 0)
                        ),
                        8
                      )}
                    </b>
                  </div>
                  <div className="row">
                    <span>Locked</span>
                    <b>
                      {fmt(
                        Number(w.locked_balance || 0) +
                          Number(w.escrow_balance || 0),
                        8
                      )}
                    </b>
                  </div>
                </div>
              ))
            )}
            {!showTransfer ? (
              <button
                type="button"
                className="tp-transfer-btn"
                onClick={() => setShowTransfer(true)}
              >
                Transfer between accounts
              </button>
            ) : (
              <div className="tp-transfer-form">
                <label>
                  Direction
                  <select
                    value={transferDirection}
                    onChange={(e) =>
                      setTransferDirection(
                        e.target.value as "from_spot" | "to_spot"
                      )
                    }
                  >
                    <option value="from_spot">Spot → Funding</option>
                    <option value="to_spot">Funding → Spot</option>
                  </select>
                </label>
                <label>
                  Asset
                  <select
                    value={transferAsset}
                    onChange={(e) => setTransferAsset(e.target.value)}
                  >
                    <option value="">Select asset</option>
                    {Array.from(
                      new Set(
                        (transferDirection === "from_spot"
                          ? spotWallets
                          : fundingWallets
                        ).map((w) => w.asset.toUpperCase())
                      )
                    ).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    type="text"
                    inputMode="decimal"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <div className="tp-transfer-actions">
                  <button
                    type="button"
                    onClick={() => setShowTransfer(false)}
                    disabled={transferring}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="confirm"
                    onClick={() => void submitTransfer()}
                    disabled={transferring}
                  >
                    {transferring ? "Transferring…" : "Confirm transfer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== STANDARD VIEW ==================== */}
        {accountTab === "spot" && viewMode === "standard" && (
          <>
            <div className="tp-content-tabs">
              {(["chart", "overview", "data", "feed"] as ContentTab[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tp-ctab ${contentTab === t ? "on" : ""}`}
                    onClick={() => setContentTab(t)}
                  >
                    {t === "chart"
                      ? "Chart"
                      : t === "overview"
                      ? "Overview"
                      : t === "data"
                      ? "Data"
                      : "Feed"}
                  </button>
                )
              )}
              <div className="tp-ctab-icons">
                <span className={`tp-dot ${liveOk ? "ok" : ""}`} />
                <button
                  type="button"
                  className={`tp-star ${favorite ? "on" : ""}`}
                  onClick={() => void toggleFavorite()}
                  aria-label="Favorite"
                >
                  {favorite ? "★" : "☆"}
                </button>
                <button type="button" className="tp-mini" aria-label="Alerts">
                  🔔
                </button>
                <button type="button" className="tp-mini" aria-label="Share">
                  ↗
                </button>
              </div>
            </div>

            {contentTab === "chart" && (
              <>
                <div className="tp-stats">
                  <div className="tp-last">
                    <span className={changeUp ? "up" : "down"}>
                      {fmtPrice(last)}
                    </span>
                    {last != null && (
                      <span className="tp-usd">
                        ≈ {fmtPrice(last)} {pair.quote_asset}
                      </span>
                    )}
                  </div>
                  <div className="tp-stats-grid">
                    <div>
                      <span>24h High</span>
                      <b>{fmtPrice(ticker?.high_24h)}</b>
                    </div>
                    <div>
                      <span>24h Low</span>
                      <b>{fmtPrice(ticker?.low_24h)}</b>
                    </div>
                    <div>
                      <span>24h Turnover</span>
                      <b>{fmt(ticker?.volume_24h, 2)}</b>
                    </div>
                  </div>
                </div>

                <div className="tp-sec-tabs">
                  {(["chart", "book", "trades"] as MarketTab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`tp-sec ${marketTab === t ? "on" : ""}`}
                      onClick={() => setMarketTab(t)}
                    >
                      {t === "chart"
                        ? "Chart"
                        : t === "book"
                        ? "Order Book"
                        : "Trades"}
                    </button>
                  ))}
                </div>

                {marketTab === "chart" && (
                  <div className="tp-chart-block">
                    <div className="tp-tf-row">
                      <span className="tp-tf-label">Time</span>
                      {TF.map((x) => (
                        <button
                          key={x.value}
                          type="button"
                          className={`tp-tf ${tf === x.value ? "on" : ""}`}
                          onClick={() => setTf(x.value)}
                        >
                          {x.label}
                        </button>
                      ))}
                      <span className="tp-tf-more">More ▾</span>
                      <div className="tp-tf-tools">
                        <span>Depth</span>
                        <span>✎</span>
                        <span>⌖</span>
                        <span>⊞</span>
                      </div>
                    </div>
                    <div className="tp-ma-legend">
                      <span className="ma7">
                        MA7: {ma.ma7 != null ? fmtPrice(ma.ma7) : "—"}
                      </span>
                      <span className="ma14">
                        MA14: {ma.ma14 != null ? fmtPrice(ma.ma14) : "—"}
                      </span>
                      <span className="ma28">
                        MA28: {ma.ma28 != null ? fmtPrice(ma.ma28) : "—"}
                      </span>
                    </div>
                    <TradingChart candles={candles} height={340} showMA />
                    <div className="tp-ind-bar">
                      {[
                        "MA",
                        "EMA",
                        "BOLL",
                        "SAR",
                        "MAVOL",
                        "MACD",
                        "KDJ",
                        "RSI",
                        "WR",
                      ].map((ind) => (
                        <button
                          key={ind}
                          type="button"
                          className={`tp-ind ${
                            ind === "MA" || ind === "MAVOL" ? "on" : "off"
                          }`}
                          title={
                            ind === "MA" || ind === "MAVOL"
                              ? ind
                              : "Not available yet"
                          }
                          disabled={ind !== "MA" && ind !== "MAVOL"}
                        >
                          {ind}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {marketTab === "book" && (
                  <div className="tp-book">
                    <div className="tp-book-head-row">
                      <span className="buy-lbl">Buy</span>
                      <span className="sell-lbl">Sell</span>
                      <select
                        className="tp-prec"
                        value={precisionIdx}
                        onChange={(e) =>
                          setPrecisionIdx(Number(e.target.value))
                        }
                        aria-label="Order book price grouping"
                      >
                        {precisionOptions.map((t, i) => (
                          <option key={i} value={i}>
                            {t < 1
                              ? t.toFixed(
                                  String(t).split(".")[1]?.length || 2
                                )
                              : t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tp-book-ratio">
                      <div className="bid" style={{ width: `${bidPct}%` }} />
                      <div className="ask" style={{ width: `${askPct}%` }} />
                    </div>
                    <div className="tp-book-ratio-lbl">
                      <span className="up">B {bidPct}%</span>
                      <span className="down">{askPct}% S</span>
                    </div>
                    <div className="tp-book-cols">
                      <span>Qty ({pair.base_asset})</span>
                      <span>Price ({pair.quote_asset})</span>
                      <span>Price ({pair.quote_asset})</span>
                      <span>Qty ({pair.base_asset})</span>
                    </div>
                    <div className="tp-book-body-paired">
                      {pairedRows.length === 0 && (
                        <div className="tp-empty-sm">No order book data</div>
                      )}
                      {pairedRows.map((row, i) => (
                        <div key={i} className="tp-pair-row-book">
                          <button
                            type="button"
                            className="cell qty"
                            onClick={() =>
                              row.bidPrice != null &&
                              pickFromBook(row.bidPrice, "sell")
                            }
                          >
                            {row.bidQty != null
                              ? fixedDec(row.bidQty, 4)
                              : ""}
                          </button>
                          <button
                            type="button"
                            className="cell bid"
                            onClick={() =>
                              row.bidPrice != null &&
                              pickFromBook(row.bidPrice, "sell")
                            }
                          >
                            {row.bidPrice != null
                              ? fixedDec(row.bidPrice, bookPriceDecimals)
                              : ""}
                            {row.bidPrice != null && (
                              <span
                                className="bar bid"
                                style={{
                                  width: `${
                                    ((row.bidQty || 0) / maxAmt) * 100
                                  }%`,
                                }}
                              />
                            )}
                          </button>
                          <button
                            type="button"
                            className="cell ask"
                            onClick={() =>
                              row.askPrice != null &&
                              pickFromBook(row.askPrice, "buy")
                            }
                          >
                            {row.askPrice != null
                              ? fixedDec(row.askPrice, bookPriceDecimals)
                              : ""}
                            {row.askPrice != null && (
                              <span
                                className="bar ask"
                                style={{
                                  width: `${
                                    ((row.askQty || 0) / maxAmt) * 100
                                  }%`,
                                }}
                              />
                            )}
                          </button>
                          <button
                            type="button"
                            className="cell qty"
                            onClick={() =>
                              row.askPrice != null &&
                              pickFromBook(row.askPrice, "buy")
                            }
                          >
                            {row.askQty != null
                              ? fixedDec(row.askQty, 4)
                              : ""}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {marketTab === "trades" && (
                  <div className="tp-trades">
                    <div className="tp-trades-head">
                      <span>Time</span>
                      <span>Price ({pair.quote_asset})</span>
                      <span>Amount ({pair.base_asset})</span>
                    </div>
                    {trades.length === 0 && (
                      <div className="tp-empty-sm">No recent trades</div>
                    )}
                    {trades.slice(0, 40).map((t, i) => {
                      const prev = trades[i + 1];
                      const up = prev == null ? true : t.price >= prev.price;
                      return (
                        <div key={t.id} className="tp-trade-row">
                          <span>{fmtTime(t.created_at)}</span>
                          <span className={up ? "up" : "down"}>
                            {fmtPrice(t.price)}
                          </span>
                          <span>{fmtQty(t.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {contentTab !== "chart" && (
              <div className="tp-na">
                <div className="tp-na-icon">📋</div>
                <div>Not available yet</div>
                <div className="tp-na-sub">
                  {contentTab === "overview"
                    ? "Overview data is not connected."
                    : contentTab === "data"
                    ? "Market data panels are not connected."
                    : "Feed is not connected."}
                </div>
              </div>
            )}

            {!keypadField && (
              <div className="tp-sticky">
                <button
                  type="button"
                  className="tp-sticky-buy"
                  onClick={() => openTerminal("buy")}
                >
                  <span>Buy</span>
                  <small>{fmtPrice(liveAsk)}</small>
                </button>
                <button type="button" className="tp-sticky-qty">
                  Quantity
                  <small>{pair.base_asset}</small>
                </button>
                <button
                  type="button"
                  className="tp-sticky-sell"
                  onClick={() => openTerminal("sell")}
                >
                  <span>Sell</span>
                  <small>{fmtPrice(liveBid)}</small>
                </button>
              </div>
            )}
          </>
        )}

        {/* ==================== TERMINAL VIEW ==================== */}
        {accountTab === "spot" && viewMode === "terminal" && (
          <div className="tp-terminal">
            <div className="tp-term-main">
              <div className="tp-form">
                <div className="tp-side-seg">
                  <button
                    type="button"
                    className={`buy ${side === "buy" ? "on" : ""}`}
                    onClick={() => setSide("buy")}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    className={`sell ${side === "sell" ? "on" : ""}`}
                    onClick={() => setSide("sell")}
                  >
                    Sell
                  </button>
                </div>

                <div className="tp-form-row muted">
                  <span>Margin</span>
                  <label
                    className="tp-switch disabled"
                    title="Margin isn't supported yet"
                  >
                    <input type="checkbox" disabled />
                    <span>Off</span>
                  </label>
                </div>

                <div className="tp-form-row">
                  <span>Available</span>
                  <span>
                    {fmt(wallet?.available ?? 0, 4)} {wallet?.asset || "—"}
                    {onAddFunds && (
                      <button
                        type="button"
                        className="tp-add"
                        onClick={onAddFunds}
                      >
                        +
                      </button>
                    )}
                  </span>
                </div>

                <div className="tp-form-row">
                  <select
                    className="tp-select"
                    value={orderType}
                    onChange={(e) =>
                      setOrderType(e.target.value as "limit" | "market")
                    }
                  >
                    <option value="limit">Limit</option>
                    <option value="market">Market (not available yet)</option>
                  </select>
                </div>

                <div className="tp-field">
                  <label>Price</label>
                  <div className="tp-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={p}
                      onChange={(e) => onPriceChange(e.target.value)}
                      onFocus={() => setKeypadField("price")}
                      placeholder="0"
                    />
                    <span>{pair.quote_asset}</span>
                  </div>
                </div>

                <div className="tp-field">
                  <label>Quantity</label>
                  <div className="tp-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => onQtyChange(e.target.value)}
                      onFocus={() => setKeypadField("qty")}
                      placeholder="0"
                    />
                    <span>{pair.base_asset}</span>
                  </div>
                </div>

                <div className="tp-pct">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={activePct === pct ? "on" : ""}
                      onClick={() => setPercent(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <div className="tp-field">
                  <label>Order Value</label>
                  <div className="tp-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={orderValue}
                      onChange={(e) => onValueChange(e.target.value)}
                      onFocus={() => setKeypadField("value")}
                      placeholder="0"
                    />
                    <span>{pair.quote_asset}</span>
                  </div>
                </div>

                <div className="tp-form-row muted">
                  <span>Max {side === "buy" ? "Buy" : "Sell"}</span>
                  <span>
                    {side === "buy"
                      ? `${fmt(
                          wallet && np > 0 ? wallet.available / np : 0,
                          6
                        )} ${pair.base_asset}`
                      : `${fmt(wallet?.available ?? 0, 6)} ${pair.quote_asset}`}
                  </span>
                </div>

                <div className="tp-checks">
                  <label title="Not available yet">
                    <input type="checkbox" disabled /> TP/SL
                  </label>
                  <label title="Not available yet">
                    <input type="checkbox" disabled /> Post-Only
                  </label>
                  <span className="tp-tif">GTC ▾</span>
                </div>

                <button
                  type="button"
                  className={`tp-submit ${side}`}
                  disabled={
                    submitting ||
                    !Number.isFinite(np) ||
                    np <= 0 ||
                    !Number.isFinite(na) ||
                    na <= 0
                  }
                  onClick={() => void placeOrder()}
                >
                  {submitting
                    ? "Submitting…"
                    : `${side === "buy" ? "Buy" : "Sell"} ${pair.base_asset}`}
                </button>
              </div>

              <div className="tp-term-book">
                <div className="tp-term-book-head">
                  <span>Price ({pair.quote_asset})</span>
                  <span>Qty ({pair.base_asset})</span>
                </div>
                <div className="tp-term-asks">
                  {[...asks]
                    .reverse()
                    .slice(0, 8)
                    .map((a) => (
                      <button
                        key={`ta-${a.price}`}
                        type="button"
                        className="tp-term-row ask"
                        onClick={() => pickFromBook(a.price, "buy")}
                      >
                        <span className="down">
                          {fixedDec(a.price, bookPriceDecimals)}
                        </span>
                        <span>{fmtQty(a.amount - a.filled_amount)}</span>
                      </button>
                    ))}
                </div>
                <div className="tp-term-mid">
                  <span className={changeUp ? "up" : "down"}>
                    {fmtPrice(last)}
                  </span>
                  <span className="tp-term-usd">≈ {fmtPrice(last)} USD</span>
                </div>
                <div className="tp-term-bids">
                  {bids.slice(0, 8).map((b) => (
                    <button
                      key={`tb-${b.price}`}
                      type="button"
                      className="tp-term-row bid"
                      onClick={() => pickFromBook(b.price, "sell")}
                    >
                      <span className="up">
                        {fixedDec(b.price, bookPriceDecimals)}
                      </span>
                      <span>{fmtQty(b.amount - b.filled_amount)}</span>
                    </button>
                  ))}
                </div>
                <div className="tp-book-ratio term">
                  <div className="bid" style={{ width: `${bidPct}%` }} />
                  <div className="ask" style={{ width: `${askPct}%` }} />
                </div>
                <div className="tp-book-ratio-lbl">
                  <span className="up">B {bidPct}%</span>
                  <span className="down">{askPct}% S</span>
                </div>
              </div>
            </div>

            <div className="tp-bottom-tabs">
              {(
                [
                  ["orders", `Orders(${scopedOpenCount})`],
                  ["positions", "Positions(0)"],
                  ["assets", "Assets"],
                  ["borrowings", "Borrowings(0)"],
                  ["tx", "Tx"],
                ] as [BottomTab, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`tp-btab ${bottomTab === val ? "on" : ""} ${
                    val === "borrowings" ||
                    val === "positions" ||
                    val === "tx"
                      ? "disabled"
                      : ""
                  }`}
                  onClick={() => setBottomTab(val)}
                  title={
                    val === "borrowings" ||
                    val === "positions" ||
                    val === "tx"
                      ? "Not available yet"
                      : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {bottomTab === "orders" && (
              <div className="tp-orders">
                <div className="tp-order-sub">
                  <button
                    type="button"
                    className={orderTab === "open" ? "on" : ""}
                    onClick={() => setOrderTab("open")}
                  >
                    Open ({pairScoped(openOrders).length})
                  </button>
                  <button
                    type="button"
                    className={orderTab === "history" ? "on" : ""}
                    onClick={() => setOrderTab("history")}
                  >
                    History ({pairScoped(historyOrders).length})
                  </button>
                </div>
                <label className="tp-all-markets">
                  <input
                    type="checkbox"
                    checked={allMarketsOrders}
                    onChange={(e) => setAllMarketsOrders(e.target.checked)}
                  />
                  All Markets
                </label>
                {displayOrders.length === 0 && (
                  <div className="tp-empty">
                    <div className="tp-empty-icon">📄</div>
                    <div>No Available Data</div>
                  </div>
                )}
                {displayOrders.map((o) => (
                  <div key={o.id} className="tp-order-row">
                    <div>
                      <b className={o.side === "buy" ? "up" : "down"}>
                        {o.side.toUpperCase()}
                      </b>{" "}
                      {o.trading_pair} · {o.order_type}
                    </div>
                    <div className="tp-order-meta">
                      {fmtPrice(o.price)} × {fmtQty(o.amount)} · {o.status}
                    </div>
                    {CANCELLABLE.has(o.status.toLowerCase()) && (
                      <button
                        type="button"
                        className="tp-cancel"
                        disabled={cancellingId === o.id}
                        onClick={() => void cancelOrder(o.id)}
                      >
                        {cancellingId === o.id ? "…" : "Cancel"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {bottomTab === "assets" && (
              <div className="tp-orders">
                {wallets.length === 0 && (
                  <div className="tp-empty">
                    <div className="tp-empty-icon">📄</div>
                    <div>No Available Data</div>
                  </div>
                )}
                {wallets
                  .filter((w) => Number(w.balance) > 0)
                  .map((w) => (
                    <div
                      key={`${w.asset}-${w.wallet_type}`}
                      className="tp-order-row"
                    >
                      <div>
                        <b>{w.asset}</b> · {w.account_type || w.wallet_type}
                      </div>
                      <div className="tp-order-meta">
                        {fmt(w.balance, 6)} (avail{" "}
                        {fmt(
                          Math.max(
                            0,
                            Number(w.balance) -
                              Number(w.locked_balance || 0) -
                              Number(w.escrow_balance || 0)
                          ),
                          6
                        )}
                        )
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {(bottomTab === "positions" ||
              bottomTab === "borrowings" ||
              bottomTab === "tx") && (
              <div className="tp-empty">
                <div className="tp-empty-icon">📄</div>
                <div>No Available Data</div>
                <div className="tp-na-sub">
                  {bottomTab === "positions"
                    ? "User positions are not available for this market type."
                    : bottomTab === "borrowings"
                    ? "Margin borrowing is not supported yet."
                    : "Transaction history panel is not connected yet."}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Markets picker */}
        {showMarkets && (
          <div className="tp-sheet" onClick={() => setShowMarkets(false)}>
            <div
              className="tp-sheet-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tp-sheet-head">
                <b>Select Market</b>
                <button type="button" onClick={() => setShowMarkets(false)}>
                  ✕
                </button>
              </div>
              <input
                className="tp-sheet-search"
                placeholder="Search pairs…"
                value={marketsFilter}
                onChange={(e) => setMarketsFilter(e.target.value)}
              />
              <div className="tp-sheet-list">
                {filteredPairs.map((x) => {
                  const hot = hotMarkets.find((h) => h.symbol === x.symbol);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      className={x.symbol === pair.symbol ? "on" : ""}
                      onClick={() => {
                        setSymbol(x.symbol);
                        setShowMarkets(false);
                        setPriceTouched(false);
                        setP("");
                        setAmount("");
                        setOrderValue("");
                      }}
                    >
                      <span>{x.symbol}</span>
                      {hot?.change != null && (
                        <span
                          className={
                            hot.change >= 0 ? "tp-hot-up" : "tp-hot-down"
                          }
                        >
                          {hot.change >= 0 ? "+" : ""}
                          {Number(hot.change).toFixed(2)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Custom numeric keypad */}
        {keypadField && (
          <div className="tp-keypad">
            <div className="tp-keypad-grid">
              {[
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                ".",
                "0",
                "back",
              ].map((k) => (
                <button
                  key={k}
                  type="button"
                  className="tp-key"
                  onClick={() => keypadPress(k)}
                >
                  {k === "back" ? "⌫" : k}
                </button>
              ))}
              <button
                type="button"
                className="tp-key ok"
                onClick={() => keypadPress("ok")}
              >
                ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.tp{min-height:100vh;background:#0a0a0a;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;-webkit-font-smoothing:antialiased}
.tp-shell{max-width:520px;margin:0 auto;padding-bottom:calc(72px + env(safe-area-inset-bottom));position:relative}
.tp-center{display:flex;align-items:center;justify-content:center;min-height:60vh;color:#666}
.tp-head{display:flex;align-items:center;justify-content:space-between;height:44px;padding:0 12px;border-bottom:1px solid #181818;position:sticky;top:0;background:rgba(10,10,10,.97);z-index:30;backdrop-filter:blur(8px)}
.tp-back,.tp-icon{background:none;border:none;color:#ccc;font-size:18px;padding:6px 8px;cursor:pointer}
.tp-title{font-size:16px;font-weight:600;color:#fff}
.tp-pair-strip{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;gap:8px}
.tp-pair-left{display:flex;flex-direction:column;gap:2px}
.tp-pair-btn{background:none;border:none;color:#fff;font-size:16px;font-weight:700;display:flex;align-items:center;gap:4px;padding:0;cursor:pointer}
.tp-chev{font-size:11px;color:#888}
.tp-chg{font-size:12px;font-weight:600}
.tp-chg.up,.up{color:#16c784}
.tp-chg.down,.down{color:#ea3943}
.tp-pair-right{display:flex;align-items:center;gap:8px}
.tp-live-pill{font-size:10px;padding:2px 8px;border-radius:10px;background:#1a1a1a;color:#666;border:1px solid #222}
.tp-live-pill.ok{color:#16c784;border-color:#1a3a2a}
.tp-view-toggle{display:flex;background:#141414;border-radius:8px;padding:2px;border:1px solid #222}
.tp-view-btn{background:none;border:none;color:#666;font-size:14px;padding:6px 10px;border-radius:6px;cursor:pointer}
.tp-view-btn.on{background:#222;color:#fff}
.tp-content-tabs{display:flex;align-items:center;padding:0 8px;border-bottom:1px solid #161616;gap:2px;overflow-x:auto}
.tp-ctab{background:none;border:none;color:#666;font-size:13px;padding:10px 12px;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent}
.tp-ctab.on{color:#fff;border-bottom-color:#f0b90b}
.tp-ctab-icons{margin-left:auto;display:flex;align-items:center;gap:8px;padding-right:4px}
.tp-dot{width:6px;height:6px;border-radius:50%;background:#444;display:inline-block}
.tp-dot.ok{background:#16c784}
.tp-star{background:none;border:none;color:#555;font-size:16px;cursor:pointer;padding:2px}
.tp-star.on{color:#f0b90b}
.tp-mini{background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:2px}
.tp-stats{display:flex;justify-content:space-between;padding:10px 12px 6px;gap:12px}
.tp-last{display:flex;flex-direction:column}
.tp-last span:first-child{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
.tp-usd{font-size:11px;color:#666;margin-top:2px}
.tp-stats-grid{display:flex;flex-direction:column;gap:4px;text-align:right;font-size:11px}
.tp-stats-grid span{color:#666;margin-right:6px}
.tp-stats-grid b{font-weight:600;color:#ccc;font-variant-numeric:tabular-nums}
.tp-sec-tabs{display:flex;padding:0 12px;gap:16px;border-bottom:1px solid #161616}
.tp-sec{background:none;border:none;color:#666;font-size:13px;padding:8px 0;cursor:pointer;border-bottom:2px solid transparent}
.tp-sec.on{color:#fff;border-bottom-color:#fff}
.tp-chart-block{padding:4px 0 8px}
.tp-tf-row{display:flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;overflow-x:auto}
.tp-tf-label{color:#666}
.tp-tf{background:none;border:none;color:#888;font-size:12px;padding:4px 8px;border-radius:4px;cursor:pointer}
.tp-tf.on{color:#f0b90b;background:#1a1608}
.tp-tf-more{color:#666;margin-left:4px}
.tp-tf-tools{margin-left:auto;display:flex;gap:10px;color:#666}
.tp-ma-legend{display:flex;gap:12px;padding:2px 12px 6px;font-size:10px;font-variant-numeric:tabular-nums}
.tp-ma-legend .ma7{color:#f0b90b}
.tp-ma-legend .ma14{color:#3861fb}
.tp-ma-legend .ma28{color:#e91e8c}
.tp-ind-bar{display:flex;gap:2px;padding:6px 8px;overflow-x:auto;border-top:1px solid #141414}
.tp-ind{background:none;border:none;color:#555;font-size:11px;padding:4px 8px;cursor:pointer}
.tp-ind.on{color:#ccc}
.tp-ind.off{opacity:.4;cursor:not-allowed}
.tp-book{padding:6px 8px 80px}
.tp-book-head-row{display:flex;align-items:center;gap:8px;padding:4px 4px}
.tp-book-head-row .buy-lbl{color:#16c784;font-weight:600;font-size:12px}
.tp-book-head-row .sell-lbl{color:#ea3943;font-weight:600;font-size:12px;margin-left:auto}
.tp-prec{background:#141414;border:1px solid #222;color:#aaa;font-size:11px;border-radius:4px;padding:2px 6px}
.tp-book-ratio{display:flex;height:3px;border-radius:2px;overflow:hidden;background:#1a1a1a;margin:4px 0}
.tp-book-ratio .bid{background:#16c784}
.tp-book-ratio .ask{background:#ea3943}
.tp-book-ratio-lbl{display:flex;justify-content:space-between;font-size:10px;font-weight:600;margin-bottom:4px}
.tp-book-cols{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;font-size:10px;color:#555;padding:2px 4px}
.tp-book-body-paired{display:flex;flex-direction:column}
.tp-pair-row-book{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;height:22px;align-items:center}
.tp-pair-row-book .cell{position:relative;background:none;border:none;color:inherit;font:inherit;font-size:11px;font-variant-numeric:tabular-nums;cursor:pointer;padding:0 4px;height:100%;text-align:left;overflow:hidden}
.tp-pair-row-book .cell.bid{color:#16c784;font-weight:600;text-align:right}
.tp-pair-row-book .cell.ask{color:#ea3943;font-weight:600}
.tp-pair-row-book .cell.qty{color:#aaa}
.tp-pair-row-book .bar{position:absolute;top:0;bottom:0;opacity:.18;pointer-events:none}
.tp-pair-row-book .bar.bid{right:0;background:#16c784}
.tp-pair-row-book .bar.ask{left:0;background:#ea3943}
.tp-trades{padding:6px 12px 80px}
.tp-trades-head{display:grid;grid-template-columns:1fr 1fr 1fr;font-size:10px;color:#555;padding:4px 0}
.tp-trade-row{display:grid;grid-template-columns:1fr 1fr 1fr;font-size:12px;font-variant-numeric:tabular-nums;padding:3px 0;color:#ccc}
.tp-sticky{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(transparent,rgba(10,10,10,.98) 28%);max-width:520px;margin:0 auto}
.tp-sticky-buy,.tp-sticky-sell,.tp-sticky-qty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border:none;border-radius:8px;padding:10px 6px;cursor:pointer;font-weight:700;font-size:14px}
.tp-sticky-buy{background:#16c784;color:#041}
.tp-sticky-sell{background:#ea3943;color:#fff}
.tp-sticky-qty{background:#1a1a1a;color:#aaa;border:1px solid #2a2a2a}
.tp-sticky-buy small,.tp-sticky-sell small,.tp-sticky-qty small{font-size:11px;font-weight:600;opacity:.9;margin-top:2px;font-variant-numeric:tabular-nums}
.tp-na{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px;color:#666;gap:8px}
.tp-na-icon{font-size:32px;opacity:.5}
.tp-na-sub{font-size:12px;color:#444}
.tp-ok,.tp-err{margin:6px 12px;padding:8px 12px;border-radius:6px;font-size:12px;cursor:pointer}
.tp-ok{background:#0d2818;color:#16c784;border:1px solid #1a3a2a}
.tp-err{background:#2a1010;color:#ea3943;border:1px solid #3a1a1a}
.tp-empty-sm{padding:24px;text-align:center;color:#555;font-size:12px}
.tp-terminal{padding-bottom:16px}
.tp-term-main{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 10px}
@media(max-width:380px){.tp-term-main{grid-template-columns:1fr}}
.tp-form{display:flex;flex-direction:column;gap:8px}
.tp-side-seg{display:flex;background:#141414;border-radius:8px;overflow:hidden;border:1px solid #222}
.tp-side-seg button{flex:1;border:none;padding:10px;font-weight:700;font-size:14px;cursor:pointer;background:transparent;color:#666}
.tp-side-seg button.buy.on{background:#16c784;color:#041}
.tp-side-seg button.sell.on{background:#ea3943;color:#fff}
.tp-form-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#aaa}
.tp-form-row.muted{color:#666}
.tp-switch{display:flex;align-items:center;gap:4px;font-size:11px}
.tp-switch.disabled{opacity:.5}
.tp-add{background:#222;border:none;color:#f0b90b;border-radius:4px;width:18px;height:18px;margin-left:6px;cursor:pointer;font-size:12px}
.tp-select{width:100%;background:#141414;border:1px solid #222;color:#ccc;border-radius:6px;padding:8px;font-size:12px}
.tp-field{display:flex;flex-direction:column;gap:4px}
.tp-field label{font-size:11px;color:#666}
.tp-input-wrap{display:flex;align-items:center;background:#141414;border:1px solid #222;border-radius:6px;overflow:hidden}
.tp-input-wrap input{flex:1;background:transparent;border:none;color:#fff;padding:10px;font-size:14px;font-variant-numeric:tabular-nums;outline:none;min-width:0}
.tp-input-wrap span{padding:0 10px;color:#666;font-size:12px;white-space:nowrap}
.tp-pct{display:flex;gap:4px}
.tp-pct button{flex:1;background:#141414;border:1px solid #222;color:#888;border-radius:4px;padding:6px 0;font-size:11px;cursor:pointer}
.tp-pct button.on{border-color:#f0b90b;color:#f0b90b}
.tp-checks{display:flex;align-items:center;gap:12px;font-size:11px;color:#666}
.tp-checks input{margin-right:4px}
.tp-tif{margin-left:auto;color:#888}
.tp-submit{border:none;border-radius:8px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px}
.tp-submit.buy{background:#16c784;color:#041}
.tp-submit.sell{background:#ea3943;color:#fff}
.tp-submit:disabled{opacity:.45;cursor:not-allowed}
.tp-term-book{display:flex;flex-direction:column;font-size:11px}
.tp-term-book-head{display:grid;grid-template-columns:1fr 1fr;color:#555;padding:2px 4px;font-size:10px}
.tp-term-row{display:grid;grid-template-columns:1fr 1fr;background:none;border:none;color:#ccc;font:inherit;font-variant-numeric:tabular-nums;padding:2px 4px;cursor:pointer;text-align:left}
.tp-term-mid{padding:6px 4px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}
.tp-term-usd{display:block;font-size:10px;color:#666;font-weight:400}
.tp-bottom-tabs{display:flex;gap:2px;padding:8px 8px 0;overflow-x:auto;border-top:1px solid #161616;margin-top:8px}
.tp-btab{background:none;border:none;color:#666;font-size:12px;padding:8px 10px;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent}
.tp-btab.on{color:#fff;border-bottom-color:#f0b90b}
.tp-btab.disabled{opacity:.45}
.tp-orders{padding:8px 12px}
.tp-order-sub{display:flex;gap:12px;margin-bottom:8px}
.tp-all-markets{display:flex;align-items:center;gap:6px;padding:0 0 8px;font-size:11px;color:#888}
.tp-order-sub button{background:none;border:none;color:#666;font-size:12px;cursor:pointer;padding:4px 0;border-bottom:2px solid transparent}
.tp-order-sub button.on{color:#fff;border-bottom-color:#f0b90b}
.tp-order-row{padding:10px 0;border-bottom:1px solid #141414}
.tp-order-meta{font-size:11px;color:#888;margin-top:2px}
.tp-cancel{margin-top:6px;background:#1a1a1a;border:1px solid #333;color:#ea3943;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer}
.tp-empty{display:flex;flex-direction:column;align-items:center;padding:40px 16px;color:#555;gap:8px}
.tp-empty-icon{font-size:40px;opacity:.35}
.tp-sheet{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:50;display:flex;align-items:flex-end;justify-content:center}
.tp-sheet-panel{background:#121212;border-radius:16px 16px 0 0;width:100%;max-width:520px;max-height:70vh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}
.tp-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1a1a1a}
.tp-sheet-head button{background:none;border:none;color:#888;font-size:16px;cursor:pointer}
.tp-sheet-search{margin:10px 12px;padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;color:#fff;font-size:14px;outline:none}
.tp-sheet-list{overflow-y:auto;padding:0 8px 16px}
.tp-sheet-list button{display:block;width:100%;text-align:left;background:none;border:none;color:#ccc;padding:12px;font-size:14px;cursor:pointer;border-radius:6px}
.tp-sheet-list button.on{background:#1a1a1a;color:#f0b90b}
.tp-sheet-list button{display:flex;justify-content:space-between;align-items:center}
.tp-hot-up{color:#16c784;font-size:12px}
.tp-hot-down{color:#ea3943;font-size:12px}
.tp-keypad{position:fixed;left:0;right:0;bottom:0;z-index:60;background:#161616;border-top:1px solid #2a2a2a;padding:8px 8px calc(8px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto}
.tp-keypad-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.tp-key{background:#222;border:none;color:#fff;font-size:20px;padding:14px;border-radius:8px;cursor:pointer}
.tp-key.ok{grid-column:span 3;background:#f0b90b;color:#111;font-weight:700}
@media(min-width:768px){
  .tp-shell{max-width:960px;padding-bottom:24px}
  .tp-sticky{position:static;max-width:none;padding:12px 0;background:none}
  .tp-term-main{grid-template-columns:1fr 1fr}
}

.tp-account-tabs{display:flex;border-bottom:1px solid #161616;background:#0c0c0c}
.tp-account-tab{flex:1;background:none;border:none;color:#666;padding:10px 6px;font-size:12px;font-weight:700;cursor:pointer;position:relative}
.tp-account-tab.on{color:#f0b90b}
.tp-account-tab.on::after{content:"";position:absolute;bottom:0;left:25%;right:25%;height:2px;background:#f0b90b;border-radius:2px 2px 0 0}
.tp-account-panel{padding:16px 12px}
.tp-coming-soon{background:#141414;border:1px solid #222;border-radius:8px;padding:16px;margin-bottom:12px}
.tp-coming-soon h3{margin:0 0 8px;font-size:14px;color:#f0b90b}
.tp-coming-soon p{margin:0;font-size:12px;color:#888;line-height:1.5}
.tp-funding-note{font-size:12px;color:#888;margin:0 0 12px;line-height:1.4}
.tp-balance-card{background:#141414;border:1px solid #222;border-radius:8px;padding:12px;margin-bottom:8px}
.tp-balance-card .asset{font-weight:700;font-size:13px;margin-bottom:6px}
.tp-balance-card .row{display:flex;justify-content:space-between;font-size:12px;color:#888;padding:2px 0}
.tp-balance-card .row b{color:#ccc;font-variant-numeric:tabular-nums}
.tp-transfer-btn{width:100%;margin-top:12px;padding:12px;border:1px solid #f0b90b;background:#1a1608;color:#f0b90b;border-radius:8px;font-weight:700;cursor:pointer}
.tp-transfer-form{margin-top:12px;display:flex;flex-direction:column;gap:10px}
.tp-transfer-form label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#888}
.tp-transfer-form select,.tp-transfer-form input{background:#141414;border:1px solid #222;color:#eee;border-radius:6px;padding:10px;font-size:13px}
.tp-transfer-actions{display:flex;gap:8px}
.tp-transfer-actions button{flex:1;padding:10px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#ccc;cursor:pointer}
.tp-transfer-actions button.confirm{background:#f0b90b;color:#111;border-color:#f0b90b;font-weight:700}
`;
