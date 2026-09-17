/** Formatting helpers — pure, no fake data */

export function formatPrice(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: Math.max(2, digits) });
  }
  if (Math.abs(value) >= 0.0001) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export function formatAmount(value: number | null | undefined, digits = 6): string {
  if (value == null || !Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: Math.min(digits, 4) });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function shortAddress(addr: string, left = 6, right = 4): string {
  if (!addr || addr.length < left + right + 2) return addr || "—";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

/** Resolve internal account type from a wallet row without inventing balances. */
export function resolveAccountType(row: {
  account_type?: string | null;
  wallet_type?: string | null;
}): "spot" | "funding" | "futures" | "earn" | "unknown" {
  const raw = (row.account_type || row.wallet_type || "").toLowerCase().trim();
  if (raw === "spot" || raw === "trading") return "spot";
  if (raw === "funding" || raw === "fund") return "funding";
  if (raw === "futures" || raw === "derivative" || raw === "perp") return "futures";
  if (raw === "earn" || raw === "savings" || raw === "staking") return "earn";
  // Default legacy rows without a clear type to spot so they still surface
  if (!raw || raw === "main" || raw === "default") return "spot";
  return "unknown";
}

export function iconUrl(symbol: string): string {
  const s = (symbol || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${encodeURIComponent(s)}.png`;
}
