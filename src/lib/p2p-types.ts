export type P2POrderSide = "buy" | "sell";

export interface P2POrder {
  id: string;
  user_id: string;
  merchant_name: string;
  side: P2POrderSide;
  asset: string;
  fiat_currency: string;
  price: number;
  min_limit: number;
  max_limit: number;
  available_usdt: number;
  payment_methods: string[] | null;
  completion_rate: number;
  avg_release_time_minutes: number | null;
  is_active: boolean;
  status: string;
  created_at: string;
}

export interface P2PPaymentMethod {
  id: string;
  bank_name: string | null;
  account_name: string | null;
  is_active: boolean;
}

export interface MerchantReputation {
  avg_rating: number;
  review_count: number;
}

export function p2pTradeErrorMessage(
  message: string,
  orderSide: P2POrderSide,
): string {
  const raw = (message || "").toLowerCase();

  if (
    raw.includes("not authenticated") ||
    raw.includes("not authenticated") ||
    raw.includes("jwt") ||
    raw.includes("authentication")
  ) {
    return "Please sign in before starting a P2P trade.";
  }

  if (
    raw.includes("order not found") ||
    raw.includes("p2p order not found")
  ) {
    return "This P2P order is no longer available.";
  }

  if (
    raw.includes("order is inactive") ||
    raw.includes("order inactive") ||
    raw.includes("not active") ||
    raw.includes("inactive order")
  ) {
    return "This P2P order is no longer active.";
  }

  if (
    raw.includes("own order") ||
    raw.includes("cannot trade with your own")
  ) {
    return "You cannot trade against your own P2P order.";
  }

  if (
    raw.includes("insufficient liquidity") ||
    raw.includes("not enough liquidity") ||
    raw.includes("available_usdt")
  ) {
    return "This order does not have enough remaining liquidity for that amount.";
  }

  if (
    raw.includes("amount below") ||
    raw.includes("minimum") ||
    raw.includes("min_limit")
  ) {
    return `The amount is below this ${orderSide === "buy" ? "buy" : "sell"} order's minimum limit.`;
  }

  if (
    raw.includes("amount above") ||
    raw.includes("maximum") ||
    raw.includes("max_limit")
  ) {
    return `The amount is above this ${orderSide === "buy" ? "buy" : "sell"} order's maximum limit.`;
  }

  if (
    raw.includes("payment method") ||
    raw.includes("payment_method")
  ) {
    return "The selected payment method could not be used for this trade.";
  }

  if (
    raw.includes("balance") ||
    raw.includes("insufficient funds") ||
    raw.includes("insufficient usdt")
  ) {
    return "There is not enough available balance to complete this trade.";
  }

  if (
    raw.includes("escrow") &&
    (raw.includes("failed") || raw.includes("error"))
  ) {
    return "The secure escrow transaction could not be created. No trade was created.";
  }

  return message || "The P2P trade could not be created. Please try again.";
}
