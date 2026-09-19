/**
 * Honest market session status.
 *
 * Crypto / Bybit (spot & perpetual): 24/7 — never artificially frozen on weekends.
 * TradFi (and similar scheduled markets): may be open or closed; closed keeps last real price.
 * Data errors are distinct from a genuine close.
 */

export type SessionStatus = "live" | "closed" | "unavailable";

export type SessionClass = "crypto" | "tradfi" | "unknown";

const CRYPTO_HINTS = [
  "crypto",
  "spot",
  "perpetual",
  "perp",
  "bybit",
  "digital",
];

const TRADFI_HINTS = [
  "tradfi",
  "trad_fi",
  "forex",
  "fx",
  "stock",
  "equity",
  "index",
  "commodity",
  "metal",
  "bond",
];

/** Classify a market from category / type strings (never invents data). */
export function classifyMarketSession(opts: {
  market_category?: string | null;
  market_type?: string | null;
  kind?: string | null;
  primaryTab?: string | null;
}): SessionClass {
  const blob = [
    opts.market_category,
    opts.market_type,
    opts.kind,
    opts.primaryTab,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (TRADFI_HINTS.some((h) => blob.includes(h))) return "tradfi";
  if (CRYPTO_HINTS.some((h) => blob.includes(h))) return "crypto";
  // Default CEO Exchange catalog is crypto/Bybit unless marked TradFi
  if (opts.primaryTab === "TradFi") return "tradfi";
  return "crypto";
}

/**
 * Resolve UI session status from real fields when present.
 * Crypto is always "live" when a real price exists; never weekend-frozen.
 * TradFi uses explicit open/closed flags from the backend when available.
 */
export function resolveSessionStatus(opts: {
  sessionClass: SessionClass;
  hasRealPrice: boolean;
  /** Explicit backend flags if the schema provides them */
  is_session_open?: boolean | null;
  market_status?: string | null;
  session_status?: string | null;
  /** Provider feed failed (Bybit disconnected, etc.) */
  providerUnavailable?: boolean;
}): SessionStatus {
  const statusRaw = (
    opts.session_status ||
    opts.market_status ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (
    statusRaw === "closed" ||
    statusRaw === "market_closed" ||
    statusRaw === "halted" ||
    opts.is_session_open === false
  ) {
    // Only treat as closed for scheduled markets (TradFi). Crypto stays live.
    if (opts.sessionClass === "tradfi") return "closed";
  }

  if (opts.is_session_open === true || statusRaw === "open" || statusRaw === "live") {
    return opts.hasRealPrice ? "live" : opts.providerUnavailable ? "unavailable" : "live";
  }

  if (opts.sessionClass === "crypto") {
    // 24/7: price present → live; no price + provider down → unavailable; else live (waiting)
    if (opts.hasRealPrice) return "live";
    if (opts.providerUnavailable) return "unavailable";
    return "live";
  }

  // TradFi without explicit flags: price exists → treat as last known (could be closed);
  // without price → unavailable rather than inventing a close.
  if (opts.hasRealPrice) return "live";
  if (opts.providerUnavailable) return "unavailable";
  return "unavailable";
}

export function sessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "closed":
      return "Market Closed";
    case "unavailable":
      return "Market data temporarily unavailable";
    case "live":
    default:
      return "Live";
  }
}

/** Short badge text for list rows */
export function sessionBadgeLabel(status: SessionStatus): string | null {
  if (status === "closed") return "Closed";
  if (status === "unavailable") return "Unavailable";
  return null;
}
