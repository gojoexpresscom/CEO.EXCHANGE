import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBybitTickers } from "../trading/useBybitTickers";
import type { AssetMeta, TradingPairRow } from "../lib/types";

const PAGE_SIZE = 100;

/**
 * Full active market universe — no silent .limit(200) cutoff.
 * Paginates trading_pairs until all active rows are loaded.
 */
export function useMarketsData(userId: string | null) {
  const [pairs, setPairs] = useState<TradingPairRow[]>([]);
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const all: TradingPairRow[] = [];
    let from = 0;
    // Paginate until a page returns fewer than PAGE_SIZE rows
    // so every active pair is included.
    for (;;) {
      const { data, error: e } = await supabase
        .from("trading_pairs")
        .select("id,symbol,base_asset,quote_asset,is_active,listed_at")
        .eq("is_active", true)
        .order("symbol")
        .range(from, from + PAGE_SIZE - 1);

      if (e) {
        setError(e.message);
        break;
      }
      const batch = (data as TradingPairRow[]) ?? [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
      // Safety ceiling for runaway loops
      if (from > 5000) break;
    }
    setPairs(all);

    // Assets metadata (also paginated lightly)
    const assetAll: AssetMeta[] = [];
    let aFrom = 0;
    for (;;) {
      const { data: aData, error: aErr } = await supabase
        .from("assets")
        .select("symbol,name,is_active")
        .eq("is_active", true)
        .order("symbol")
        .range(aFrom, aFrom + PAGE_SIZE - 1);
      if (aErr) break;
      const batch = (aData as AssetMeta[]) ?? [];
      assetAll.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      aFrom += PAGE_SIZE;
      if (aFrom > 5000) break;
    }
    setAssets(assetAll);
    setLoading(false);
  }, []);

  const loadFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites(new Set());
      return;
    }
    const { data } = await supabase
      .from("market_favorites")
      .select("symbol")
      .eq("user_id", userId);
    setFavorites(new Set((data ?? []).map((r: { symbol: string }) => r.symbol)));
  }, [userId]);

  useEffect(() => {
    void loadPairs();
  }, [loadPairs]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const symbols = useMemo(
    () => pairs.map((p) => p.symbol).filter(Boolean),
    [pairs]
  );

  const { tickers, status: tickerStatus } = useBybitTickers(symbols);

  const nameByBase = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assets) {
      if (a.symbol) m.set(a.symbol.toUpperCase(), a.name || a.symbol);
    }
    return m;
  }, [assets]);

  const markets = useMemo(() => {
    return pairs.map((p) => {
      const t = tickers.get(p.symbol);
      return {
        symbol: p.symbol,
        base_asset: p.base_asset,
        quote_asset: p.quote_asset,
        base_name: nameByBase.get((p.base_asset || "").toUpperCase()) || undefined,
        listed_at: p.listed_at ?? null,
        last_price: t?.last_price ?? null,
        change_24h: t?.change_24h ?? null,
        volume_24h: t?.volume_24h ?? null,
        isFavorite: favorites.has(p.symbol),
      };
    });
  }, [pairs, tickers, nameByBase, favorites]);

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

  return {
    markets,
    loading,
    error,
    tickerStatus,
    favorites,
    toggleFavorite,
    refresh: () => {
      void loadPairs();
      void loadFavorites();
    },
  };
}
