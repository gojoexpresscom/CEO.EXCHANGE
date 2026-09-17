// src/trading/providers/BybitProvider.ts
//
// PHASE 2: server-side Bybit private API groundwork (admin-only account
// checks). Order execution is still out of scope — see the audit report.
//
//   - getTicker / getCandles / getOrderBook: still intentionally NOT
//     implemented here. Public Bybit market data already has its own live
//     path (BybitWebSocket.ts / useBybitMarketData.ts / useBybitTickers.ts)
//     and this provider must not compete with or duplicate that.
//   - placeOrder / cancelOrder / reconcile: still intentionally NOT
//     implemented. Safe execution requires a DB migration (widening the
//     orders.execution_venue CHECK constraint) and new Bybit-specific
//     settlement RPCs mirroring the Kraken ones. See the audit report —
//     that migration has NOT been applied.
//   - isConfigured(): reverted to a hardcoded `false`. It previously called
//     the "diag" endpoint from the frontend to check secret-configuration
//     state; "diag" is now admin-only (see bybit-private/index.ts), and
//     even the true/false "is a secret configured" signal isn't something
//     an ordinary user's browser session should be triggering a server
//     round-trip to check. There's no existing generic "is this provider
//     configured" health mechanism elsewhere in the codebase to reuse, so
//     this stays an intentionally-unconfigured execution state — as it was
//     in Phase 1 — until private execution is actually wired up.
//   - No frontend methods call the admin-only bybit-private diagnostic
//     endpoints ("api_key_info" / "wallet_balance" / "diag"). Those remain
//     server-side/admin-only tools for this review phase and are not
//     wired up to any client-side code path.
//
// No Bybit API key or secret is ever present in this file or sent to this
// file — they stay server-side inside the bybit-private Edge Function.

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
