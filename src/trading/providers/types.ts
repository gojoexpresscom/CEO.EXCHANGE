// src/trading/providers/types.ts
//
// Shared types for the execution-provider abstraction. Phase 1 only defines
// the interface and the not-configured error shape — it does not implement
// any new exchange connectivity. Kraken is the existing/legacy provider;
// Bybit and Eterna are unconfigured placeholders for future phases.

export type ProviderVenue = "kraken" | "bybit" | "eterna";

export interface ProviderTicker {
  symbol: string;
  last_price: number | null;
  bid_price: number | null;
  ask_price: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume_24h: number | null;
  change_24h: number | null;
}

export interface ProviderCandle {
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ProviderOrderBookRow {
  side: "buy" | "sell";
  price: number;
  amount: number;
  filled_amount: number;
}

export interface PlaceOrderParams {
  trading_pair: string;
  side: "buy" | "sell";
  price: number;
  amount: number;
}

export interface PlaceOrderResult {
  order_id?: string;
  [key: string]: unknown;
}

export interface CancelOrderParams {
  order_id: string;
}

export interface ReconcileParams {
  [key: string]: unknown;
}

/**
 * Common surface every execution provider (Kraken, Bybit, Eterna, ...) must
 * implement. Consumers should depend on this interface via
 * getExecutionProvider() rather than importing a concrete provider class
 * directly, so the app doesn't need to hardcode one exchange everywhere.
 */
export interface ExecutionProvider {
  readonly venue: ProviderVenue;

  /** True once real credentials/config for this venue are wired up. */
  isConfigured(): boolean;

  getTicker(symbol: string): Promise<ProviderTicker | null>;
  getCandles(symbol: string, timeframe: string): Promise<ProviderCandle[]>;
  getOrderBook(symbol: string): Promise<ProviderOrderBookRow[]>;
  placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult>;
  cancelOrder(params: CancelOrderParams): Promise<Record<string, unknown>>;
  reconcile(params?: ReconcileParams): Promise<Record<string, unknown>>;
}

/**
 * Thrown by any provider operation that isn't wired up yet (e.g. Bybit and
 * Eterna in Phase 1). Never caught internally to return fake data — callers
 * are expected to surface this as "not connected yet" in the UI.
 */
export class ProviderNotConfiguredError extends Error {
  readonly venue: ProviderVenue;
  readonly operation: string;

  constructor(venue: ProviderVenue, operation: string) {
    super(`${venue[0].toUpperCase()}${venue.slice(1)} is not connected yet.`);
    this.name = "ProviderNotConfiguredError";
    this.venue = venue;
    this.operation = operation;
  }
}
