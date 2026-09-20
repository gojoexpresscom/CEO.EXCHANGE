// src/trading/providers/KrakenProvider.ts
//
// Legacy venue adapter. CEO Exchange spot execution now uses Bybit
// (bybit-private). This class remains for interface completeness only —
// TradingPage does not route place/cancel/modify through Kraken.

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

export class KrakenProvider implements ExecutionProvider {
  readonly venue = "kraken" as const;

  isConfigured(): boolean {
    return false;
  }

  private notConfigured(operation: string): never {
    throw new ProviderNotConfiguredError(this.venue, operation);
  }

  async getTicker(_symbol: string): Promise<ProviderTicker | null> {
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

  async placeOrder(_params: PlaceOrderParams): Promise<PlaceOrderResult> {
    return this.notConfigured("placeOrder");
  }

  async cancelOrder(_params: CancelOrderParams): Promise<CancelOrderResult> {
    return this.notConfigured("cancelOrder");
  }

  async modifyOrder(_params: ModifyOrderParams): Promise<ModifyOrderResult> {
    return this.notConfigured("modifyOrder");
  }

  async reconcile(_params?: ReconcileParams): Promise<Record<string, unknown>> {
    return this.notConfigured("reconcile");
  }
}
