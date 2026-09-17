/** Shared frontend types for CEO.EXCHANGE */

export type AccountType = "spot" | "funding" | "futures" | "earn";

export type WalletRow = {
  id: string;
  user_id: string | null;
  asset: string;
  balance: number | null;
  locked_balance: number | null;
  escrow_balance: number | null;
  /** Preferred backend field */
  account_type?: string | null;
  /** Legacy field still present on some rows */
  wallet_type?: string | null;
  status?: string | null;
};

export type TradingPairRow = {
  id?: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  is_active?: boolean | null;
  listed_at?: string | null;
  base_name?: string | null;
};

export type AssetMeta = {
  symbol: string;
  name: string | null;
  is_active?: boolean | null;
};

export type MarketFavorite = {
  symbol: string;
};

export type StakingProduct = {
  id: string;
  asset: string;
  name?: string | null;
  apr?: number | null;
  apy?: number | null;
  lock_period_days?: number | null;
  min_amount?: number | null;
  is_active?: boolean | null;
};

export type StakingPosition = {
  id: string;
  user_id: string;
  product_id?: string | null;
  asset: string;
  amount: number;
  rewards?: number | null;
  unlock_at?: string | null;
  status?: string | null;
  created_at?: string | null;
};

/** Matches public.web3_wallets */
export type Web3Wallet = {
  id: string;
  user_id: string;
  wallet_address: string;
  chain: string;
  connector_name?: string | null;
  connected_at?: string | null;
  last_used_at?: string | null;
};

export type NavPage = "home" | "markets" | "trade" | "earn" | "assets";

