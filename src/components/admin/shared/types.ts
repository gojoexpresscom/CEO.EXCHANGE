export type AdminSection =
  | "dashboard"
  | "users"
  | "kyc"
  | "merchants"
  | "transactions"
  | "tickets"
  | "announcements"
  | "giveaways"
  | "reports"
  | "settings"
  | "roles"
  | "logs"
  | "finance-income"
  | "finance-withdrawals"
  | "finance-deposits"
  | "finance-fees"
  | "p2p-disputes";

export interface AdminProfile {
  id: string;
  email: string;
  role: string;
  nickname?: string | null;
}
