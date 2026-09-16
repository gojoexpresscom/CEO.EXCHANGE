// src/trading/providers/EternaProvider.ts
//
// Placeholder for a possible future Eterna execution provider.
//
// This is only a future placeholder — it is intentionally UNCONFIGURED:
//   - No API credentials.
//   - No network calls.
//   - No fake data.
//   - No simulated orders or fills.
//
// Every operation throws a clear "not connected yet" error.

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

export class EternaProvider implements ExecutionProvider {
  readonly venue = "eterna" as const;

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
