import { useEffect, useMemo, useRef, useState } from "react";
import { BybitWebSocket, type BybitMarketMessage } from "./BybitWebSocket";

export type BybitTickerSnapshot = {
  symbol: string;
  last_price: number | null;
  change_24h: number | null; // percent, e.g. 1.23 for +1.23%
  volume_24h: number | null;
  updated_at: string | null;
};

export type BybitTickersStatus = "connecting" | "connected" | "disconnected";

const BYBIT_REST = "https://api.bybit.com";

// Real-exchange dashboards don't push every tick straight to the DOM — they
// coalesce. 400ms keeps the feed feeling live while bounding how often a
// page tracking ~20 symbols has to re-render.
const FLUSH_INTERVAL_MS = 400;

type BybitTickerRow = {
  symbol?: string;
  lastPrice?: string;
  price24hPcnt?: string;
  volume24h?: string;
};

type BybitRestResponse<T> = {
  retCode?: number;
  retMsg?: string;
  result?: T;
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

function parseTickerRow(raw: unknown): BybitTickerSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as BybitTickerRow;

  if (!row.symbol) {
    return null;
  }

  const pct = toNumber(row.price24hPcnt);

  return {
    symbol: row.symbol,
    last_price: toNumber(row.lastPrice),
    change_24h: pct == null ? null : pct * 100,
    volume_24h: toNumber(row.volume24h),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Multi-symbol Bybit PUBLIC ticker feed (no API keys, no execution).
 *
 * This is deliberately a separate hook from useBybitMarketData, which is
 * used by the Trading page for one pair's full ticker + candles + order
 * book + trade tape. The Home market list needs live last-price/24h-change/
 * volume for every listed pair at once. Mounting useBybitMarketData once per
 * row would open one WebSocket connection per symbol; instead this hook
 * reuses the SAME BybitWebSocket class with a single shared connection
 * subscribed to `tickers.<SYMBOL>` for every requested symbol — no second,
 * conflicting WebSocket architecture.
 *
 * Incoming ticks are coalesced in a ref and flushed to React state at most
 * once per FLUSH_INTERVAL_MS, so a live 20-symbol list doesn't trigger a
 * re-render on every single inbound WebSocket message.
 */
export function useBybitTickers(symbols: string[]): {
  tickers: Map<string, BybitTickerSnapshot>;
  status: BybitTickersStatus;
  /** Symbols Bybit's public REST snapshot actually returned data for. */
  supportedSymbols: Set<string>;
} {
  const [tickers, setTickers] = useState<Map<string, BybitTickerSnapshot>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<BybitTickersStatus>("connecting");
  const [supportedSymbols, setSupportedSymbols] = useState<Set<string>>(
    () => new Set(),
  );

  // Stable key so the effect only re-runs when the actual symbol SET
  // changes, not on every re-render that happens to pass a new array
  // instance with the same contents.
  const symbolsKey = useMemo(
    () => Array.from(new Set(symbols)).sort().join(","),
    [symbols],
  );

  const pendingRef = useRef<Map<string, BybitTickerSnapshot>>(new Map());

  useEffect(() => {
    const list = symbolsKey ? symbolsKey.split(",").filter(Boolean) : [];

    pendingRef.current = new Map();
    setTickers(new Map());
    setSupportedSymbols(new Set());

    if (!list.length) {
      setStatus("disconnected");
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const handleMessage = (message: BybitMarketMessage) => {
      if (cancelled || !message.topic || !message.topic.startsWith("tickers.")) {
        return;
      }

      const raw = Array.isArray(message.data) ? message.data[0] : message.data;
      const parsed = parseTickerRow(raw);

      if (!parsed) {
        return;
      }

      // Buffer only — React state is updated by the flush timer below.
      pendingRef.current.set(parsed.symbol, parsed);
    };

    const websocket = new BybitWebSocket(handleMessage, (nextStatus) => {
      if (!cancelled) {
        setStatus(nextStatus);
      }
    });

    const flushTimer = window.setInterval(() => {
      if (cancelled || pendingRef.current.size === 0) {
        return;
      }

      const updates = pendingRef.current;
      pendingRef.current = new Map();

      setTickers((previous) => {
        // Only symbols with a real update get a new object reference —
        // rows for unchanged symbols keep their old reference so a
        // memoized row component can skip re-rendering.
        const next = new Map(previous);

        updates.forEach((value, key) => {
          const existing = next.get(key);
          next.set(key, {
            symbol: key,
            last_price: value.last_price ?? existing?.last_price ?? null,
            change_24h: value.change_24h ?? existing?.change_24h ?? null,
            volume_24h: value.volume_24h ?? existing?.volume_24h ?? null,
            updated_at: value.updated_at,
          });
        });

        return next;
      });
    }, FLUSH_INTERVAL_MS);

    const loadInitialSnapshot = async () => {
      try {
        const response = await fetch(
          `${BYBIT_REST}/v5/market/tickers?category=spot`,
          {
            method: "GET",
            signal: abortController.signal,
            headers: { Accept: "application/json" },
          },
        );

        if (!response.ok) {
          throw new Error(`Bybit HTTP ${response.status}`);
        }

        const json =
          (await response.json()) as BybitRestResponse<{ list?: unknown[] }>;

        if (json.retCode !== 0) {
          throw new Error(json.retMsg || "Bybit request failed.");
        }

        const rows = json.result?.list ?? [];
        const wanted = new Set(list);
        const supported = new Set<string>();
        const initial = new Map<string, BybitTickerSnapshot>();

        for (const row of rows) {
          const parsed = parseTickerRow(row);

          if (!parsed) {
            continue;
          }

          // Track every symbol Bybit actually serves, independent of
          // whether we asked for it — used to tell "not supported by
          // Bybit" apart from "supported but still loading".
          supported.add(parsed.symbol);

          if (wanted.has(parsed.symbol)) {
            initial.set(parsed.symbol, parsed);
          }
        }

        if (cancelled) {
          return;
        }

        setTickers(initial);
        setSupportedSymbols(supported);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Bybit ticker snapshot load failed:", error);
        // Fall through to connecting the WebSocket anyway — same recovery
        // pattern as useBybitMarketData: a failed REST snapshot doesn't
        // block live updates from arriving once the socket connects.
      } finally {
        if (!cancelled) {
          websocket.connect(list.map((symbol) => `tickers.${symbol}`));
        }
      }
    };

    void loadInitialSnapshot();

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearInterval(flushTimer);
      websocket.disconnect();
    };
  }, [symbolsKey]);

  return { tickers, status, supportedSymbols };
}
