import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
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
  provider_symbol: string | null;
  hasTicker: boolean;
  isFavorite: boolean;
};

type TickerRow = Record<string, unknown>;
type InstrumentRow = {
  symbol?: string | null;
  trading_pair_symbol?: string | null;
  pair_symbol?: string | null;
  provider_symbol?: string | null;
  bybit_symbol?: string | null;
};

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

/** Compact Bybit-style symbol: BTC + USDT → BTCUSDT */
export function toProviderSymbol(base: string, quote: string): string | null {
  const b = (base || "").trim().toUpperCase();
  const q = (quote || "").trim().toUpperCase();
  if (!b || !q) return null;
  const s = `${b}${q}`;
  return /^[A-Z0-9]+$/.test(s) ? s : null;
}

/** Normalize any pair symbol form to compact uppercase without separators */
function compactSymbol(symbol: string | null | undefined): string {
  return (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pickTickerPrice(t: TickerRow): number | null {
  return (
    num(t.last_price) ??
    num(t.lastPrice) ??
    num(t.price) ??
    num(t.last) ??
    null
  );
}

function pickTickerChange(t: TickerRow): number | null {
  return (
    num(t.change_24h) ??
    num(t.price_change_percent_24h) ??
    num(t.priceChangePercent24h) ??
    num(t.change_pct_24h) ??
    num(t.pct_change_24h) ??
    null
  );
}

function pickTickerVolume(t: TickerRow): number | null {
  return (
    num(t.volume_24h) ??
    num(t.quote_volume_24h) ??
    num(t.turnover_24h) ??
    num(t.volume24h) ??
    num(t.turnover24h) ??
    null
  );
}

function tickerKey(t: TickerRow): string {
  return compactSymbol(
    str(t.symbol) ||
      str(t.provider_symbol) ||
      str(t.bybit_symbol) ||
      str(t.pair_symbol) ||
      ""
  );
}

async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
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
 * Markets data: trading_pairs (canonical) + market_tickers (live prices).
 * Maps via bybit_spot_instruments.provider_symbol when available,
 * otherwise base_asset + quote_asset → BTCUSDT form.
 */
export function useMarketsData(userId: string | null) {
  const [pairs, setPairs] = useState<TradingPairRow[]>([]);
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [tickersByKey, setTickersByKey] = useState<Map<string, TickerRow>>(
    () => new Map()
  );
  const [providerByPair, setProviderByPair] = useState<Map<string, string>>(
    () => new Map()
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickers = useCallback(async () => {
    // Prefer * so we adapt to actual columns without guessing wrong names
    const { rows, error: e } = await fetchAllPages<TickerRow>(
      async (from, to) => {
        const res = await supabase.from("market_tickers").select("*").range(from, to);
        return { data: res.data as TickerRow[] | null, error: res.error };
      }
    );
    if (e) {
      return { map: new Map<string, TickerRow>(), error: e };
    }
    const map = new Map<string, TickerRow>();
    for (const t of rows) {
      const k = tickerKey(t);
      if (k) map.set(k, t);
      // also index by raw symbol variants
      const raw = str(t.symbol);
      if (raw) map.set(raw.toUpperCase(), t);
    }
    return { map, error: null as string | null };
  }, []);

  const loadInstruments = useCallback(async () => {
    const map = new Map<string, string>();
    const { rows, error: e } = await fetchAllPages<InstrumentRow>(
      async (from, to) => {
        const res = await supabase
          .from("bybit_spot_instruments")
          .select("*")
          .range(from, to);
        return { data: res.data as InstrumentRow[] | null, error: res.error };
      }
    );
    if (e) {
      // Table may not be exposed to anon/authenticated — fall back to base+quote
      return map;
    }
    for (const row of rows) {
      const provider =
        str(row.provider_symbol) ||
        str(row.bybit_symbol) ||
        str(row.symbol);
      if (!provider) continue;
      const pairKeys = [
        str(row.trading_pair_symbol),
        str(row.pair_symbol),
        str(row.symbol),
      ].filter(Boolean) as string[];
      for (const pk of pairKeys) {
        map.set(pk.toUpperCase(), provider.toUpperCase());
        map.set(compactSymbol(pk), provider.toUpperCase());
      }
    }
    return map;
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

    const [tickerPack, instruments] = await Promise.all([
      loadTickers(),
      loadInstruments(),
    ]);
    if (tickerPack.error) {
      // Pairs still usable; prices may be empty
      setError(
        `Unable to load market_tickers: ${tickerPack.error}`
      );
    }
    setTickersByKey(tickerPack.map);
    setProviderByPair(instruments);
    setLoading(false);
  }, [loadTickers, loadInstruments]);

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

  // Realtime refresh of market_tickers when backend updates
  useEffect(() => {
    const channel = supabase
      .channel("markets-tickers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_tickers" },
        () => {
          void loadTickers().then((pack) => {
            if (!pack.error) setTickersByKey(pack.map);
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTickers]);

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

      const fromInstrument =
        providerByPair.get(pairSym) ||
        providerByPair.get(compactSymbol(pairSym)) ||
        providerByPair.get(`${base}/${quote}`) ||
        providerByPair.get(`${base}${quote}`);

      const provider =
        fromInstrument || toProviderSymbol(base, quote);

      let ticker: TickerRow | undefined;
      if (provider) {
        ticker =
          tickersByKey.get(provider) ||
          tickersByKey.get(compactSymbol(provider));
      }
      if (!ticker) {
        ticker =
          tickersByKey.get(pairSym) ||
          tickersByKey.get(compactSymbol(pairSym)) ||
          tickersByKey.get(`${base}${quote}`);
      }

      const last_price = ticker ? pickTickerPrice(ticker) : null;
      const change_24h = ticker ? pickTickerChange(ticker) : null;
      const volume_24h = ticker ? pickTickerVolume(ticker) : null;

      return {
        symbol: p.symbol,
        base_asset: base || p.base_asset,
        quote_asset: quote || p.quote_asset,
        base_name: nameByBase.get(base) || undefined,
        listed_at: p.listed_at ?? null,
        last_price,
        change_24h,
        volume_24h,
        provider_symbol: provider,
        hasTicker: last_price != null,
        isFavorite: favorites.has(p.symbol) || favorites.has(pairSym),
      };
    });
  }, [pairs, tickersByKey, providerByPair, nameByBase, favorites]);

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
    const [tickerPack, instruments] = await Promise.all([
      loadTickers(),
      loadInstruments(),
    ]);
    // also refresh pair list in case of new listings
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
    if (!pairsResult.error) setPairs(pairsResult.rows);
    if (tickerPack.error) {
      setError(`Unable to load market_tickers: ${tickerPack.error}`);
    } else {
      setError(null);
      setTickersByKey(tickerPack.map);
    }
    setProviderByPair(instruments);
    void loadFavorites();
    setLoading(false);
  }, [loadTickers, loadInstruments, loadFavorites]);

  return {
    markets,
    loading,
    error,
    favorites,
    toggleFavorite,
    refresh,
  };
                }
    
