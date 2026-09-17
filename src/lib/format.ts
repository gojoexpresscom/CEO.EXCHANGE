/** Shared formatting helpers — never invent values */

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1000) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (abs >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  if (abs >= 0.01) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }
  // Tiny assets — avoid rounding to 0.00
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function formatAmount(value: number | null | undefined, digits = 6): string {
  if (value == null || !Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: Math.min(digits, 4),
    });
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

export function resolveAccountType(row: {
  account_type?: string | null;
  wallet_type?: string | null;
}): "spot" | "funding" | "futures" | "earn" | "unknown" {
  const raw = (row.account_type || row.wallet_type || "").toLowerCase().trim();
  if (raw === "spot" || raw === "trading") return "spot";
  if (raw === "funding" || raw === "fund") return "funding";
  if (raw === "futures" || raw === "derivative" || raw === "perp") return "futures";
  if (raw === "earn" || raw === "savings" || raw === "staking") return "earn";
  if (!raw || raw === "main" || raw === "default") return "spot";
  return "unknown";
}

/** SpotHQ cryptocurrency-icons CDN — not exchange branding */
export function iconUrl(symbol: string): string {
  const s = (symbol || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${encodeURIComponent(s)}.png`;
}

