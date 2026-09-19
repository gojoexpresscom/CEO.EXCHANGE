import { useEffect, useRef, useState } from "react";
import { BybitWebSocket, type BybitMarketMessage } from "./BybitWebSocket";

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

type RecentTrade = {
  id: string;
  trading_pair?: string;
  price: number;
  amount: number;
  created_at: string;
};

type MarketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "unsupported";

type BybitTicker = {
  symbol?: string;
  lastPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
  highPrice24h?: string;
  lowPrice24h?: string;
  volume24h?: string;
  price24hPcnt?: string;
};

type BybitKline = {
  start?: number | string;
  end?: number | string;
  interval?: string;
  open?: string;
  close?: string;
  high?: string;
  low?: string;
  volume?: string;
  turnover?: string;
  confirm?: boolean;
  timestamp?: number | string;
};

type BybitOrderbook = {
  s?: string;
  b?: unknown;
  a?: unknown;
  /** Bybit WS: "snapshot" | "delta" — deltas must merge, not replace. */
  u?: number;
};

type BybitTrade = {
  T?: number | string;
  s?: string;
  S?: string;
  v?: string;
  p?: string;
  i?: string;
};

type BybitRestResponse<T> = {
  retCode?: number;
  retMsg?: string;
  result?: T;
};

const BYBIT_REST = "https://api.bybit.com";

const MAX_CANDLES = 500;
const MAX_TRADES = 80;

const TIMEFRAME_MAP: Record<string, string> = {
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function makeBybitSymbol(
  baseAsset: string | null,
  quoteAsset: string | null,
): string | null {
  const base = baseAsset?.trim().toUpperCase();
  const quote = quoteAsset?.trim().toUpperCase();

  if (!base || !quote) {
    return null;
  }

  const symbol = `${base}${quote}`;

  // Bybit Spot symbols are uppercase alphanumeric symbols.
  if (!/^[A-Z0-9]+$/.test(symbol)) {
    return null;
  }

  return symbol;
}

function getInterval(timeframe: string): string | null {
  return TIMEFRAME_MAP[timeframe] || null;
}

function parseTicker(data: unknown): Ticker | null {
  const raw = Array.isArray(data)
    ? (data[0] as BybitTicker | undefined)
    : (data as BybitTicker | undefined);

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const symbol = toStringValue(raw.symbol);

  if (!symbol) {
    return null;
  }

  return {
    symbol,
    last_price: toNumber(raw.lastPrice),
    bid_price: toNumber(raw.bid1Price),
    ask_price: toNumber(raw.ask1Price),
    high_24h: toNumber(raw.highPrice24h),
    low_24h: toNumber(raw.lowPrice24h),
    volume_24h: toNumber(raw.volume24h),
    change_24h: (() => {
      const pct = toNumber(raw.price24hPcnt);
      return pct == null ? null : pct * 100;
    })(),
  };
}

function mergeTicker(
  previous: Ticker | null,
  next: Ticker,
): Ticker {
  if (!previous || previous.symbol !== next.symbol) {
    return next;
  }

  return {
    symbol: next.symbol,
    last_price: next.last_price ?? previous.last_price,
    bid_price: next.bid_price ?? previous.bid_price,
    ask_price: next.ask_price ?? previous.ask_price,
    high_24h: next.high_24h ?? previous.high_24h,
    low_24h: next.low_24h ?? previous.low_24h,
    volume_24h: next.volume_24h ?? previous.volume_24h,
    change_24h: next.change_24h ?? previous.change_24h,
  };
}

function parseCandle(raw: BybitKline): Candle | null {
  const start = toNumber(raw.start);
  const open = toNumber(raw.open);
  const high = toNumber(raw.high);
  const low = toNumber(raw.low);
  const close = toNumber(raw.close);
  const volume = toNumber(raw.volume);

  if (
    start == null ||
    open == null ||
    high == null ||
    low == null ||
    close == null ||
    volume == null
  ) {
    return null;
  }

  return {
    open_time: new Date(start).toISOString(),
    open,
    high,
    low,
    close,
    volume,
  };
}

function parseBookRows(
  rawRows: unknown,
  side: "buy" | "sell",
): BookRow[] {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  const result: BookRow[] = [];

  for (const item of rawRows) {
    if (!Array.isArray(item) || item.length < 2) {
      continue;
    }

    const price = toNumber(item[0]);
    const amount = toNumber(item[1]);

    if (price == null || amount == null || price <= 0 || amount < 0) {
      continue;
    }

    result.push({
      side,
      price,
      amount,
      filled_amount: 0,
    });
  }

  return result;
}

function parseBook(data: unknown): BookRow[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const raw = data as BybitOrderbook;

  const bids = parseBookRows(raw.b, "buy");
  const asks = parseBookRows(raw.a, "sell");

  // Highest bids first.
  bids.sort((a, b) => b.price - a.price);

  // Lowest asks first.
  asks.sort((a, b) => a.price - b.price);

  return [...asks, ...bids];
}

/** Apply Bybit levels into a price→amount map. qty 0 removes the level. */
function applyBookSide(
  map: Map<number, number>,
  rows: BookRow[],
  replace: boolean,
): void {
  if (replace) map.clear();
  for (const row of rows) {
    if (row.amount <= 0) {
      map.delete(row.price);
    } else {
      map.set(row.price, row.amount);
    }
  }
}

function mapsToBookRows(
  bidMap: Map<number, number>,
  askMap: Map<number, number>,
): BookRow[] {
  const asks: BookRow[] = [];
  for (const [price, amount] of askMap) {
    asks.push({ side: "sell", price, amount, filled_amount: 0 });
  }
  asks.sort((a, b) => a.price - b.price);

  const bids: BookRow[] = [];
  for (const [price, amount] of bidMap) {
    bids.push({ side: "buy", price, amount, filled_amount: 0 });
  }
  bids.sort((a, b) => b.price - a.price);

  // Cap depth for UI (level-50 can be large)
  return [...asks.slice(0, 50), ...bids.slice(0, 50)];
}


function parseTrades(
  data: unknown,
  fallbackSymbol: string,
): RecentTrade[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const result: RecentTrade[] = [];

  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as BybitTrade;

    const price = toNumber(raw.p);
    const amount = toNumber(raw.v);
    const timestamp = toNumber(raw.T);

    if (price == null || amount == null || timestamp == null) {
      continue;
    }

    const id =
      toStringValue(raw.i) ||
      `${fallbackSymbol}-${timestamp}-${price}-${amount}`;

    result.push({
      id,
      trading_pair: fallbackSymbol,
      price,
      amount,
      created_at: new Date(timestamp).toISOString(),
    });
  }

  return result;
}

function upsertCandle(
  current: Candle[],
  incoming: Candle,
): Candle[] {
  const next = current.slice();

  const existingIndex = next.findIndex(
    (candle) => candle.open_time === incoming.open_time,
  );

  if (existingIndex >= 0) {
    next[existingIndex] = incoming;
  } else {
    next.push(incoming);
  }

  next.sort(
    (a, b) =>
      new Date(a.open_time).getTime() -
      new Date(b.open_time).getTime(),
  );

  if (next.length > MAX_CANDLES) {
    return next.slice(next.length - MAX_CANDLES);
  }

  return next;
}

function prependOrUpdateTrade(
  current: RecentTrade[],
  incoming: RecentTrade,
): RecentTrade[] {
  const withoutExisting = current.filter(
    (trade) => trade.id !== incoming.id,
  );

  const next = [incoming, ...withoutExisting];

  return next.slice(0, MAX_TRADES);
}

async function fetchBybit<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`${BYBIT_REST}${path}`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Bybit HTTP ${response.status}`);
  }

  const json = (await response.json()) as BybitRestResponse<T>;

  if (json.retCode !== 0) {
    throw new Error(json.retMsg || "Bybit request failed.");
  }

  if (!json.result) {
    throw new Error("Bybit returned an empty result.");
  }

  return json.result;
}

export function useBybitMarketData(
  baseAsset: string | null,
  quoteAsset: string | null,
  timeframe: string,
): {
  ticker: Ticker | null;
  candles: Candle[];
  book: BookRow[];
  trades: RecentTrade[];
  status: MarketStatus;
} {
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [book, setBook] = useState<BookRow[]>([]);
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [status, setStatus] = useState<MarketStatus>("connecting");

  const websocketRef = useRef<BybitWebSocket | null>(null);

  // Presentation coalescing: keep receiving every WS message, but flush
  // ticker/book to React at most once per animation frame so the UI does
  // not flicker through intermediate snapshots.
  const pendingTickerRef = useRef<Ticker | null>(null);
  const pendingBookRef = useRef<BookRow[] | null>(null);
  const tickerRafRef = useRef<number | null>(null);
  const bookRafRef = useRef<number | null>(null);

  const flushTicker = () => {
    tickerRafRef.current = null;
    const next = pendingTickerRef.current;
    if (next) {
      pendingTickerRef.current = null;
      setTicker((previous) => mergeTicker(previous, next));
    }
  };

  const flushBook = () => {
    bookRafRef.current = null;
    const next = pendingBookRef.current;
    if (next) {
      pendingBookRef.current = null;
      setBook(next);
    }
  };

  const scheduleTicker = (next: Ticker) => {
    pendingTickerRef.current = pendingTickerRef.current
      ? mergeTicker(pendingTickerRef.current, next)
      : next;
    if (tickerRafRef.current == null) {
      tickerRafRef.current = requestAnimationFrame(flushTicker);
    }
  };

  /** Local order-book maps — required so Bybit deltas merge instead of wiping a side. */
  const bidMapRef = useRef<Map<number, number>>(new Map());
  const askMapRef = useRef<Map<number, number>>(new Map());

  const scheduleBook = (next: BookRow[]) => {
    pendingBookRef.current = next;
    if (bookRafRef.current == null) {
      bookRafRef.current = requestAnimationFrame(flushBook);
    }
  };

  const publishBookFromMaps = () => {
    scheduleBook(mapsToBookRows(bidMapRef.current, askMapRef.current));
  };

  useEffect(() => {
    // The pair/timeframe this hook is fed can arrive later than the
    // component mount (e.g. the pair is still being fetched from
    // Supabase). That is NOT the same thing as a confirmed-unsupported
    // pair — it just means we don't know yet. Only mark "unsupported"
    // once we actually have both a base and quote asset and the
    // resulting symbol/interval combination is genuinely invalid.
    const hasPairInfo = !!baseAsset && !!quoteAsset;
    const symbol = makeBybitSymbol(baseAsset, quoteAsset);
    const interval = getInterval(timeframe);

    // Reset market state immediately when pair/timeframe changes.
    setTicker(null);
    setCandles([]);
    setBook([]);
    bidMapRef.current = new Map();
    askMapRef.current = new Map();
    setTrades([]);

    if (!hasPairInfo) {
      // Pair hasn't loaded yet — neutral loading state, never "unsupported".
      setStatus("connecting");
      return;
    }

    if (!symbol || !interval) {
      // We have real pair info and it genuinely can't be mapped to a
      // Bybit symbol/interval — this is a confirmed, not a guessed,
      // unsupported state.
      setStatus("unsupported");
      return;
    }

    // We have a valid symbol: re-arm to "connecting" so any stale status
    // from a previous pair/loading state doesn't linger on screen while
    // the new snapshot loads.
    setStatus("connecting");

    let cancelled = false;

    const abortController = new AbortController();

    const handleWsMessage = (message: BybitMarketMessage) => {
      if (cancelled) {
        return;
      }

      if (!message.topic) {
        return;
      }

      // -------------------------
      // Ticker
      // -------------------------
      if (message.topic === `tickers.${symbol}`) {
        const nextTicker = parseTicker(message.data);

        if (nextTicker) {
          scheduleTicker(nextTicker);
        }

        return;
      }

      // -------------------------
      // Kline / candle
      // -------------------------
      if (message.topic === `kline.${interval}.${symbol}`) {
        if (!Array.isArray(message.data)) {
          return;
        }

        for (const raw of message.data) {
          if (!raw || typeof raw !== "object") {
            continue;
          }

          const candle = parseCandle(raw as BybitKline);

          if (!candle) {
            continue;
          }

          setCandles((previous) =>
            upsertCandle(previous, candle),
          );
        }

        return;
      }

      // -------------------------
      // Order book
      // -------------------------
      if (message.topic === `orderbook.50.${symbol}`) {
        // Bybit v5: type "snapshot" = full book; "delta" = changed levels only.
        // Replacing the whole book on every delta is what made one side vanish
        // and caused aggressive visual rebuilds.
        const msgType = String(message.type || "").toLowerCase();
        const raw = (message.data && typeof message.data === "object"
          ? message.data
          : {}) as BybitOrderbook;
        // Only an explicit snapshot may clear maps. Unknown/delta always merge
        // so a bid-only delta cannot erase asks (and vice versa).
        const isSnapshot = msgType === "snapshot";
        const bidRows = parseBookRows(raw.b, "buy");
        const askRows = parseBookRows(raw.a, "sell");

        if (isSnapshot) {
          applyBookSide(bidMapRef.current, bidRows, true);
          applyBookSide(askMapRef.current, askRows, true);
        } else {
          // delta or missing type — merge; amount 0 deletes that price only
          applyBookSide(bidMapRef.current, bidRows, false);
          applyBookSide(askMapRef.current, askRows, false);
        }

        if (bidMapRef.current.size > 0 || askMapRef.current.size > 0) {
          publishBookFromMaps();
        }

        return;
      }

      // -------------------------
      // Public trades
      // -------------------------
      if (message.topic === `publicTrade.${symbol}`) {
        const nextTrades = parseTrades(
          message.data,
          symbol,
        );

        if (nextTrades.length === 0) {
          return;
        }

        setTrades((previous) => {
          let next = previous;

          for (const trade of nextTrades) {
            next = prependOrUpdateTrade(next, trade);
          }

          return next;
        });
      }
    };

    const websocket = new BybitWebSocket(
      handleWsMessage,
      (nextStatus) => {
        if (cancelled) {
          return;
        }

        setStatus(nextStatus);
      },
    );

    websocketRef.current = websocket;

    const loadInitialMarketData = async () => {
      try {
        const [
          tickerResult,
          klineResult,
          orderbookResult,
        ] = await Promise.all([
          fetchBybit<{
            category: string;
            list: BybitTicker[];
          }>(
            `/v5/market/tickers?category=spot&symbol=${encodeURIComponent(symbol)}`,
            abortController.signal,
          ),

          fetchBybit<{
            category: string;
            symbol: string;
            list: string[][];
          }>(
            `/v5/market/kline?category=spot&symbol=${encodeURIComponent(
              symbol,
            )}&interval=${encodeURIComponent(interval)}&limit=500`,
            abortController.signal,
          ),

          fetchBybit<{
            s: string;
            b: string[][];
            a: string[][];
          }>(
            `/v5/market/orderbook?category=spot&symbol=${encodeURIComponent(
              symbol,
            )}&limit=50`,
            abortController.signal,
          ),
        ]);

        if (cancelled) {
          return;
        }

        // Initial ticker.
        const initialTicker = parseTicker(
          tickerResult.list,
        );

        if (initialTicker) {
          setTicker(initialTicker);
        }

        // Initial candles.
        const initialCandles: Candle[] = [];

        for (const row of klineResult.list || []) {
          if (!Array.isArray(row) || row.length < 6) {
            continue;
          }

          const candle: Candle = {
            open_time: new Date(
              Number(row[0]),
            ).toISOString(),
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
            volume: Number(row[5]),
          };

          if (
            !Number.isFinite(candle.open) ||
            !Number.isFinite(candle.high) ||
            !Number.isFinite(candle.low) ||
            !Number.isFinite(candle.close) ||
            !Number.isFinite(candle.volume)
          ) {
            continue;
          }

          initialCandles.push(candle);
        }

        initialCandles.sort(
          (a, b) =>
            new Date(a.open_time).getTime() -
            new Date(b.open_time).getTime(),
        );

        setCandles(
          initialCandles.slice(-MAX_CANDLES),
        );

        // Initial order book.
        const initialBook = parseBook({
          s: orderbookResult.s,
          b: orderbookResult.b,
          a: orderbookResult.a,
        });

        bidMapRef.current = new Map();
        askMapRef.current = new Map();
        applyBookSide(
          bidMapRef.current,
          initialBook.filter((r) => r.side === "buy"),
          true,
        );
        applyBookSide(
          askMapRef.current,
          initialBook.filter((r) => r.side === "sell"),
          true,
        );
        setBook(mapsToBookRows(bidMapRef.current, askMapRef.current));

        if (!cancelled) {
          // Connect only after the REST snapshot has loaded.
          websocket.connect([
            `tickers.${symbol}`,
            `kline.${interval}.${symbol}`,
            `orderbook.50.${symbol}`,
            `publicTrade.${symbol}`,
          ]);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Bybit market-data load failed:",
          error,
        );

        setStatus("disconnected");

        // Still connect WebSocket. It may recover even if REST
        // temporarily fails.
        websocket.connect([
          `tickers.${symbol}`,
          `kline.${interval}.${symbol}`,
          `orderbook.50.${symbol}`,
          `publicTrade.${symbol}`,
        ]);
      }
    };

    void loadInitialMarketData();

    return () => {
      cancelled = true;

      if (tickerRafRef.current != null) {
        cancelAnimationFrame(tickerRafRef.current);
        tickerRafRef.current = null;
      }
      if (bookRafRef.current != null) {
        cancelAnimationFrame(bookRafRef.current);
        bookRafRef.current = null;
      }
      pendingTickerRef.current = null;
      pendingBookRef.current = null;

      abortController.abort();

      websocket.disconnect();

      if (websocketRef.current === websocket) {
        websocketRef.current = null;
      }
    };
  }, [baseAsset, quoteAsset, timeframe]);

  return {
    ticker,
    candles,
    book,
    trades,
    status,
  };
}
