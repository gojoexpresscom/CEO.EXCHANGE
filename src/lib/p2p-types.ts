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
  /** Present when backend returns these; never fabricated */
  completion_rate?: number | null;
  completed_trades?: number | null;
  avg_release_time_minutes?: number | null;
  is_verified?: boolean | null;
}

/**
 * Trade row shape — fields are optional because the exact p2p_trades
 * column list is not checked into the frontend repo. The UI maps whatever
 * the backend returns and never invents values.
 */
export interface P2PTrade {
  id: string;
  status?: string | null;
  order_id?: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  asset?: string | null;
  fiat_currency?: string | null;
  price?: number | null;
  crypto_amount?: number | null;
  fiat_amount?: number | null;
  payment_method?: string | null;
  payment_method_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  dispute_reason?: string | null;
  [key: string]: unknown;
}

export interface P2PTradeMessage {
  id: string;
  trade_id: string;
  sender_id: string;
  body?: string | null;
  content?: string | null;
  message?: string | null;
  created_at: string;
  [key: string]: unknown;
}

/**
 * User-facing lifecycle RPCs.
 * Only names that appear in the admin surface or create flow are listed as
 * known. Others must match the live backend — wrong names surface as errors,
 * never as fake success.
 *
 * Known in repo:
 *   create_p2p_trade_with_escrow
 *   get_merchant_reputation
 *   admin_force_release_p2p_escrow
 *   admin_refund_p2p_escrow
 *
 * Candidate user RPCs (call only; backend is authoritative):
 *   These names follow the same prefix style as create_p2p_trade_with_escrow
 *   and the admin escrow RPCs. If the live backend uses different names,
 *   the UI shows the server error — it does not pretend success.
 */
export const P2P_RPC = {
  createTrade: "create_p2p_trade_with_escrow",
  merchantReputation: "get_merchant_reputation",
  /** Seller releases crypto after payment confirmed */
  sellerRelease: "release_p2p_escrow",
  /** Buyer submits payment proof / marks paid */
  submitPaymentProof: "submit_p2p_payment_proof",
  /** Cancel trade */
  cancelTrade: "cancel_p2p_trade",
  /** Open dispute */
  openDispute: "raise_p2p_dispute",
  /** Create or update merchant ad */
  updateOrder: "update_p2p_order",
  /** Send chat message (trade-scoped) — optional if table insert works */
  sendMessage: "send_p2p_trade_message",
} as const;

export const P2P_TABLE = {
  orders: "p2p_orders",
  paymentMethods: "p2p_payment_methods",
  trades: "p2p_trades",
  messages: "p2p_messages",
} as const;

export function p2pTradeErrorMessage(
  message: string,
  orderSide: P2POrderSide,
): string {
  const raw = (message || "").toLowerCase();

  if (
    raw.includes("not authenticated") ||
    raw.includes("jwt") ||
    raw.includes("authentication")
  ) {
    return "Please sign in before starting a P2P trade.";
  }

  if (raw.includes("order not found") || raw.includes("p2p order not found")) {
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

  if (raw.includes("own order") || raw.includes("cannot trade with your own")) {
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

  if (raw.includes("payment_method_required")) {
    return "Select a payment method to receive payment into before continuing.";
  }

  if (raw.includes("payment_method_not_found_or_not_owned_by_seller")) {
    return orderSide === "buy"
      ? "Your selected payment method isn't valid for this trade. Pick another one."
      : "This merchant's payment method isn't set up correctly. Please try a different order.";
  }

  if (raw.includes("seller_not_kyc_verified")) {
    return orderSide === "buy"
      ? "You need to complete identity verification before you can fulfill this order."
      : "This merchant isn't verified right now. Please try another order.";
  }

  if (raw.includes("payment_account_name_does_not_match_verified_identity")) {
    return orderSide === "buy"
      ? "The selected payment method's account name must match your verified identity."
      : "This merchant's payment method doesn't match their verified identity.";
  }

  if (
    raw.includes("balance") ||
    raw.includes("insufficient funds") ||
    raw.includes("insufficient usdt")
  ) {
    return "There is not enough available balance to complete this trade.";
  }

  if (raw.includes("escrow") && (raw.includes("failed") || raw.includes("error"))) {
    return "The secure escrow transaction could not be created. No trade was created.";
  }

  if (raw.includes("banned") || raw.includes("account_banned")) {
    return "This account cannot trade right now.";
  }

  if (raw.includes("trade_disputed") || raw.includes("disputed")) {
    return "This trade is in dispute and cannot be completed with this action.";
  }

  if (raw.includes("not_eligible") || raw.includes("trade_not_eligible")) {
    return "This action is not available for the current trade status.";
  }

  if (
    raw.includes("could not find the function") ||
    raw.includes("function") && raw.includes("does not exist")
  ) {
    return "This action is not available on the server yet.";
  }

  return message || "The P2P trade could not be created. Please try again.";
}

export function formatTradeStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const s = status.toLowerCase().replace(/_/g, " ");
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

