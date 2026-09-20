// src/trading/providers/index.ts
//
// Resolver: venue name → ExecutionProvider instance.
// Live spot execution defaults to Bybit (bybit-private Edge Function).

import type { ExecutionProvider, ProviderVenue } from "./types";
import { KrakenProvider } from "./KrakenProvider";
import { BybitProvider } from "./BybitProvider";
import { EternaProvider } from "./EternaProvider";

const krakenProvider = new KrakenProvider();
const bybitProvider = new BybitProvider();
const eternaProvider = new EternaProvider();

/** Active execution venue for CEO Exchange spot trading. */
export const DEFAULT_EXECUTION_VENUE: ProviderVenue = "bybit";

export function getExecutionProvider(venue: ProviderVenue): ExecutionProvider {
  switch (venue) {
    case "kraken":
      return krakenProvider;
    case "bybit":
      return bybitProvider;
    case "eterna":
      return eternaProvider;
    default: {
      const exhaustive: never = venue;
      throw new Error(
        `Unknown execution provider venue: ${String(exhaustive)}`,
      );
    }
  }
}

/** Convenience: live Bybit execution provider. */
export function getLiveExecutionProvider(): ExecutionProvider {
  return getExecutionProvider(DEFAULT_EXECUTION_VENUE);
}

export type {
  ExecutionProvider,
  ProviderVenue,
  ProviderTicker,
  ProviderCandle,
  ProviderOrderBookRow,
  PlaceOrderParams,
  PlaceOrderResult,
  CancelOrderParams,
  CancelOrderResult,
  ModifyOrderParams,
  ModifyOrderResult,
  ReconcileParams,
} from "./types";
export { ProviderNotConfiguredError } from "./types";
export { KrakenProvider } from "./KrakenProvider";
export { BybitProvider } from "./BybitProvider";
export { EternaProvider } from "./EternaProvider";
