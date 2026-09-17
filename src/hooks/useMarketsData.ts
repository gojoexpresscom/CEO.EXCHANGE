import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBybitTickers } from "../trading/useBybitTickers";
import type { AssetMeta, TradingPairRow } from "../lib/types";

const PAGE_SIZE = 1000;

export type MarketRow = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  base_name?: string;
  listed_at?: string | null;
  last_price: number | null;
  change_24h: number | null;
  volume_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  provider_symbol: string | null;
  hasTicker: boolean;
  isFavorite: boolean;
};

type TickerRow = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Same rule as Home / useBybitMarketData: BTC + USDT → BTCUSDT */
export function toProviderSymbol(base: string, quote: string): string | null {
  const b = (base || "").trim().toUpperCase();
  const q = (quote || "").trim().toUpperCase();
  if (!b || !q) return null;
  const s = `${b}${q}`;
  return /^[A-Z0-9]+$/.test(s) ? s : null;
}

function compactSymbol(symbol: string | null | undefined): string {
  return (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pickPrice(t: TickerRow): number | null {
  return num(t.last_price) ?? num(t.lastPrice) ?? num(t.price) ?? null;
}
function pickChange(t: TickerRow): number | null {
  return (
    num(t.change_24h) ??
    num(t.price_change_percent_24h) ??
    num(t.priceChangePercent24h) ??
    null
  );
}
function pickVolume(t: TickerRow): number | null {
  return (
    num(t.volume_24h) ??
    num(t.quote_volume_24h) ??
    num(t.turnover_24h) ??
    num(t.volume24h) ??
    null
  );
}
function pickHigh(t: TickerRow): number | null {
  return num(t.high_24h) ?? num(t.highPrice24h) ?? num(t.high) ?? null;
}
function pickLow(t: TickerRow): number | null {
  return num(t.low_24h) ?? num(t.lowPrice24h) ?? num(t.low) ?? null;
}

async function fetchAllPages<T>(
  loadPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows, error: null };
}

/**
 * Canonical pairs from trading_pairs.
 * Prices: market_tickers (backend sync) preferred, else public Bybit tickers
 * keyed by base+quote (never by "ADA/USDT" form).
 */
export function useMarketsData(userId: string | null) {
  const [pairs, setPairs] = useState<TradingPairRow[]>([]);
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [dbTickers, setDbTickers] = useState<Map<string, TickerRow>>(
    () => new Map()
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bybitSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const s of ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]) {
      set.add(s);
    }
    for (const p of pairs) {
      const ps = toProviderSymbol(p.base_asset, p.quote_asset);
      if (ps) set.add(ps);
    }
    return Array.from(set);
  }, [pairs]);

  const { tickers: bybitTickers, status: bybitStatus } =
    useBybitTickers(bybitSymbols);

  const loadDbTickers = useCallback(async () => {
    const { rows, error: e } = await fetchAllPages<TickerRow>(
      async (from, to) => {
        const res = await supabase
          .from("market_tickers")
          .select("*")
          .range(from, to);
        return { data: res.data as TickerRow[] | null, error: res.error };
      }
    );
    if (e) return { map: new Map<string, TickerRow>(), error: e };
    const map = new Map<string, TickerRow>();
    for (const t of rows) {
      const keys = [
        str(t.symbol),
        str(t.provider_symbol),
        str(t.bybit_symbol),
      ].filter(Boolean) as string[];
      for (const k of keys) {
        map.set(k.toUpperCase(), t);
        map.set(compactSymbol(k), t);
      }
    }
    return { map, error: null as string | null };
  }, []);

  const loadPairs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const pairsResult = await fetchAllPages<TradingPairRow>(
      async (from, to) => {
        const res = await supabase
          .from("trading_pairs")
          .select("id,symbol,base_asset,quote_asset,is_active,listed_at")
          .eq("is_active", true)
          .order("symbol", { ascending: true })
          .range(from, to);
        return {
          data: res.data as TradingPairRow[] | null,
          error: res.error,
        };
      }
    );

    if (pairsResult.error) {
      setError(pairsResult.error);
      setLoading(false);
      return;
    }
    setPairs(pairsResult.rows);

    const assetsResult = await fetchAllPages<AssetMeta>(async (from, to) => {
      const res = await supabase
        .from("assets")
        .select("symbol,name,is_active")
        .order("symbol", { ascending: true })
        .range(from, to);
      return { data: res.data as AssetMeta[] | null, error: res.error };
    });
    if (!assetsResult.error) setAssets(assetsResult.rows);

    const tickerPack = await loadDbTickers();
    setDbTickers(tickerPack.map);
    // Don't block UI if market_tickers fails — Bybit public feed still works
    setLoading(false);
  }, [loadDbTickers]);

  const loadFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites(new Set());
      return;
    }
    const { data } = await supabase
      .from("market_favorites")
      .select("symbol")
      .eq("user_id", userId);
    setFavorites(
      new Set((data ?? []).map((r: { symbol: string }) => r.symbol))
    );
  }, [userId]);

  useEffect(() => {
    void loadPairs();
  }, [loadPairs]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    const channel = supabase
      .channel("markets-tickers-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_tickers" },
        () => {
          void loadDbTickers().then((pack) => {
            if (!pack.error) setDbTickers(pack.map);
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadDbTickers]);

  const nameByBase = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assets) {
      if (a.symbol) m.set(a.symbol.toUpperCase(), a.name || a.symbol);
    }
    return m;
  }, [assets]);

  const markets: MarketRow[] = useMemo(() => {
    return pairs.map((p) => {
      const base = (p.base_asset || "").trim().toUpperCase();
      const quote = (p.quote_asset || "").trim().toUpperCase();
      const pairSym = (p.symbol || "").toUpperCase();
      const provider = toProviderSymbol(base, quote);

      // 1) Backend market_tickers
      let db: TickerRow | undefined;
      if (provider) {
        db =
          dbTickers.get(provider) ||
          dbTickers.get(compactSymbol(provider));
      }
      if (!db) {
        db =
          dbTickers.get(pairSym) ||
          dbTickers.get(compactSymbol(pairSym));
      }

      // 2) Live Bybit public ticker (same as Home)
      const bybit = provider ? bybitTickers.get(provider) : undefined;

      const last_price =
        (db ? pickPrice(db) : null) ?? bybit?.last_price ?? null;
      const change_24h =
        (db ? pickChange(db) : null) ?? bybit?.change_24h ?? null;
      const volume_24h =
        (db ? pickVolume(db) : null) ?? bybit?.volume_24h ?? null;
      const high_24h = db ? pickHigh(db) : null;
      const low_24h = db ? pickLow(db) : null;

      // Treat literal 0 as missing only when both sources empty — keep real 0 if rare
      const hasTicker = last_price != null && Number.isFinite(last_price);

      return {
        symbol: p.symbol,
        base_asset: base || p.base_asset,
        quote_asset: quote || p.quote_asset,
        base_name: nameByBase.get(base) || undefined,
        listed_at: p.listed_at ?? null,
        last_price: hasTicker ? last_price : null,
        change_24h: hasTicker ? change_24h : null,
        volume_24h: hasTicker ? volume_24h : null,
        high_24h,
        low_24h,
        provider_symbol: provider,
        hasTicker,
        isFavorite: favorites.has(p.symbol) || favorites.has(pairSym),
      };
    });
  }, [pairs, dbTickers, bybitTickers, nameByBase, favorites]);

  const toggleFavorite = useCallback(
    async (symbol: string) => {
      if (!userId) return;
      const isFav = favorites.has(symbol);
      if (isFav) {
        await supabase
          .from("market_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("symbol", symbol);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(symbol);
          return next;
        });
      } else {
        await supabase
          .from("market_favorites")
          .insert({ user_id: userId, symbol });
        setFavorites((prev) => new Set(prev).add(symbol));
      }
    },
    [userId, favorites]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadPairs();
    void loadFavorites();
    setLoading(false);
  }, [loadPairs, loadFavorites]);

  return {
    markets,
    loading,
    error,
    bybitStatus,
    favorites,
    toggleFavorite,
    refresh,
  };
        }
                             
