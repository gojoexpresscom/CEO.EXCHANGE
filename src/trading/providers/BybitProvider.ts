// src/trading/providers/BybitProvider.ts
//
// Placeholder for the future Bybit execution provider.
//
// PHASE 1: this provider is intentionally UNCONFIGURED.
//   - No Bybit API credentials or secrets.
//   - No production or testnet requests.
//   - No WebSocket connections.
//   - No market-data calls.
//   - No order placement or cancellation.
//   - No fake/simulated fallback data of any kind.
//
// Every operation throws a clear "not connected yet" error instead of
// returning anything that could be mistaken for real market data or a real
// fill. Real Bybit connectivity is out of scope until a later phase.

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
import { ProviderNotConfiguredError } from "./types";

export class BybitProvider implements ExecutionProvider {
  readonly venue = "bybit" as const;

  isConfigured(): boolean {
    return false;
  }

  private notConfigured(operation: string): never {
    throw new ProviderNotConfiguredError(this.venue, operation);
  }

  async getTicker(_symbol: string): Promise<ProviderTicker | null> {
    return this.notConfigured("getTicker");
  }

  async getCandles(_symbol: string, _timeframe: string): Promise<ProviderCandle[]> {
    return this.notConfigured("getCandles");
  }

  async getOrderBook(_symbol: string): Promise<ProviderOrderBookRow[]> {
    return this.notConfigured("getOrderBook");
  }

  async placeOrder(_params: PlaceOrderParams): Promise<PlaceOrderResult> {
    return this.notConfigured("placeOrder");
  }

  async cancelOrder(_params: CancelOrderParams): Promise<Record<string, unknown>> {
    return this.notConfigured("cancelOrder");
  }

  async reconcile(_params?: ReconcileParams): Promise<Record<string, unknown>> {
    return this.notConfigured("reconcile");
  }
}
