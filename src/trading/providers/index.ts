// src/trading/providers/index.ts
//
// Simple resolver from venue name -> ExecutionProvider instance. Deliberately
// minimal for Phase 1 — no dependency-injection framework, just a lookup.

import type { ExecutionProvider, ProviderVenue } from "./types";
import { KrakenProvider } from "./KrakenProvider";
import { BybitProvider } from "./BybitProvider";
import { EternaProvider } from "./EternaProvider";

const krakenProvider = new KrakenProvider();
const bybitProvider = new BybitProvider();
const eternaProvider = new EternaProvider();

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
      throw new Error(`Unknown execution provider venue: ${String(exhaustive)}`);
    }
  }
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
  ReconcileParams,
} from "./types";
export { ProviderNotConfiguredError } from "./types";
export { KrakenProvider } from "./KrakenProvider";
export { BybitProvider } from "./BybitProvider";
export { EternaProvider } from "./EternaProvider";
