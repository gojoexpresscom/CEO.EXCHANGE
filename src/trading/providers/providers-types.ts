// src/trading/providers/types.ts
//
// Shared types for the execution-provider abstraction.
// Live execution for spot is Bybit via the bybit-private Edge Function.

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
  /** limit | market — backend validates */
  order_type?: "limit" | "market";
  /** Required for limit; omit/undefined for market */
  price?: number;
  amount: number;
}

export interface PlaceOrderResult {
  order_id?: string;
  bybit_order_id?: string;
  status?: string;
  error?: string;
  code?: string;
  message?: string;
  live_trading_enabled?: boolean;
  [key: string]: unknown;
}

export interface CancelOrderParams {
  order_id: string;
}

export interface CancelOrderResult {
  order_id?: string;
  status?: string;
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export interface ModifyOrderParams {
  order_id: string;
  price: number;
  /** Optional new size; omit to keep existing amount */
  amount?: number;
}

export interface ModifyOrderResult {
  order_id: string;
  status: string;
  price: number;
  amount: number;
  bybit_order_id?: string;
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export interface ReconcileParams {
  [key: string]: unknown;
}

/**
 * Common surface every execution provider must implement.
 * Consumers should use getExecutionProvider() rather than importing a
 * concrete class, so the app does not hardcode one exchange everywhere.
 */
export interface ExecutionProvider {
  readonly venue: ProviderVenue;

  /** True once real credentials/config for this venue are wired up. */
  isConfigured(): boolean;

  getTicker(symbol: string): Promise<ProviderTicker | null>;
  getCandles(symbol: string, timeframe: string): Promise<ProviderCandle[]>;
  getOrderBook(symbol: string): Promise<ProviderOrderBookRow[]>;
  placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult>;
  cancelOrder(params: CancelOrderParams): Promise<CancelOrderResult>;
  /**
   * Amend an open limit order on the venue + DB.
   * Must NOT succeed without a real venue response.
   */
  modifyOrder(params: ModifyOrderParams): Promise<ModifyOrderResult>;
  reconcile(params?: ReconcileParams): Promise<Record<string, unknown>>;
}

/**
 * Thrown by provider operations that are not wired up yet.
 * Never caught internally to return fake data.
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
