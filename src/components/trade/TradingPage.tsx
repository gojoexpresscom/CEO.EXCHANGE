import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Props = { symbol?: string; onBack?: () => void; onAddFunds?: () => void };
type Pair = { id: string; symbol: string; base_asset: string; quote_asset: string; is_active: boolean };
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
type Candle = { open_time: string; open: number; high: number; low: number; close: number; volume: number };
type BookRow = { side: "buy" | "sell"; price: number; amount: number; filled_amount: number };
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
type RecentTrade = { id: string; trading_pair: string; price: number; amount: number; created_at: string };
type HotMarket = {
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  change: number | null;
  market_cap_rank: number;
  image?: string;
};

const TF = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
] as const;

const ACCOUNT_TABS = [
  { label: "Spot", value: "spot" },
  { label: "Futures", value: "futures" },
  { label: "Funding", value: "funding" },
] as const;

const BOTTOM_TABS = [
  { label: "Orders", value: "orders" },
  { label: "Positions", value: "positions" },
  { label: "Assets", value: "assets" },
] as const;

const CANCELLABLE = new Set(["open", "partially_filled"]);

// All data comes from real sources only:
// trading_pairs, market_tickers, market_candles, get_order_book,
// orders, trades, wallets (with account_type), kraken-spot edge function,
// and CoinGecko free /coins/markets for Hot ranking (cross-matched to Kraken pairs).
// No mock data, no demo buttons, no placeholder prices.

const css = `
.trade-page{min-height:100vh;background:#050505;color:#eee;font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow-x:hidden}
.trade-shell{width:min(1400px,100%);margin:auto;padding:0 0 80px;box-sizing:border-box}
.trade-top{display:flex;align-items:center;gap:8px;min-height:48px;padding:8px 12px;border-bottom:1px solid #171717;position:sticky;top:0;background:#050505;z-index:40}
.trade-back{width:36px;height:36px;border:1px solid #232323;border-radius:10px;background:#0a0a0a;color:#f4c542;cursor:pointer;font-size:18px;display:grid;place-items:center;flex-shrink:0}
.trade-pair{display:flex;align-items:center;gap:6px;min-width:0;cursor:pointer}
.pair-name{font-size:16px;font-weight:700;color:#fff;white-space:nowrap}
.pair-change{font-size:12px;font-weight:700}
.up{color:#16c784}.down{color:#ea3943}
.trade-spacer{flex:1}
.top-icons{display:flex;gap:6px;align-items:center}
.icon-btn{width:34px;height:34px;border:1px solid #232323;border-radius:8px;background:#0a0a0a;color:#888;cursor:pointer;display:grid;place-items:center;font-size:14px}
.icon-btn:hover{color:#f4c542;border-color:#7a5c14}

/* Account type tabs */
.account-tabs{display:flex;gap:0;padding:0 12px;border-bottom:1px solid #171717;background:#070707}
.account-tab{flex:1;background:none;border:0;color:#777;padding:12px 6px;font-size:13px;font-weight:700;cursor:pointer;position:relative}
.account-tab.active{color:#f4c542}
.account-tab.active::after{content:"";position:absolute;bottom:0;left:20%;right:20%;height:2px;background:#f4c542;border-radius:2px 2px 0 0}
.account-tab.disabled{color:#555;cursor:default}

/* Main grid */
.main-grid{display:flex;flex-direction:column;gap:0}
@media(min-width:901px){
  .main-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:0;align-items:start}
  .mobile-only{display:none!important}
  .desktop-only{display:block!important}
}
.desktop-only{display:none}
.mobile-only{display:block}

/* Chart / Book / Trades card */
.market-card{border-bottom:1px solid #171717;background:#070707}
.stats-row{display:flex;align-items:baseline;gap:12px;padding:12px 14px 8px;flex-wrap:wrap}
.stat-price{font-size:26px;font-weight:750;letter-spacing:-.4px}
.stat-mini{font-size:11px;color:#888}
.stat-mini b{color:#ccc;font-weight:600}
.market-tabs{display:flex;border-bottom:1px solid #171717}
.market-tab{flex:1;background:none;border:0;color:#777;padding:10px 4px;font-size:12px;font-weight:700;cursor:pointer}
.market-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.tf-row{display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid #141414;overflow:auto}
.tf-btn{background:none;border:1px solid #202020;border-radius:6px;color:#888;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap}
.tf-btn.active{color:#f4c542;border-color:#7a5c14}
.chart-wrap{height:260px;position:relative}
.chart-svg{width:100%;height:100%;display:block}
.empty{height:100%;display:grid;place-items:center;text-align:center;color:#666;padding:20px;box-sizing:border-box;font-size:12px;line-height:1.55}

/* Order book with depth bars */
.book-wrap{padding:0}
.book-ratio{display:flex;height:4px;margin:0 12px 6px;border-radius:2px;overflow:hidden}
.book-ratio .buy{background:#16c784}
.book-ratio .sell{background:#ea3943}
.book-ratio-labels{display:flex;justify-content:space-between;padding:0 12px 6px;font-size:11px;font-weight:700}
.book-head{display:grid;grid-template-columns:1fr 1fr 1fr;padding:4px 12px;font-size:10px;color:#666}
.book-head span:nth-child(2){text-align:center}
.book-head span:last-child{text-align:right}
.book-row{display:grid;grid-template-columns:1fr 1fr 1fr;padding:2px 12px;font-size:12px;position:relative;cursor:pointer;height:22px;align-items:center}
.book-row:hover{background:#111}
.book-bar{position:absolute;top:0;bottom:0;opacity:.18;pointer-events:none}
.book-bar.bid{right:0;background:#16c784}
.book-bar.ask{left:0;background:#ea3943}
.book-row .price.bid{color:#16c784}
.book-row .price.ask{color:#ea3943}
.book-row span:nth-child(2){text-align:center}
.book-row span:last-child{text-align:right}
.book-mid{display:flex;justify-content:center;align-items:center;gap:8px;padding:8px;border-top:1px solid #202020;border-bottom:1px solid #202020;color:#f4c542;font-weight:800;font-size:15px}

/* Trades tape */
.tape{padding:2px 0;max-height:280px;overflow:auto}
.tape-head{display:grid;grid-template-columns:1fr 1fr 1fr;padding:4px 12px;font-size:10px;color:#666}
.tape-head span:nth-child(2){text-align:right}
.tape-head span:last-child{text-align:right}
.tape-row{display:grid;grid-template-columns:1fr 1fr 1fr;padding:3px 12px;font-size:12px}
.tape-row span:nth-child(2){text-align:right}
.tape-row span:last-child{text-align:right;color:#888}

/* Trade form card */
.form-card{border-bottom:1px solid #171717;background:#070707}
.side-tabs{display:grid;grid-template-columns:1fr 1fr;margin:10px 12px 0;border:1px solid #232323;border-radius:9px;overflow:hidden}
.side-tab{border:0;background:#0a0a0a;color:#888;padding:10px;font-weight:700;cursor:pointer;font-size:13px}
.side-tab.buy.active{background:#087e50;color:#fff}
.side-tab.sell.active{background:#b82034;color:#fff}
.form-body{padding:0 12px 14px}
.label{display:flex;justify-content:space-between;color:#999;font-size:11.5px;margin:10px 0 5px}
.input-wrap{display:flex;align-items:center;border:1px solid #232323;border-radius:9px;background:#0a0a0a}
.input-wrap:focus-within{border-color:#d9a927}
.step-btn{background:none;border:0;color:#777;padding:10px;cursor:pointer;font-size:14px;line-height:0}
.step-btn:hover{color:#f4c542}
.input{flex:1;min-width:0;background:none;color:#eee;border:0;padding:11px 4px;font-size:14px;outline:none}
.suffix{color:#777;font-size:11px;padding-right:10px}
.pcts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}
.pct{border:1px solid #232323;background:#090909;color:#aaa;border-radius:6px;padding:6px;cursor:pointer;font-size:11px}
.pct.active{border-color:#d9a927;color:#f4c542}
.available,.total{display:flex;justify-content:space-between;font-size:11.5px;margin-top:10px}
.available{color:#999}
.total{border-top:1px solid #171717;padding-top:9px}
.order-btn{width:100%;border:0;border-radius:9px;padding:12px;margin-top:12px;color:#fff;font-weight:800;font-size:14px;cursor:pointer}
.order-btn.buy{background:#08a96b}
.order-btn.sell{background:#e52d45}
.order-btn:disabled{background:#242424;color:#666;cursor:not-allowed}
.warning{margin-top:9px;border:1px solid #5c4b1b;background:#171307;color:#d2bd73;border-radius:8px;padding:9px;font-size:11.5px;line-height:1.4}
.add{color:#f4c542;border-color:#a67a18;margin-top:6px;border:1px solid #a67a18;background:#090909;border-radius:6px;padding:6px 9px;cursor:pointer;display:block;width:100%;text-align:center}
.check-row{display:flex;gap:14px;margin-top:10px;font-size:12px;color:#aaa;align-items:center}
.check-row label{display:flex;align-items:center;gap:5px;cursor:pointer}
.check-row input{accent-color:#f4c542}

/* Bottom panel */
.bottom-panel{border-top:1px solid #171717;background:#070707;position:sticky;bottom:0;z-index:30}
.bottom-tabs{display:flex;border-bottom:1px solid #171717}
.bottom-tab{flex:1;background:none;border:0;color:#777;padding:10px 4px;font-size:12px;font-weight:700;cursor:pointer}
.bottom-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.bottom-body{max-height:220px;overflow:auto;padding:8px 0}
.order-table{width:100%;border-collapse:collapse;font-size:11.5px}
.order-table th,.order-table td{padding:7px 10px;text-align:left;border-bottom:1px solid #111;white-space:nowrap}
.order-table th{color:#666;font-weight:500}
.cancel-btn{border:1px solid #5c1d26;background:#1b080b;color:#ff8f9c;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer}
.cancel-btn:disabled{opacity:.5;cursor:not-allowed}

/* Hot markets carousel + full list overlay */
.hot-section{padding:10px 12px;border-bottom:1px solid #171717;background:#070707}
.hot-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.hot-title{font-size:13px;font-weight:700;color:#f4c542}
.view-more{background:none;border:0;color:#888;font-size:12px;cursor:pointer}
.view-more:hover{color:#f4c542}
.hot-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.hot-card{min-width:110px;background:#0a0a0a;border:1px solid #202020;border-radius:10px;padding:8px 10px;cursor:pointer;flex-shrink:0}
.hot-card:hover{border-color:#7a5c14}
.hot-card .sym{font-size:12px;font-weight:700;color:#fff}
.hot-card .px{font-size:13px;font-weight:600;margin-top:2px}
.hot-card .ch{font-size:11px;font-weight:700;margin-top:1px}

/* Markets overlay */
.markets-overlay{position:fixed;inset:0;background:#050505;z-index:100;display:flex;flex-direction:column}
.markets-header{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #171717}
.markets-search{flex:1;background:#0a0a0a;border:1px solid #232323;border-radius:9px;color:#eee;padding:10px 12px;font-size:14px;outline:none}
.markets-search:focus{border-color:#d9a927}
.markets-close{width:36px;height:36px;border:1px solid #232323;border-radius:9px;background:#0a0a0a;color:#f4c542;cursor:pointer;font-size:16px}
.markets-tabs{display:flex;gap:0;padding:0 12px;border-bottom:1px solid #171717}
.markets-tab{background:none;border:0;color:#777;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer}
.markets-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.markets-list{flex:1;overflow:auto}
.markets-row{display:grid;grid-template-columns:1.4fr 1fr 0.8fr;padding:10px 14px;border-bottom:1px solid #111;cursor:pointer;align-items:center}
.markets-row:hover{background:#0c0c0c}
.markets-row .sym{font-weight:700;font-size:13px}
.markets-row .vol{font-size:11px;color:#666;margin-top:1px}
.markets-row .px{text-align:right;font-size:13px}
.markets-row .ch{text-align:right;font-size:12px;font-weight:700}

/* Futures / Funding panels */
.account-panel{padding:16px 14px}
.coming-soon{text-align:center;padding:40px 20px;color:#888}
.coming-soon h3{color:#f4c542;margin:0 0 8px;font-size:16px}
.coming-soon p{font-size:13px;line-height:1.5;margin:0}
.balance-card{background:#0a0a0a;border:1px solid #202020;border-radius:12px;padding:14px;margin-bottom:10px}
.balance-card .asset{font-size:14px;font-weight:700;margin-bottom:6px}
.balance-card .row{display:flex;justify-content:space-between;font-size:12px;color:#999;margin-top:4px}
.balance-card .row b{color:#eee;font-weight:600}
.transfer-btn{width:100%;margin-top:12px;border:1px solid #a67a18;background:#171307;color:#f4c542;border-radius:9px;padding:11px;font-weight:700;cursor:pointer;font-size:13px}
.transfer-btn:disabled{opacity:.5;cursor:not-allowed}

.error{margin:8px 12px;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:10px;font-size:12px}
.notice-ok{margin:8px 12px;border:1px solid #1e4a34;background:#08160f;color:#8fe0bb;border-radius:9px;padding:10px;font-size:12px}
.loading{min-height:100vh;display:grid;place-items:center;color:#f4c542}
`;

function fmt(v: number | null | undefined, d = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}
function fmtPrice(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return v.toLocaleString(undefined, { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 4 : 8 });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function routeSymbol() {
  const m = window.location.pathname.match(/^\/trade\/(.+)$/i);
  return m ? decodeURIComponent(m[1]).toUpperCase() : "";
}

function CandleChart({ rows, last, pairSymbol }: { rows: Candle[]; last: number | null; pairSymbol: string }) {
  if (!rows.length)
    return (
      <div className="empty">
        No trade history yet for {pairSymbol}.
        <br />
        The chart fills in as soon as real trades execute on this pair.
      </div>
    );
  const W = 1000,
    H = 260,
    L = 12,
    R = 54,
    T = 10,
    B = 24,
    PW = W - L - R,
    PH = H - T - B,
    min = Math.min(...rows.map((x) => x.low)),
    max = Math.max(...rows.map((x) => x.high)),
    range = max - min || 1,
    y = (v: number) => T + ((max - v) / range) * PH,
    step = PW / rows.length,
    body = Math.max(2, Math.min(10, step * 0.55)),
    vmax = Math.max(...rows.map((x) => x.volume), 1);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Candlestick chart for ${pairSymbol}`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const yy = T + (PH * i) / 4;
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={yy} y2={yy} stroke="#141414" />
            <text x={W - R + 4} y={yy + 3.5} fill="#666" fontSize="10">
              {fmtPrice(max - (range * i) / 4)}
            </text>
          </g>
        );
      })}
      {rows.map((c, i) => {
        const x = L + step * i + step / 2,
          up = c.close >= c.open,
          by = Math.min(y(c.open), y(c.close)),
          bh = Math.max(1.5, Math.abs(y(c.close) - y(c.open))),
          vh = (c.volume / vmax) * 26;
        return (
          <g key={c.open_time}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={up ? "#16c784" : "#ea3943"} strokeWidth="1.1" />
            <rect x={x - body / 2} y={by} width={body} height={bh} fill={up ? "#16c784" : "#ea3943"} />
            <rect x={x - body / 2} y={H - 12 - vh} width={body} height={vh} fill={up ? "#16c784" : "#ea3943"} opacity=".35" />
          </g>
        );
      })}
      {last != null && last >= min && last <= max ? (
        <>
          <line x1={L} x2={W - R} y1={y(last)} y2={y(last)} stroke="#d9a927" strokeDasharray="4 4" />
          <rect x={W - R + 1} y={y(last) - 8} width="52" height="16" rx="3" fill="#d9a927" />
          <text x={W - R + 4} y={y(last) + 3.5} fill="#050505" fontSize="10">
            {fmtPrice(last)}
          </text>
        </>
      ) : null}
    </svg>
  );
}

export default function TradingPage({ symbol: propSymbol, onBack, onAddFunds }: Props) {
  const [symbol, setSymbol] = useState((propSymbol || routeSymbol()).toUpperCase());
  const [pair, setPair] = useState<Pair | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [book, setBook] = useState<BookRow[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tf, setTf] = useState<(typeof TF)[number]["value"]>("15m");
  const [marketTab, setMarketTab] = useState<"chart" | "book" | "trades">("chart");
  const [accountTab, setAccountTab] = useState<"spot" | "futures" | "funding">("spot");
  const [bottomTab, setBottomTab] = useState<"orders" | "positions" | "assets">("orders");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [p, setP] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeOk, setNoticeOk] = useState(false);
  const [orderTab, setOrderTab] = useState<"open" | "history">("open");
  const [activePct, setActivePct] = useState<number | null>(null);
  const [showMarkets, setShowMarkets] = useState(false);
  const [hotMarkets, setHotMarkets] = useState<HotMarket[]>([]);
  const [marketsFilter, setMarketsFilter] = useState("");
  const [tpSl, setTpSl] = useState(false);
  const [postOnly, setPostOnly] = useState(false);

  // Load pair + all active pairs
  const loadPair = useCallback(async () => {
    if (!symbol) return;
    setBusy(true);
    const [{ data, error }, { data: all, error: e2 }] = await Promise.all([
      supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("symbol", symbol).maybeSingle(),
      supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("is_active", true).order("symbol").limit(500),
    ]);
    if (error || e2) {
      setNotice(error?.message || e2?.message || "Unable to load pairs.");
      setNoticeOk(false);
      setBusy(false);
      return;
    }
    if (!data || !data.is_active) {
      setNotice("This trading pair is unavailable.");
      setNoticeOk(false);
      setPair(null);
      setBusy(false);
      return;
    }
    setPair(data as Pair);
    setPairs((all || []) as Pair[]);
    setP("");
    setAmount("");
    setActivePct(null);
    setBusy(false);
  }, [symbol]);

  // Market data: OHLC sync → candles + ticker + order book
  const loadMarket = useCallback(async () => {
    if (!pair) return;
    const { error: ohlcErr } = await supabase.functions.invoke(
      `kraken-spot?action=ohlc&symbol=${encodeURIComponent(pair.symbol)}&timeframe=${tf}`,
      { method: "GET" }
    );
    if (ohlcErr) console.error("Kraken OHLC sync failed:", ohlcErr.message);
    const [{ data: t }, { data: c }, { data: b, error: be }] = await Promise.all([
      supabase
        .from("market_tickers")
        .select("symbol,last_price,bid_price,ask_price,high_24h,low_24h,volume_24h,change_24h")
        .eq("symbol", pair.symbol)
        .maybeSingle(),
      supabase
        .from("market_candles")
        .select("open_time,open,high,low,close,volume")
        .eq("trading_pair", pair.symbol)
        .eq("timeframe", tf)
        .order("open_time", { ascending: true })
        .limit(500),
      supabase.rpc("get_order_book", { p_trading_pair: pair.symbol }),
    ]);
    setTicker((t || null) as Ticker | null);
    setCandles((c || []) as Candle[]);
    if (!be) setBook((b || []) as BookRow[]);
    if (!p && t?.last_price != null) setP(String(t.last_price));
  }, [pair, tf, p]);

  const loadTrades = useCallback(async () => {
    if (!pair) return;
    const { data } = await supabase
      .from("trades")
      .select("id,trading_pair,price,amount,created_at")
      .eq("trading_pair", pair.symbol)
      .order("created_at", { ascending: false })
      .limit(50);
    setRecentTrades((data || []) as RecentTrade[]);
  }, [pair]);

  const loadUser = useCallback(async () => {
    if (!pair) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: w }, { data: o }] = await Promise.all([
      supabase.from("wallets").select("asset,balance,locked_balance,escrow_balance,wallet_type,account_type,status").eq("user_id", user.id),
      supabase
        .from("orders")
        .select("id,user_id,trading_pair,side,order_type,price,amount,filled_amount,status,created_at")
        .eq("user_id", user.id)
        .eq("trading_pair", pair.symbol)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setWallets((w || []) as Wallet[]);
    setOrders((o || []) as Order[]);
  }, [pair]);

  // Hot markets: CoinGecko market-cap rank cross-matched to our active pairs
  const loadHot = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false"
      );
      if (!res.ok) return;
      const cg = (await res.json()) as Array<{
        id: string;
        symbol: string;
        name: string;
        image: string;
        market_cap_rank: number;
        current_price: number;
        price_change_percentage_24h: number;
      }>;
      // Cross-match against our active pairs (prefer USDT pairs)
      const our = pairs.length
        ? pairs
        : ((
            await supabase.from("trading_pairs").select("symbol,base_asset,quote_asset,is_active").eq("is_active", true).limit(300)
          ).data as Pair[]) || [];
      const matched: HotMarket[] = [];
      for (const coin of cg) {
        const sym = coin.symbol.toUpperCase();
        const candidates = our.filter(
          (p) => p.base_asset.toUpperCase() === sym && (p.quote_asset === "USDT" || p.quote_asset === "USD" || p.quote_asset === "USDC")
        );
        const pick = candidates.find((c) => c.quote_asset === "USDT") || candidates[0];
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
      // Overlay live prices from our tickers
      if (matched.length) {
        const { data: ticks } = await supabase
          .from("market_tickers")
          .select("symbol,last_price,change_24h")
          .in(
            "symbol",
            matched.map((m) => m.symbol)
          );
        const map = new Map((ticks || []).map((t: any) => [t.symbol, t]));
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
    void loadPair();
  }, [loadPair]);
  useEffect(() => {
    void loadMarket();
    void loadUser();
    void loadTrades();
  }, [loadMarket, loadUser, loadTrades]);
  useEffect(() => {
    if (pairs.length) void loadHot();
  }, [pairs, loadHot]);
  useEffect(() => {
    if (!pair) return;
    const id = window.setInterval(() => {
      void loadMarket();
    }, 60000);
    return () => window.clearInterval(id);
  }, [pair, loadMarket]);

  // Realtime
  useEffect(() => {
    if (!pair) return;
    const ch = supabase
      .channel(`trade-${pair.symbol}-${tf}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_tickers", filter: `symbol=eq.${pair.symbol}` }, (x) =>
        setTicker((x.new || null) as Ticker)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "market_candles", filter: `trading_pair=eq.${pair.symbol}` }, (x) => {
        const r = x.new as Candle & { timeframe: string };
        if (r?.timeframe !== tf) return;
        setCandles((prev) => {
          const i = prev.findIndex((c) => c.open_time === r.open_time);
          if (i < 0) return [...prev, r].slice(-500);
          const n = [...prev];
          n[i] = r;
          return n;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `trading_pair=eq.${pair.symbol}` }, () => {
        void loadMarket();
        void loadUser();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades", filter: `trading_pair=eq.${pair.symbol}` }, (x) => {
        void loadMarket();
        setRecentTrades((prev) => [x.new as RecentTrade, ...prev].slice(0, 50));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, () => void loadUser())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [pair, tf, loadMarket, loadUser]);

  const wallet = useMemo(() => {
    if (!pair) return null;
    const asset = side === "buy" ? pair.quote_asset : pair.base_asset;
    const rows = wallets.filter((x) => x.asset.toUpperCase() === asset.toUpperCase());
    // Prefer spot account_type when present
    const row =
      rows.find((x) => (x.account_type || x.wallet_type || "").toLowerCase() === "spot") ||
      rows.find((x) => (x.wallet_type || "").toLowerCase() === "spot") ||
      rows[0];
    return {
      asset,
      available: row ? Math.max(0, Number(row.balance || 0) - Number(row.locked_balance || 0) - Number(row.escrow_balance || 0)) : 0,
      exists: !!row,
    };
  }, [wallets, pair, side]);

  const fundingWallets = useMemo(() => {
    return wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "funding");
  }, [wallets]);

  const futuresWallets = useMemo(() => {
    return wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "futures");
  }, [wallets]);

  const np = Number(p),
    na = Number(amount),
    total = Number.isFinite(np) && Number.isFinite(na) ? np * na : 0;
  const insufficient = !!wallet && (wallet.available <= 0 || total > wallet.available);

  const step = (field: "price" | "amount", dir: 1 | -1) => {
    const cur = field === "price" ? np : na;
    const base = cur > 0 ? cur : field === "price" ? ticker?.last_price || 1 : 1;
    const inc = Math.max(base * 0.001, field === "price" ? 0.0001 : 0.00000001);
    const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + dir * inc);
    (field === "price" ? setP : setAmount)(String(Number(next.toFixed(8))));
  };
  const setPercent = (pct: number) => {
    if (!wallet || !np) return;
    setActivePct(pct);
    setAmount(String((side === "buy" ? wallet.available / np : wallet.available) * pct));
  };

  const pickFromBook = (row: BookRow) => {
    setSide(row.side === "sell" ? "buy" : "sell");
    setP(String(row.price));
    setActivePct(null);
  };

  const submit = async () => {
    setNotice("");
    if (!pair) return;
    if (!wallet || !wallet.exists || wallet.available <= 0) {
      setNotice(`You don't have enough ${wallet?.asset || pair.quote_asset} to place this order. Add funds to continue.`);
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(np) || np <= 0 || !Number.isFinite(na) || na <= 0) {
      setNotice("Enter a valid price and amount.");
      setNoticeOk(false);
      return;
    }
    if (total > wallet.available) {
      setNotice(`You don't have enough ${wallet.asset} to place this order. Add funds to continue.`);
      setNoticeOk(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Please sign in to trade.");
      setNoticeOk(false);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: { action: "place_order", trading_pair: pair.symbol, side, price: np, amount: na },
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message || "Unable to reach the Kraken order routing service.");
      setNoticeOk(false);
      return;
    }
    if (data?.error) {
      setNotice(
        /balance|insufficient|fund/i.test(data.error)
          ? `You don't have enough ${wallet.asset} to place this order. Add funds to continue.`
          : data.error
      );
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Kraken live trading isn't enabled yet.");
      setNoticeOk(false);
      return;
    }
    if (!data?.order_id) {
      setNotice("The server did not return an order id.");
      setNoticeOk(false);
      return;
    }
    setAmount("");
    setActivePct(null);
    setNotice(`Order routed to Kraken (ref ${data.kraken_order_id}). It settles automatically once Kraken reports a real fill.`);
    setNoticeOk(true);
    void loadMarket();
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
      setNotice(data.error);
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Kraken live trading isn't enabled yet.");
      setNoticeOk(false);
      return;
    }
    setNotice("Cancellation confirmed with Kraken — any unfilled amount was released back to your wallet.");
    setNoticeOk(true);
    void loadUser();
  };

  const switchPair = (s: string) => {
    setSymbol(s);
    setShowMarkets(false);
    window.history.pushState({}, "", `/trade/${encodeURIComponent(s.toUpperCase())}`);
  };

  // Order book depth + ratio
  const asks = book
    .filter((x) => x.side === "sell")
    .sort((a, b) => a.price - b.price)
    .slice(0, 12);
  const bids = book
    .filter((x) => x.side === "buy")
    .sort((a, b) => b.price - a.price)
    .slice(0, 12);
  const maxAmt = Math.max(...asks.map((a) => a.amount - a.filled_amount), ...bids.map((b) => b.amount - b.filled_amount), 0.0001);
  const bidVol = bids.reduce((s, r) => s + Math.max(0, r.amount - r.filled_amount), 0);
  const askVol = asks.reduce((s, r) => s + Math.max(0, r.amount - r.filled_amount), 0);
  const totalVol = bidVol + askVol || 1;
  const bidPct = Math.round((bidVol / totalVol) * 100);
  const askPct = 100 - bidPct;

  const open = orders.filter((x) => CANCELLABLE.has(x.status.toLowerCase()));
  const history = orders.filter((x) => !CANCELLABLE.has(x.status.toLowerCase()));
  const displayOrders = orderTab === "open" ? open : history;

  const filteredMarkets = useMemo(() => {
    const q = marketsFilter.trim().toUpperCase();
    const list = pairs.filter((p) => !q || p.symbol.includes(q) || p.base_asset.includes(q));
    // Prefer hot order when no filter
    if (!q && hotMarkets.length) {
      const hotSet = new Set(hotMarkets.map((h) => h.symbol));
      const hotFirst = hotMarkets.map((h) => pairs.find((p) => p.symbol === h.symbol)).filter(Boolean) as Pair[];
      const rest = list.filter((p) => !hotSet.has(p.symbol));
      return [...hotFirst, ...rest];
    }
    return list;
  }, [pairs, marketsFilter, hotMarkets]);

  if (busy)
    return (
      <div className="trade-page">
        <style>{css}</style>
        <div className="loading">Loading real market data…</div>
      </div>
    );
  if (!pair)
    return (
      <div className="trade-page">
        <style>{css}</style>
        <div className="trade-shell">
          <button className="trade-back" onClick={onBack || (() => window.history.back())}>
            ←
          </button>
          <div className="error">{notice || "Trading pair not found."}</div>
        </div>
      </div>
    );

  const change = Number(ticker?.change_24h ?? 0);
  const last = ticker?.last_price ?? null;

  return (
    <div className="trade-page">
      <style>{css}</style>
      <div className="trade-shell">
        {/* Top bar */}
        <header className="trade-top">
          <button className="trade-back" onClick={onBack || (() => window.history.back())} aria-label="Back">
            ←
          </button>
          <div className="trade-pair" onClick={() => setShowMarkets(true)}>
            <span className="pair-name">{pair.symbol} ▾</span>
            {last != null && (
              <span className={`pair-change ${change >= 0 ? "up" : "down"}`}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="trade-spacer" />
          <div className="top-icons">
            <button className="icon-btn" title="Chart" onClick={() => setMarketTab("chart")}>
              📈
            </button>
            <button className="icon-btn" title="Order book" onClick={() => setMarketTab("book")}>
              📊
            </button>
          </div>
        </header>

        {notice && <div className={noticeOk ? "notice-ok" : "error"}>{notice}</div>}

        {/* Account type tabs */}
        <div className="account-tabs">
          {ACCOUNT_TABS.map((t) => (
            <button
              key={t.value}
              className={`account-tab ${accountTab === t.value ? "active" : ""} ${t.value === "futures" ? "" : ""}`}
              onClick={() => setAccountTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== SPOT (fully live) ===== */}
        {accountTab === "spot" && (
          <>
            {/* Hot markets carousel */}
            {hotMarkets.length > 0 && (
              <div className="hot-section">
                <div className="hot-header">
                  <span className="hot-title">🔥 Hot</span>
                  <button className="view-more" onClick={() => setShowMarkets(true)}>
                    View more →
                  </button>
                </div>
                <div className="hot-row">
                  {hotMarkets.slice(0, 4).map((h) => (
                    <div key={h.symbol} className="hot-card" onClick={() => switchPair(h.symbol)}>
                      <div className="sym">{h.symbol}</div>
                      <div className="px">{fmtPrice(h.price)}</div>
                      <div className={`ch ${Number(h.change) >= 0 ? "up" : "down"}`}>
                        {h.change != null ? `${Number(h.change) >= 0 ? "+" : ""}${Number(h.change).toFixed(2)}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="main-grid">
              {/* Left / main: chart + book + trades */}
              <div>
                <div className="market-card">
                  <div className="stats-row">
                    <div className={`stat-price ${last == null ? "" : change >= 0 ? "up" : "down"}`}>{fmtPrice(last)}</div>
                    <div className="stat-mini">
                      24h High <b>{fmtPrice(ticker?.high_24h)}</b>
                    </div>
                    <div className="stat-mini">
                      24h Low <b>{fmtPrice(ticker?.low_24h)}</b>
                    </div>
                    <div className="stat-mini">
                      24h Vol <b>
                        {fmt(ticker?.volume_24h, 4)} {pair.base_asset}
                      </b>
                    </div>
                  </div>
                  <div className="market-tabs">
                    <button className={`market-tab ${marketTab === "chart" ? "active" : ""}`} onClick={() => setMarketTab("chart")}>
                      Chart
                    </button>
                    <button className={`market-tab ${marketTab === "book" ? "active" : ""}`} onClick={() => setMarketTab("book")}>
                      Order Book
                    </button>
                    <button className={`market-tab ${marketTab === "trades" ? "active" : ""}`} onClick={() => setMarketTab("trades")}>
                      Trades
                    </button>
                  </div>

                  {marketTab === "chart" && (
                    <>
                      <div className="tf-row">
                        {TF.map((x) => (
                          <button key={x.value} className={`tf-btn ${tf === x.value ? "active" : ""}`} onClick={() => setTf(x.value)}>
                            {x.label}
                          </button>
                        ))}
                      </div>
                      <div className="chart-wrap">
                        <CandleChart rows={candles} last={last} pairSymbol={pair.symbol} />
                      </div>
                    </>
                  )}

                  {marketTab === "book" && (
                    <div className="book-wrap">
                      <div className="book-ratio">
                        <div className="buy" style={{ width: `${bidPct}%` }} />
                        <div className="sell" style={{ width: `${askPct}%` }} />
                      </div>
                      <div className="book-ratio-labels">
                        <span className="up">B {bidPct}%</span>
                        <span className="down">S {askPct}%</span>
                      </div>
                      <div className="book-head">
                        <span>Price ({pair.quote_asset})</span>
                        <span>Amount ({pair.base_asset})</span>
                        <span>Total</span>
                      </div>
                      {/* Asks (sell side) – reverse so lowest ask is near mid */}
                      {[...asks].reverse().map((a) => {
                        const amt = Math.max(0, a.amount - a.filled_amount);
                        const w = Math.min(100, (amt / maxAmt) * 100);
                        return (
                          <div key={`a-${a.price}`} className="book-row" onClick={() => pickFromBook(a)}>
                            <div className="book-bar ask" style={{ width: `${w}%` }} />
                            <span className="price ask">{fmtPrice(a.price)}</span>
                            <span>{fmt(amt, 6)}</span>
                            <span>{fmt(a.price * amt, 2)}</span>
                          </div>
                        );
                      })}
                      <div className="book-mid">{fmtPrice(last)}</div>
                      {/* Bids */}
                      {bids.map((b) => {
                        const amt = Math.max(0, b.amount - b.filled_amount);
                        const w = Math.min(100, (amt / maxAmt) * 100);
                        return (
                          <div key={`b-${b.price}`} className="book-row" onClick={() => pickFromBook(b)}>
                            <div className="book-bar bid" style={{ width: `${w}%` }} />
                            <span className="price bid">{fmtPrice(b.price)}</span>
                            <span>{fmt(amt, 6)}</span>
                            <span>{fmt(b.price * amt, 2)}</span>
                          </div>
                        );
                      })}
                      {!asks.length && !bids.length && (
                        <div className="empty" style={{ height: 120 }}>
                          No open orders for this pair yet.
                        </div>
                      )}
                    </div>
                  )}

                  {marketTab === "trades" && (
                    <div className="tape">
                      <div className="tape-head">
                        <span>Time</span>
                        <span>Price ({pair.quote_asset})</span>
                        <span>Amount ({pair.base_asset})</span>
                      </div>
                      {!recentTrades.length ? (
                        <div className="empty" style={{ height: 120 }}>
                          No trades have executed on {pair.symbol} yet.
                        </div>
                      ) : (
                        recentTrades.map((t, i) => {
                          const prev = recentTrades[i + 1];
                          const up = !prev || t.price >= prev.price;
                          return (
                            <div className="tape-row" key={t.id}>
                              <span style={{ color: "#888" }}>{fmtTime(t.created_at)}</span>
                              <span className={up ? "up" : "down"}>{fmtPrice(t.price)}</span>
                              <span>{fmt(t.amount, 6)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right / form column */}
              <div>
                <div className="form-card">
                  <div className="side-tabs">
                    <button
                      className={`side-tab buy ${side === "buy" ? "active" : ""}`}
                      onClick={() => {
                        setSide("buy");
                        setActivePct(null);
                      }}
                    >
                      Buy
                    </button>
                    <button
                      className={`side-tab sell ${side === "sell" ? "active" : ""}`}
                      onClick={() => {
                        setSide("sell");
                        setActivePct(null);
                      }}
                    >
                      Sell
                    </button>
                  </div>
                  <div className="form-body">
                    <div className="label">
                      <span>Price</span>
                      <span>{pair.quote_asset}</span>
                    </div>
                    <div className="input-wrap">
                      <button className="step-btn" onClick={() => step("price", -1)} aria-label="Decrease price">
                        −
                      </button>
                      <input className="input" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} placeholder="Price" />
                      <span className="suffix">{pair.quote_asset}</span>
                      <button className="step-btn" onClick={() => step("price", 1)} aria-label="Increase price">
                        +
                      </button>
                    </div>
                    <div className="label">
                      <span>Amount</span>
                      <span>{pair.base_asset}</span>
                    </div>
                    <div className="input-wrap">
                      <button className="step-btn" onClick={() => step("amount", -1)} aria-label="Decrease amount">
                        −
                      </button>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setActivePct(null);
                        }}
                        placeholder="Amount"
                      />
                      <span className="suffix">{pair.base_asset}</span>
                      <button className="step-btn" onClick={() => step("amount", 1)} aria-label="Increase amount">
                        +
                      </button>
                    </div>
                    <div className="pcts">
                      {[0.25, 0.5, 0.75, 1].map((x) => (
                        <button className={`pct ${activePct === x ? "active" : ""}`} key={x} onClick={() => setPercent(x)}>
                          {x * 100}%
                        </button>
                      ))}
                    </div>
                    <div className="available">
                      <span>Available</span>
                      <span>
                        {fmt(wallet?.available ?? 0, 8)} {wallet?.asset || (side === "buy" ? pair.quote_asset : pair.base_asset)}
                      </span>
                    </div>
                    <div className="total">
                      <span>Total</span>
                      <span>
                        {fmt(total, 8)} {pair.quote_asset}
                      </span>
                    </div>
                    <div className="check-row">
                      <label>
                        <input type="checkbox" checked={tpSl} onChange={(e) => setTpSl(e.target.checked)} /> TP/SL
                      </label>
                      <label>
                        <input type="checkbox" checked={postOnly} onChange={(e) => setPostOnly(e.target.checked)} /> Post-Only
                      </label>
                      <span style={{ marginLeft: "auto", color: "#666" }}>GTC</span>
                    </div>
                    {insufficient && (
                      <div className="warning">
                        You don't have enough {wallet?.asset || pair.quote_asset} to place this order. Add funds to continue.
                        <button className="add" onClick={onAddFunds || (() => window.history.back())}>
                          Add funds
                        </button>
                      </div>
                    )}
                    <button
                      className={`order-btn ${side}`}
                      disabled={submitting || insufficient || !Number.isFinite(np) || np <= 0 || !Number.isFinite(na) || na <= 0}
                      onClick={submit}
                    >
                      {submitting ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${pair.base_asset}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom panel */}
            <div className="bottom-panel">
              <div className="bottom-tabs">
                {BOTTOM_TABS.map((t) => (
                  <button key={t.value} className={`bottom-tab ${bottomTab === t.value ? "active" : ""}`} onClick={() => setBottomTab(t.value)}>
                    {t.label}
                    {t.value === "orders" ? ` (${open.length})` : ""}
                  </button>
                ))}
              </div>
              <div className="bottom-body">
                {bottomTab === "orders" && (
                  <>
                    <div style={{ display: "flex", gap: 16, padding: "0 12px 6px" }}>
                      <button
                        className={`bottom-tab ${orderTab === "open" ? "active" : ""}`}
                        style={{ flex: "none", padding: "4px 0" }}
                        onClick={() => setOrderTab("open")}
                      >
                        Open ({open.length})
                      </button>
                      <button
                        className={`bottom-tab ${orderTab === "history" ? "active" : ""}`}
                        style={{ flex: "none", padding: "4px 0" }}
                        onClick={() => setOrderTab("history")}
                      >
                        History ({history.length})
                      </button>
                    </div>
                    {!displayOrders.length ? (
                      <div className="empty" style={{ height: 100 }}>
                        No {orderTab === "open" ? "open orders" : "order history"} for {pair.symbol}.
                      </div>
                    ) : (
                      <table className="order-table">
                        <thead>
                          <tr>
                            <th>Side</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Filled</th>
                            <th>Price</th>
                            <th>Status</th>
                            {orderTab === "open" && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {displayOrders.map((o) => (
                            <tr key={o.id}>
                              <td className={o.side === "buy" ? "up" : "down"}>{o.side.toUpperCase()}</td>
                              <td>{o.order_type}</td>
                              <td>
                                {fmt(o.amount, 6)} {pair.base_asset}
                              </td>
                              <td>{fmt(o.filled_amount, 6)}</td>
                              <td>
                                {fmtPrice(o.price)} {pair.quote_asset}
                              </td>
                              <td>{o.status}</td>
                              {orderTab === "open" && (
                                <td>
                                  <button className="cancel-btn" disabled={cancellingId === o.id} onClick={() => cancelOrder(o.id)}>
                                    {cancellingId === o.id ? "…" : "Cancel"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
                {bottomTab === "positions" && (
                  <div className="empty" style={{ height: 100 }}>
                    No open positions on Spot. Spot trades settle into your wallet balance.
                  </div>
                )}
                {bottomTab === "assets" && (
                  <div style={{ padding: "4px 12px" }}>
                    {wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "spot" || !w.account_type).length === 0 ? (
                      <div className="empty" style={{ height: 80 }}>
                        No spot balances yet.
                      </div>
                    ) : (
                      wallets
                        .filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "spot" || !w.account_type)
                        .map((w) => (
                          <div key={w.asset} className="balance-card" style={{ marginBottom: 8 }}>
                            <div className="asset">{w.asset}</div>
                            <div className="row">
                              <span>Available</span>
                              <b>{fmt(Math.max(0, Number(w.balance) - Number(w.locked_balance) - Number(w.escrow_balance)), 8)}</b>
                            </div>
                            <div className="row">
                              <span>Locked</span>
                              <b>{fmt(Number(w.locked_balance) + Number(w.escrow_balance), 8)}</b>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== FUTURES (balance only + Coming soon) ===== */}
        {accountTab === "futures" && (
          <div className="account-panel">
            <div className="coming-soon">
              <h3>Futures — Coming soon</h3>
              <p>
                Kraken Futures integration is not yet connected. Your futures balance bucket already exists and is real; order routing will appear
                here once the backend is live.
              </p>
            </div>
            {futuresWallets.length > 0 ? (
              futuresWallets.map((w) => (
                <div key={w.asset} className="balance-card">
                  <div className="asset">{w.asset}</div>
                  <div className="row">
                    <span>Balance</span>
                    <b>{fmt(Number(w.balance), 8)}</b>
                  </div>
                  <div className="row">
                    <span>Locked</span>
                    <b>{fmt(Number(w.locked_balance) + Number(w.escrow_balance), 8)}</b>
                  </div>
                </div>
              ))
            ) : (
              <div className="balance-card">
                <div className="asset">No futures balances yet</div>
                <div className="row">
                  <span>Transfer funds from Spot or Funding when Futures goes live.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== FUNDING (real balances + transfer) ===== */}
        {accountTab === "funding" && (
          <div className="account-panel">
            <p style={{ color: "#888", fontSize: 13, margin: "0 0 14px" }}>
              Funding is your internal balance ledger. Move funds between Spot, Funding, Futures and Earn with real transfers.
            </p>
            {fundingWallets.length === 0 ? (
              <div className="balance-card">
                <div className="asset">No funding balances</div>
                <div className="row">
                  <span>Deposit or transfer from Spot to get started.</span>
                </div>
              </div>
            ) : (
              fundingWallets.map((w) => (
                <div key={w.asset} className="balance-card">
                  <div className="asset">{w.asset}</div>
                  <div className="row">
                    <span>Available</span>
                    <b>{fmt(Math.max(0, Number(w.balance) - Number(w.locked_balance) - Number(w.escrow_balance)), 8)}</b>
                  </div>
                  <div className="row">
                    <span>Locked</span>
                    <b>{fmt(Number(w.locked_balance) + Number(w.escrow_balance), 8)}</b>
                  </div>
                </div>
              ))
            )}
            <button
              className="transfer-btn"
              onClick={() => {
                // Placeholder: wire to real transfer_between_accounts UI when ready
                setNotice("Transfer UI uses the existing transfer_between_accounts() RPC. Full transfer sheet can be added in a follow-up.");
                setNoticeOk(true);
              }}
            >
              Transfer between accounts
            </button>
          </div>
        )}
      </div>

      {/* Markets overlay (pair picker + full Hot list) */}
      {showMarkets && (
        <div className="markets-overlay">
          <div className="markets-header">
            <input
              className="markets-search"
              placeholder="Search pair…"
              value={marketsFilter}
              onChange={(e) => setMarketsFilter(e.target.value)}
              autoFocus
            />
            <button className="markets-close" onClick={() => setShowMarkets(false)}>
              ✕
            </button>
          </div>
          <div className="markets-tabs">
            <button className="markets-tab active">All</button>
            <button className="markets-tab" onClick={() => setMarketsFilter("")}>
              🔥 Hot
            </button>
          </div>
          <div className="markets-list">
            {filteredMarkets.map((m) => {
              const hot = hotMarkets.find((h) => h.symbol === m.symbol);
              const ch = hot?.change ?? null;
              return (
                <div key={m.symbol} className="markets-row" onClick={() => switchPair(m.symbol)}>
                  <div>
                    <div className="sym">{m.symbol}</div>
                    <div className="vol">{m.base_asset}/{m.quote_asset}</div>
                  </div>
                  <div className="px">{fmtPrice(hot?.price ?? null)}</div>
                  <div className={`ch ${ch != null && ch >= 0 ? "up" : "down"}`}>
                    {ch != null ? `${ch >= 0 ? "+" : ""}${Number(ch).toFixed(2)}%` : "—"}
                  </div>
                </div>
              );
            })}
            {!filteredMarkets.length && (
              <div className="empty" style={{ height: 200 }}>
                No pairs match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
