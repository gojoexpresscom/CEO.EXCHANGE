// src/trading/providers/KrakenProvider.ts
//
// Thin adapter around the EXISTING Kraken integration: the kraken-spot
// Supabase Edge Function, the market_tickers / market_candles tables, and
// the get_order_book RPC. This does NOT reimplement Kraken connectivity —
// it gives TradingPage a stable ExecutionProvider-shaped entry point into
// what is already live, so the app can depend on the abstraction instead of
// hardcoding Kraken calls everywhere.

import { supabase } from "../../lib/supabase";
import type {
  CancelOrderParams,
  ExecutionProvider,
  PlaceOrderParams,
  PlaceOrderResult,
  ProviderCandle,
  ProviderOrderBookRow,
  ProviderTicker,
  ReconcileParams,
} from "./types";

export class KrakenProvider implements ExecutionProvider {
  readonly venue = "kraken" as const;

  isConfigured(): boolean {
    // Kraken is the existing, already-wired legacy provider — always
    // considered configured in this phase.
    return true;
  }

  async getTicker(symbol: string): Promise<ProviderTicker | null> {
    const { data, error } = await supabase
      .from("market_tickers")
      .select("symbol,last_price,bid_price,ask_price,high_24h,low_24h,volume_24h,change_24h")
      .eq("symbol", symbol)
      .maybeSingle();
    if (error) {
      console.error("KrakenProvider.getTicker failed:", error.message);
      return null;
    }
    return (data as ProviderTicker | null) || null;
  }

  /**
   * Preserves the exact existing TradingPage candle-loading behavior:
   *   1. Invoke kraken-spot?action=ohlc to sync candles from Kraken. If this
   *      fails, log it but do NOT treat it as fatal — market_candles may
   *      still have usable data from a previous sync.
   *   2. Read market_candles. If that read fails, return an empty array
   *      rather than throwing, so the rest of the page can still render.
   */
  async getCandles(symbol: string, timeframe: string): Promise<ProviderCandle[]> {
    const { error: ohlcErr } = await supabase.functions.invoke(
      `kraken-spot?action=ohlc&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
      { method: "GET" }
    );
    if (ohlcErr) {
      console.error("Kraken OHLC sync failed:", ohlcErr.message);
    }

    const { data, error } = await supabase
      .from("market_candles")
      .select("open_time,open,high,low,close,volume")
      .eq("trading_pair", symbol)
      .eq("timeframe", timeframe)
      .order("open_time", { ascending: true })
      .limit(500);

    if (error) {
      console.error("Reading market_candles failed:", error.message);
      return [];
    }
    return (data as ProviderCandle[]) || [];
  }

  async getOrderBook(symbol: string): Promise<ProviderOrderBookRow[]> {
    const { data, error } = await supabase.rpc("get_order_book", { p_trading_pair: symbol });
    if (error) {
      console.error("KrakenProvider.getOrderBook failed:", error.message);
      return [];
    }
    return (data as ProviderOrderBookRow[]) || [];
  }

  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: {
        action: "place_order",
        trading_pair: params.trading_pair,
        side: params.side,
        price: params.price,
        amount: params.amount,
      },
    });
    if (error) throw error;
    return (data as PlaceOrderResult) || {};
  }

  async cancelOrder(params: CancelOrderParams): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: { action: "cancel_order", order_id: params.order_id },
    });
    if (error) throw error;
    return (data as Record<string, unknown>) || {};
  }

  async reconcile(params?: ReconcileParams): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: { action: "reconcile", ...(params || {}) },
    });
    if (error) throw error;
    return (data as Record<string, unknown>) || {};
  }
}
