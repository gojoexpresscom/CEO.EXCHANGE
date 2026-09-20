// src/trading/providers/BybitProvider.ts
//
// Live spot execution via the bybit-private Supabase Edge Function.
// All Bybit signing and private API calls stay server-side.
// This file never contains BYBIT_API_KEY / BYBIT_API_SECRET.
//
// Public market data (ticker / candles / book) continues to use
// useBybitMarketData / BybitWebSocket — not this provider.

import { supabase } from "../../lib/supabase";
import type {
  CancelOrderParams,
  CancelOrderResult,
  ExecutionProvider,
  ModifyOrderParams,
  ModifyOrderResult,
  PlaceOrderParams,
  PlaceOrderResult,
  ProviderCandle,
  ProviderOrderBookRow,
  ProviderTicker,
  ReconcileParams,
} from "./types";
import { ProviderNotConfiguredError } from "./types";

export class BybitProvider implements ExecutionProvider {
  readonly venue = "bybit" as const;

  /**
   * Execution is live through bybit-private (place / cancel / modify).
   * Market-data methods remain on the public WS path, not this provider.
   */
  isConfigured(): boolean {
    return true;
  }

  private notConfigured(operation: string): never {
    throw new ProviderNotConfiguredError(this.venue, operation);
  }

  async getTicker(_symbol: string): Promise<ProviderTicker | null> {
    // Public path: useBybitMarketData — do not duplicate here.
    return this.notConfigured("getTicker");
  }

  async getCandles(
    _symbol: string,
    _timeframe: string,
  ): Promise<ProviderCandle[]> {
    return this.notConfigured("getCandles");
  }

  async getOrderBook(_symbol: string): Promise<ProviderOrderBookRow[]> {
    return this.notConfigured("getOrderBook");
  }

  /**
   * Place a spot order through bybit-private.
   * Uses the caller's Supabase session JWT automatically (no API keys here).
   * Does not invent success — returns server body including error fields.
   */
  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    const orderType = params.order_type ?? "limit";
    const body: Record<string, unknown> = {
      action: "place_order",
      trading_pair: params.trading_pair,
      side: params.side,
      order_type: orderType,
      amount: params.amount,
    };
    if (orderType === "limit" && params.price != null) {
      body.price = params.price;
    }

    const { data, error } = await supabase.functions.invoke("bybit-private", {
      body,
    });

    if (error) {
      return {
        error: error.message || "place_order failed",
        code: "INVOKE_ERROR",
      };
    }

    const result = (data as PlaceOrderResult) || {};
    return result;
  }

  /**
   * Cancel an open order through bybit-private.
   */
  async cancelOrder(params: CancelOrderParams): Promise<CancelOrderResult> {
    const { data, error } = await supabase.functions.invoke("bybit-private", {
      body: {
        action: "cancel_order",
        order_id: params.order_id,
      },
    });

    if (error) {
      return {
        error: error.message || "cancel_order failed",
        code: "INVOKE_ERROR",
      };
    }

    return (data as CancelOrderResult) || {};
  }

  /**
   * Amend price/size of an open limit order through bybit-private
   * (Bybit POST /v5/order/amend + DB finalize on the server).
   * Does not update UI optimistically — caller waits for this result.
   */
  async modifyOrder(params: ModifyOrderParams): Promise<ModifyOrderResult> {
    const body: Record<string, unknown> = {
      action: "modify_order",
      order_id: params.order_id,
      price: params.price,
    };
    if (params.amount !== undefined) {
      body.amount = params.amount;
    }

    const { data, error } = await supabase.functions.invoke("bybit-private", {
      body,
    });

    if (error) {
      return {
        order_id: params.order_id,
        status: "error",
        price: params.price,
        amount: params.amount ?? 0,
        error: error.message || "modify_order failed",
        code: "INVOKE_ERROR",
      };
    }

    const result = (data as ModifyOrderResult) || ({} as ModifyOrderResult);
    if (result.error) {
      return {
        order_id: params.order_id,
        status: result.status || "error",
        price: params.price,
        amount: params.amount ?? 0,
        error: String(result.error),
        code: result.code,
      };
    }
    if (!result.order_id) {
      return {
        order_id: params.order_id,
        status: "unknown",
        price: params.price,
        amount: params.amount ?? 0,
        error: "Server did not return an updated order",
        code: "INVALID_RESPONSE",
      };
    }
    return result;
  }

  async reconcile(_params?: ReconcileParams): Promise<Record<string, unknown>> {
    // Optional; not required for place/cancel/modify circuit.
    return this.notConfigured("reconcile");
  }
}
