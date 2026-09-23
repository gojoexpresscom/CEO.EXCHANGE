export type AdminSection =
  | "dashboard"
  | "users"
  | "kyc"
  | "merchants"
  | "transactions"
  | "tickets"
  | "announcements"
  | "giveaways"
  | "promotions"
  | "reports"
  | "settings"
  | "roles"
  | "logs"
  | "finance-income"
  | "finance-withdrawals"
  | "finance-deposits"
  | "finance-fees"
  | "p2p-disputes"
  | "binance-operations";

export interface AdminProfile {
  id: string;
  email: string;
  role: string;
  nickname?: string | null;
}

