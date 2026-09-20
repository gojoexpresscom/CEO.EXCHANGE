// src/trading/providers/EternaProvider.ts
//
// Placeholder for a possible future Eterna execution provider.
// Intentionally UNCONFIGURED — no credentials, no network, no fake data.

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
