import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  user_id: string | null;
  nickname: string | null;
  email: string | null;
  profile_picture_url: string | null;
  referral_code: string | null;
  warning_count: number | null;
  role: string | null;
};

type Wallet = {
  id: string;
  user_id: string | null;
  asset: string;
  balance: number | null;
  locked_balance: number;
  escrow_balance: number | null;
  wallet_type: string;
  status: string;
};

type Market = {
  symbol: string;
  last_price: number | null;
  change_24h: number | null;
  volume_24h: number | null;
  updated_at: string | null;
  base_asset: string;
  quote_asset: string;
  base_name?: string;
  hasTicker: boolean;
};

type Post = {
  id: string;
  user_id: string | null;
  content: string | null;
  image_url: string | null;
  likes: number | null;
  likes_count: number | null;
  comments_count: number | null;
  reposts_count: number | null;
  views_count: number | null;
  created_at: string | null;
  profile?: Pick<Profile, "nickname" | "profile_picture_url">;
  likedByMe?: boolean;
};

type Notification = {
  id: string;
  is_read?: boolean | null;
  type: string | null;
  message: string | null;
  created_at: string | null;
  unread?: boolean;
};

type Announcement = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string | null;
  read?: boolean;
};

type PlatformAnnouncement = {
  id: string;
  title: string;
  content: string;
  type: string | null;
  author_role: string | null;
  created_at: string | null;
};

type LoginHistory = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

type Ticket = {
  id: string;
  subject: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TicketMessage = {
  id: string;
  ticket_id: string | null;
  sender_id: string | null;
  message: string;
  created_at: string | null;
};

type TicketAttachment = {
  id: string;
  ticket_id: string | null;
  file_url: string;
  created_at: string | null;
};

type StatusHistory = {
  id: string;
  ticket_id: string | null;
  status: string;
  changed_by: string | null;
  created_at: string | null;
};

type Giveaway = {
  id: string;
  title: string | null;
  description: string | null;
  prize_amount: number | null;
  status: string | null;
  winner_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type Referral = {
  id: string;
  referral_code: string;
  total_referrals: number;
  total_rewards: number;
  qualified_referrals: number;
  reward_cycles: number;
  reward_eligible_amount: number;
};

type Network = {
  id: string;
  asset_id: string | null;
  network_name: string;
  payout_provider: string | null;
  privy_chain_type: string | null;
  min_withdrawal: number | null;
  withdrawal_fee: number | null;
  is_active: boolean | null;
  deposit_enabled: boolean | null;
  withdrawal_enabled: boolean | null;
  min_deposit: number | null;
  required_confirmations: number | null;
  privy_network_identifier: string | null;
  assets?: { symbol: string; name: string } | null;
};

type WalletAddress = {
  id: string;
  user_id: string;
  network_id: string;
  address: string;
  privy_wallet_id: string | null;
  chain_type: string | null;
};

type DepositAddress = {
  id: string;
  user_id: string | null;
  coin: string | null;
  network: string | null;
  address: string | null;
  created_at: string | null;
};

type Deposit = {
  id: string;
  asset: string;
  amount: number;
  status: string | null;
  nowpayments_invoice_url: string | null;
  nowpayments_payment_id: string | null;
  tx_hash: string | null;
  created_at: string | null;
};

type Withdrawal = {
  id: string;
  asset: string;
  network: string | null;
  amount: number;
  fee: number;
  destination_address: string;
  status: string | null;
  payout_provider: string | null;
  provider_reference: string | null;
  tx_hash: string | null;
  created_at: string | null;
};

type Comment = {
  id: string;
  post_id: string | null;
  user_id: string | null;
  content: string;
  created_at: string | null;
  profile?: Pick<Profile, "nickname" | "profile_picture_url">;
};

type Modal = "deposit" | "withdraw" | "notifications" | "support" | "invite" | "rewards" | "giveaway" | "menu" | "post" | "announcement" | null;
type NotificationTab = "Announcements" | "Transactions" | "Security/Login";
type FeedTab = "CEO Exchange" | "Following" | "Campaign" | "Announcements";
type MarketTab = "Hot" | "New" | "Gainers" | "Losers" | "Favorites";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";
const BG = "#050505";
const CARD = "#101010";
const BORDER = "#2a2110";

function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><path d="M18 4l1-1"/></>,
    headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v5H5a1 1 0 0 1-1-1z"/><path d="M20 14h-3v5h2a1 1 0 0 0 1-1z"/><path d="M17 19c0 1-2 2-4 2"/></>,
    menu: <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>,
    eye: <><path d="M2.5 12s3.2-5 9.5-5 9.5 5 9.5 5-3.2 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></>,
    eyeOff: <><path d="M3 3l18 18"/><path d="M10.6 5.2A11 11 0 0 1 12 5c6.3 0 9.5 5 9.5 5s-.9 1.5-2.5 2.8"/><path d="M6.3 7.1C3.9 8.6 2.5 10 2.5 10s3.2 5 9.5 5c1.1 0 2.1-.15 3-.4"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    userPlus: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M18 8v6"/><path d="M15 11h6"/></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12"/><path d="M3 13h18"/><path d="M12 9H7.5a2.5 2.5 0 1 1 2.3-3.5C10.6 7 12 9 12 9Z"/><path d="M12 9h4.5a2.5 2.5 0 1 0-2.3-3.5C13.4 7 12 9 12 9Z"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
    heart: <path d="M20.8 8.9c0 5.3-8.8 10.4-8.8 10.4S3.2 14.2 3.2 8.9A4.4 4.4 0 0 1 12 6.7a4.4 4.4 0 0 1 8.8 2.2Z"/>,
    comment: <><path d="M20 11.5a7.5 7.5 0 0 1-7.8 7.5c-1.1 0-2.1-.2-3-.6L4 20l1.6-4.4A7.2 7.2 0 0 1 4.5 11 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/></>,
    repost: <><path d="m17 3 4 4-4 4"/><path d="M3 7h18"/><path d="m7 21-4-4 4-4"/><path d="M21 17H3"/></>,
    share: <><path d="m20 4-7 16-3-7-6-3z"/><path d="M10 13 20 4"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    close: <><path d="M6 6l12 12"/><path d="M18 6 6 18"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    arrowLeft: <path d="m15 18-6-6 6-6"/>,
    chevron: <path d="m7 9 5 5 5-5"/>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></>,
    chart: <><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/><path d="M3 19h18"/></>,
    trade: <><path d="M5 7h14"/><path d="m15 3 4 4-4 4"/><path d="M19 17H5"/><path d="m9 13-4 4 4 4"/></>,
    percent: <><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M19 5 5 19"/></>,
    wallet: <><path d="M4 6h15a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M3 8h15a2 2 0 0 1 2 2v2h-5a2 2 0 0 0 0 4h5v2"/><path d="M15 14h.01"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    lock: <><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    ticket: <><path d="M4 7a2 2 0 0 0 0 4 2 2 0 0 0 0 4v3h16v-3a2 2 0 0 0 0-4 2 2 0 0 0 0-4V4H4z"/><path d="M12 4v16"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-5"/></>,
    camera: <><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="m12 3 10 18H2z"/><path d="M12 9v5"/><path d="M12 17h.01"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></>,
    upload: <><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 3h16"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.menu}</svg>;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPrice(value: number) {
  if (value >= 1000) return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

function timeAgo(value: string | null) {
  if (!value) return "";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function deviceName(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (/Android/i.test(userAgent)) return "Android device";
  if (/iPhone|iPad/i.test(userAgent)) return "Apple device";
  if (/Windows/i.test(userAgent)) return "Windows device";
  if (/Mac OS/i.test(userAgent)) return "Mac device";
  if (/Linux/i.test(userAgent)) return "Linux device";
  return "Web browser";
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "CE";
}

export default function Home({
  onLogout,
  onTrade,
}: {
  onLogout?: () => void;
  onTrade: (symbol: string) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [platformAnnouncements, setPlatformAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [logins, setLogins] = useState<LoginHistory[]>([]);
  const [adminWarnings, setAdminWarnings] = useState<{ id: string; description: string | null; event_type: string | null; created_at: string | null }[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
  const [ticketStatusHistory, setTicketStatusHistory] = useState<StatusHistory[]>([]);
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [walletAddresses, setWalletAddresses] = useState<WalletAddress[]>([]);
  const [depositAddresses, setDepositAddresses] = useState<DepositAddress[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [depositResult, setDepositResult] = useState<any>(null);
  const [notificationTab, setNotificationTab] = useState<NotificationTab>("Announcements");
  const [feedTab, setFeedTab] = useState<FeedTab>("CEO Exchange");
  const [marketTab, setMarketTab] = useState<MarketTab>("Hot");
  const [search, setSearch] = useState("");
  const [showBalance, setShowBalance] = useState(true);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [admin, setAdmin] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ceo-market-favorites") || "[]");
      if (Array.isArray(saved)) setFavoriteSymbols(saved.filter((x) => typeof x === "string"));
    } catch { setFavoriteSymbols([]); }
  }, []);

  const loadProfileAndWallets = useCallback(async (id: string) => {
    const [{ data: p, error: pe }, { data: w, error: we }] = await Promise.all([
      supabase.from("profiles").select("id,user_id,nickname,email,profile_picture_url,referral_code,warning_count,role").eq("id", id).maybeSingle(),
      supabase.from("wallets").select("id,user_id,asset,balance,locked_balance,escrow_balance,wallet_type,status").eq("user_id", id),
    ]);
    if (pe) throw pe;
    if (we) throw we;
    setProfile(p as Profile | null);
    setWallets((w ?? []) as Wallet[]);
    setAdmin((p as Profile | null)?.role === "admin");
    return p as Profile | null;
  }, []);

  const loadMarkets = useCallback(async () => {
    const [{ data: pairs, error: pairError }, { data: tickers, error: tickerError }, { data: assets, error: assetError }] = await Promise.all([
      supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("is_active", true).order("symbol").limit(100),
      supabase.from("market_tickers").select("symbol,last_price,change_24h,volume_24h,updated_at").limit(100),
      supabase.from("assets").select("symbol,name,is_active").eq("is_active", true).order("symbol").limit(100),
    ]);
    if (pairError) throw pairError;
    if (tickerError) throw tickerError;
    if (assetError) throw assetError;

    const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const tickerMap = new Map((tickers ?? []).map((ticker: any) => [normalize(String(ticker.symbol ?? "")), ticker]));
    const assetMap = new Map((assets ?? []).map((asset: any) => [String(asset.symbol ?? "").toUpperCase(), asset]));
    const rows = (pairs ?? []).map((pair: any) => {
      const symbol = String(pair.symbol ?? `${pair.base_asset}/${pair.quote_asset}`);
      const ticker = tickerMap.get(normalize(symbol));
      return {
        symbol,
        base_asset: String(pair.base_asset ?? ""),
        quote_asset: String(pair.quote_asset ?? ""),
        base_name: assetMap.get(String(pair.base_asset ?? "").toUpperCase())?.name ?? undefined,
        last_price: ticker?.last_price == null ? null : Number(ticker.last_price),
        change_24h: ticker?.change_24h == null ? null : Number(ticker.change_24h),
        volume_24h: ticker?.volume_24h == null ? null : Number(ticker.volume_24h),
        updated_at: ticker?.updated_at ?? null,
        hasTicker: Boolean(ticker),
      } as Market;
    });
    setMarkets(rows);
  }, []);

  const loadPosts = useCallback(async (id: string, tab: FeedTab) => {
    let query = supabase.from("posts").select("id,user_id,content,image_url,likes,likes_count,comments_count,reposts_count,views_count,created_at").order("created_at", { ascending: false }).limit(50);
    if (tab === "Following") {
      const { data: follows, error: fe } = await supabase.from("user_follows").select("following_id").eq("follower_id", id);
      if (fe) throw fe;
      const ids = (follows ?? []).map((x: { following_id: string | null }) => x.following_id).filter(Boolean) as string[];
      if (!ids.length) {
        setPosts([]);
        return;
      }
      query = query.in("user_id", ids);
    }
    const { data, error: e } = await query;
    if (e) throw e;
    const rows = (data ?? []) as Post[];
    const userIds = [...new Set(rows.map((p) => p.user_id).filter(Boolean))] as string[];
    const [{ data: ps }, { data: likes }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,nickname,profile_picture_url").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      rows.length ? supabase.from("post_likes").select("post_id").eq("user_id", id).in("post_id", rows.map((p) => p.id)) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap = new Map((ps ?? []).map((p: any) => [p.id, p]));
    const liked = new Set((likes ?? []).map((l: any) => l.post_id));
    setPosts(rows.map((p) => ({ ...p, profile: pMap.get(p.user_id ?? ""), likedByMe: liked.has(p.id) })));
  }, []);

  const loadNotifications = useCallback(async (id: string) => {
    const [{ data: n }, { data: a }, { data: reads }, { data: l }, { data: w }] = await Promise.all([
      supabase.from("user_notifications").select("id,type,message,created_at,is_read").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("announcements").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("announcement_reads").select("announcement_id,read_at").eq("user_id", id),
      supabase.from("user_login_history").select("id,ip_address,user_agent,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(30),
      supabase.from("admin_activity_log").select("id,description,event_type,created_at").eq("target_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    setNotifications((n ?? []) as Notification[]);
    const readSet = new Set((reads ?? []).map((r: any) => r.announcement_id));
    setAnnouncements((a ?? []).map((x: any) => ({ ...x, read: readSet.has(x.id) })) as Announcement[]);
    setLogins((l ?? []) as LoginHistory[]);
    setAdminWarnings((w ?? []) as any[]);
  }, []);

  const loadPlatformAnnouncements = useCallback(async () => {
    const { data, error: e } = await supabase.from("platform_announcements").select("id,title,content,type,author_role,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(50);
    if (!e) setPlatformAnnouncements((data ?? []) as PlatformAnnouncement[]);
  }, []);

  const loadSupport = useCallback(async (id: string) => {
    const { data, error: e } = await supabase.from("support_tickets").select("id,subject,message,status,created_at,updated_at").eq("user_id", id).order("updated_at", { ascending: false });
    if (!e) setTickets((data ?? []) as Ticket[]);
  }, []);

  const loadSelectedTicket = useCallback(async (ticketId: string) => {
    const [{ data: m }, { data: a }, { data: h }] = await Promise.all([
      supabase.from("ticket_messages").select("id,ticket_id,sender_id,message,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      supabase.from("ticket_attachments").select("id,ticket_id,file_url,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      supabase.from("ticket_status_history").select("id,ticket_id,status,changed_by,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    ]);
    setTicketMessages((m ?? []) as TicketMessage[]);
    setTicketAttachments((a ?? []) as TicketAttachment[]);
    setTicketStatusHistory((h ?? []) as StatusHistory[]);
  }, []);

  const loadReferrals = useCallback(async () => {
    const { data } = await supabase.from("referrals").select("id,referral_code,total_referrals,total_rewards,qualified_referrals,reward_cycles,reward_eligible_amount").maybeSingle();
    setReferral((data ?? null) as Referral | null);
  }, []);

  const loadGiveaways = useCallback(async () => {
    const { data } = await supabase.from("giveaways").select("id,title,description,prize_amount,status,winner_id,starts_at,ends_at").order("created_at", { ascending: false }).limit(20);
    setGiveaways((data ?? []) as Giveaway[]);
  }, []);

  const loadNetworks = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("asset_networks")
      .select("id,asset_id,network_name,payout_provider,privy_chain_type,min_withdrawal,withdrawal_fee,is_active,deposit_enabled,withdrawal_enabled,min_deposit,required_confirmations,privy_network_identifier,assets(symbol,name)")
      .eq("is_active", true)
      .order("network_name");
    if (e) throw e;
    setNetworks((data ?? []) as unknown as Network[]);
  }, []);

  const loadDepositAddresses = useCallback(async (id: string) => {
    const [{ data: wa }, { data: da }] = await Promise.all([
      supabase.from("wallet_addresses").select("id,user_id,network_id,address,privy_wallet_id,chain_type").eq("user_id", id),
      supabase.from("deposit_addresses").select("id,user_id,coin,network,address,created_at").eq("user_id", id),
    ]);
    setWalletAddresses((wa ?? []) as WalletAddress[]);
    setDepositAddresses((da ?? []) as DepositAddress[]);
  }, []);

  const loadTransactions = useCallback(async (id: string) => {
    const [{ data: d }, { data: w }] = await Promise.all([
      supabase.from("deposits").select("id,asset,amount,status,nowpayments_invoice_url,nowpayments_payment_id,tx_hash,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("withdrawals").select("id,asset,network,amount,fee,destination_address,status,payout_provider,provider_reference,tx_hash,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    setDeposits((d ?? []) as Deposit[]);
    setWithdrawals((w ?? []) as Withdrawal[]);
  }, []);

  const loadAll = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadProfileAndWallets(id), loadMarkets(), loadPosts(id, feedTab), loadNotifications(id), loadPlatformAnnouncements(),
        loadSupport(id), loadReferrals(), loadGiveaways(), loadNetworks(), loadDepositAddresses(id), loadTransactions(id),
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Unable to load the Home Page.");
    } finally {
      setLoading(false);
    }
  }, [feedTab, loadDepositAddresses, loadGiveaways, loadMarkets, loadNotifications, loadPosts, loadProfileAndWallets, loadReferrals, loadSupport, loadTransactions, loadNetworks, loadPlatformAnnouncements]);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(e.message);
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (id) void loadAll(id);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null;
      setUserId(id);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setWallets([]);
        onLogout?.();
      } else if (id) {
        void loadAll(id);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [loadAll, onLogout]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("home-live").on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` }, () => { void loadProfileAndWallets(userId); }).on("postgres_changes", { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${userId}` }, () => { void loadNotifications(userId); }).on("postgres_changes", { event: "*", schema: "public", table: "market_tickers" }, () => { void loadMarkets(); }).on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => { void loadPosts(userId, feedTab); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [feedTab, loadMarkets, loadNotifications, loadPosts, loadProfileAndWallets, userId]);

  const marketMap = useMemo(() => new Map(markets.map((m) => [m.symbol.toUpperCase(), m])), [markets]);
  const totalUsd = useMemo(() => wallets.reduce((sum, w) => {
    const amount = Number(w.balance ?? 0);
    const asset = w.asset.toUpperCase();
    if (!amount) return sum;
    if (["USDT", "USDC", "USD"].includes(asset)) return sum + amount;
    const quote = marketMap.get(`${asset}/USDT`) ?? marketMap.get(`${asset}USDT`);
    return sum + amount * Number(quote?.last_price ?? 0);
  }, 0), [marketMap, wallets]);

  const filteredMarkets = useMemo(() => {
    const featured = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];
    const normalize = (symbol: string) => symbol.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const featuredRank = new Map(featured.map((s, i) => [normalize(s), i]));
    let list = [...markets];

    if (marketTab === "Favorites") {
      list = list.filter((m) => favoriteSymbols.includes(m.symbol));
    } else if (marketTab === "Gainers") {
      list.sort((a, b) => Number(b.change_24h ?? -Infinity) - Number(a.change_24h ?? -Infinity));
    } else if (marketTab === "Losers") {
      list.sort((a, b) => Number(a.change_24h ?? Infinity) - Number(b.change_24h ?? Infinity));
    } else if (marketTab === "New") {
      list.sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
    } else {
      list.sort((a, b) => {
        const ar = featuredRank.get(normalize(a.symbol));
        const br = featuredRank.get(normalize(b.symbol));
        if (ar != null && br != null) return ar - br;
        if (ar != null) return -1;
        if (br != null) return 1;
        return Number(b.volume_24h ?? -Infinity) - Number(a.volume_24h ?? -Infinity);
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => `${m.symbol} ${m.base_asset} ${m.quote_asset}`.toLowerCase().includes(q));
    }

    return showAllMarkets ? list : list.slice(0, 3);
  }, [favoriteSymbols, marketTab, markets, search, showAllMarkets]);

  const filteredPosts = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter((p) => `${p.content ?? ""} ${p.profile?.nickname ?? ""}`.toLowerCase().includes(q));
  }, [posts, search]);

  const unreadAnnouncements = announcements.filter((a) => !a.read).length;
  const unreadTransactions = notifications.filter((n) => !n.is_read && /deposit|withdraw/i.test(n.type ?? "")).length;
  const warningCountDelta = Math.max(0, Number(profile?.warning_count ?? 0) - Number(localStorage.getItem(`ceo-warning-count:${userId}`) ?? 0));
  const unreadSecurity = notifications.filter((n) => !n.is_read && /security|login|warning|2fa/i.test(n.type ?? "")).length + warningCountDelta;
  const unreadTotal = unreadAnnouncements + unreadTransactions + unreadSecurity;

  const closeModal = () => { setModal(null); if (modal === "deposit") setDepositResult(null); };

  const toggleFavorite = (symbol: string) => {
    const next = favoriteSymbols.includes(symbol)
      ? favoriteSymbols.filter((x) => x !== symbol)
      : [...favoriteSymbols, symbol];
    setFavoriteSymbols(next);
    localStorage.setItem("ceo-market-favorites", JSON.stringify(next));
    notify(next.includes(symbol) ? `${symbol} added to Favorites.` : `${symbol} removed from Favorites.`);
  };

  const markAnnouncementRead = async (announcement: Announcement) => {
    if (!userId || announcement.read) return;
    const { error: e } = await supabase.from("announcement_reads").insert({ user_id: userId, announcement_id: announcement.id, read_at: new Date().toISOString() });
    if (!e || e.code === "23505") setAnnouncements((items) => items.map((x) => x.id === announcement.id ? { ...x, read: true } : x));
  };

  const markNotificationRead = async (notification: Notification) => {
    if (!notification.id || notification.is_read) return;
    const { error: e } = await supabase.from("user_notifications").update({ is_read: true }).eq("id", notification.id).eq("user_id", userId ?? "");
    if (!e) setNotifications((items) => items.map((x) => x.id === notification.id ? { ...x, unread: false } : x));
  };

  const rememberWarningCount = () => {
    if (userId) localStorage.setItem(`ceo-warning-count:${userId}`, String(profile?.warning_count ?? 0));
  };

  const toggleLike = async (post: Post) => {
    if (!userId) return;
    const wasLiked = Boolean(post.likedByMe);
    setPosts((items) => items.map((p) => p.id === post.id ? { ...p, likedByMe: !wasLiked, likes_count: Math.max(0, Number(p.likes_count ?? p.likes ?? 0) + (wasLiked ? -1 : 1)), likes: Math.max(0, Number(p.likes ?? p.likes_count ?? 0) + (wasLiked ? -1 : 1)) } : p));
    if (wasLiked) {
      const { error: e } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
      if (e) { setPosts((items) => items.map((p) => p.id === post.id ? { ...p, likedByMe: wasLiked } : p)); notify(e.message); }
    } else {
      const { error: e } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId });
      if (e && e.code !== "23505") { setPosts((items) => items.map((p) => p.id === post.id ? { ...p, likedByMe: false } : p)); notify(e.message); }
    }
  };

  const openComments = async (postId: string) => {
    setCommentPostId(postId);
    setModal("post");
    const { data, error: e } = await supabase.from("post_comments").select("id,post_id,user_id,content,created_at").eq("post_id", postId).order("created_at", { ascending: true }).limit(100);
    if (e) return notify(e.message);
    const rows = (data ?? []) as Comment[];
    const ids = [...new Set(rows.map((x) => x.user_id).filter(Boolean))] as string[];
    const { data: ps } = ids.length ? await supabase.from("profiles").select("id,nickname,profile_picture_url").in("id", ids) : { data: [] as any[] };
    const map = new Map((ps ?? []).map((p: any) => [p.id, p]));
    setComments(rows.map((x) => ({ ...x, profile: map.get(x.user_id ?? "") })));
  };

  const addComment = async (content: string) => {
    if (!userId || !commentPostId || !content.trim()) return;
    const { error: e } = await supabase.from("post_comments").insert({ post_id: commentPostId, user_id: userId, content: content.trim() });
    if (e) return notify(e.message);
    await openComments(commentPostId);
    notify("Comment posted.");
  };

  const recordView = async (postId: string) => {
    if (!userId) return;
    await supabase.from("post_views").insert({ post_id: postId, user_id: userId });
  };

  const repost = async (post: Post) => {
    const next = Number(post.reposts_count ?? 0) + 1;
    setPosts((items) => items.map((p) => p.id === post.id ? { ...p, reposts_count: next } : p));
    const { error: e } = await supabase.from("posts").update({ reposts_count: next }).eq("id", post.id);
    if (e) {
      setPosts((items) => items.map((p) => p.id === post.id ? { ...p, reposts_count: Number(post.reposts_count ?? 0) } : p));
      notify(e.message);
    } else notify("Repost count updated.");
  };

  const sharePost = async (postId: string) => {
    const link = `${window.location.origin}/?post=${encodeURIComponent(postId)}`;
    try {
      if (navigator.share) await navigator.share({ title: "CEO Exchange", url: link });
      else { await navigator.clipboard.writeText(link); notify("Post link copied."); }
    } catch { /* user cancelled share */ }
  };

  const createPost = async (content: string, imageUrl: string) => {
    if (!userId || !content.trim() || !imageUrl.trim()) return notify("Add a caption and an image URL.");
    const { error: e } = await supabase.from("posts").insert({ user_id: userId, content: content.trim(), image_url: imageUrl.trim(), likes: 0, likes_count: 0, comments_count: 0, reposts_count: 0, views_count: 0 });
    if (e) return notify(e.message);
    closeModal();
    await loadPosts(userId, feedTab);
    notify("Post published.");
  };

  const createTicket = async (subject: string, message: string, attachmentUrl: string) => {
    if (!userId || !subject.trim() || !message.trim()) return notify("Subject and message are required.");
    const { data: ticket, error: e } = await supabase.from("support_tickets").insert({ user_id: userId, subject: subject.trim(), message: message.trim(), status: "OPEN" }).select("id,subject,message,status,created_at,updated_at").single();
    if (e || !ticket) return notify(e?.message ?? "Could not create ticket.");
    await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, sender_id: userId, message: message.trim() });
    if (attachmentUrl.trim()) await supabase.from("ticket_attachments").insert({ ticket_id: ticket.id, file_url: attachmentUrl.trim() });
    await supabase.from("ticket_status_history").insert({ ticket_id: ticket.id, status: "OPEN", changed_by: userId });
    await loadSupport(userId);
    setSelectedTicket(ticket.id);
    await loadSelectedTicket(ticket.id);
    notify("Support ticket created.");
  };

  const sendTicketMessage = async (message: string) => {
    if (!userId || !selectedTicket || !message.trim()) return;
    const { error: e } = await supabase.from("ticket_messages").insert({ ticket_id: selectedTicket, sender_id: userId, message: message.trim() });
    if (e) return notify(e.message);
    await loadSelectedTicket(selectedTicket);
  };

  const createDeposit = async (asset: string, network: string, amount: string) => {
    if (!amount || Number(amount) <= 0) return notify("Enter a positive deposit amount.");
    if (!network) return notify("Choose a supported network.");
    const { data, error: e } = await supabase.functions.invoke("nowpayments-create-payment", { body: { asset, network, amount: Number(amount) } });
    if (e) return notify(e.message);
    if (data?.error) return notify(String(data.error));
    setDepositResult(data);
    await loadTransactions(userId ?? "");
    notify("Deposit address created.");
    return data;
  };

  const requestWithdrawalOtp = async () => {
    const { data, error: e } = await supabase.functions.invoke("send-otp", { body: { purpose: "withdrawal" } });
    if (e) return notify(e.message);
    if (data?.email_delivered === false) notify("Withdrawal OTP email delivery is not configured. Add BREVO_API_KEY and BREVO_SENDER_EMAIL in Supabase Edge Function secrets.");
    else notify("A 6-digit withdrawal OTP was sent to your account email.");
  };

  const calculateFee = async (asset: string, network: string, amount: string) => {
    if (!amount || Number(amount) <= 0) return null;
    const { data, error: e } = await supabase.rpc("calculate_withdrawal_fee", { p_amount: Number(amount), p_currency: asset, p_network: network });
    if (e) { notify(e.message); return null; }
    return data as any;
  };

  const submitWithdrawal = async (asset: string, network: string, destination: string, amount: string, otp: string): Promise<string | null> => {
    if (!destination.trim() || !amount || Number(amount) <= 0 || !/^\d{6}$/.test(otp)) {
      notify("Asset, network, destination, amount and a 6-digit OTP are required.");
      return null;
    }
    const { data: verification, error: verifyError } = await supabase.functions.invoke("verify-otp", { body: { code: otp, purpose: "withdrawal" } });
    if (verifyError) { notify(verifyError.message); return null; }
    if (verification?.error) { notify(String(verification.error)); return null; }
    const { data, error: e } = await supabase.rpc("process_crypto_withdrawal", {
      p_asset: asset,
      p_network: network,
      p_destination_address: destination.trim(),
      p_amount: Number(amount),
      p_otp_code: otp,
    });
    if (e) { notify(e.message); return null; }
    await loadTransactions(userId ?? "");
    await loadProfileAndWallets(userId ?? "");
    const requestId = String(data);
    notify(`Withdrawal request ${requestId.slice(0, 8)}… created.`);
    return requestId;
  };

  const createPlatformAnnouncement = async (title: string, content: string, type: string) => {
    if (!userId || !admin) return notify("Only administrators can publish Campaign/Announcements posts.");
    if (!title.trim() || !content.trim()) return notify("Title and content are required.");
    const { error: e } = await supabase.from("platform_announcements").insert({ title: title.trim(), content: content.trim(), type: type.trim() || "announcement", author_role: "admin", is_active: true });
    if (e) return notify(e.message);
    await loadPlatformAnnouncements();
    notify("Announcement published.");
  };

  const referralLink = referral?.referral_code ? `${window.location.origin}/?ref=${encodeURIComponent(referral.referral_code)}` : "";

  if (!userId && loading) return <div style={styles.center}><div style={styles.spinner} /><span>Loading CEO Exchange…</span></div>;
  if (!userId) return <div style={styles.center}>Please sign in to continue.</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src="/ceo-auth-reference-transparent.png" alt="CEO Exchange" style={styles.logo} />
          <div style={styles.brandName}>{profile?.nickname || "CEO"}</div>
        </div>
        <div style={styles.topSearch}>
          <Icon name="search" size={20} />
          <input style={styles.topSearchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search CEO Exchange" />
          {search && <button style={styles.iconButton} onClick={() => setSearch("")} aria-label="Clear search"><Icon name="close" size={18} /></button>}
        </div>
        <div style={styles.headerActions}>
          <button style={styles.iconSquare} onClick={() => setModal("support")} aria-label="Support"><Icon name="headset" size={25} /></button>
          <button style={styles.iconSquare} onClick={() => setModal("notifications")} aria-label="Notifications"><Icon name="bell" size={25} />{unreadTotal > 0 && <span style={styles.badge}>{unreadTotal > 99 ? "99+" : unreadTotal}</span>}</button>
          <button style={styles.iconSquare} onClick={() => setModal("menu")} aria-label="Menu"><Icon name="menu" size={27} /></button>
        </div>
      </header>

      {error && <div style={styles.errorBar}>{error}<button onClick={() => userId && loadAll(userId)} style={styles.retry}>Retry</button></div>}

      <main style={styles.content}>
        <section style={styles.balanceCard}>
          <div style={styles.balanceInfo}>
            <div style={styles.muted}>Estimated Balance</div>
            <div style={styles.balanceLine}>
              <strong>{showBalance ? `$${formatMoney(totalUsd)}` : "••••"}</strong>
              <button style={styles.eyeButton} onClick={() => setShowBalance((x) => !x)} aria-label={showBalance ? "Hide balance" : "Show balance"}><Icon name={showBalance ? "eye" : "eyeOff"} size={23} /></button>
            </div>
            <div style={styles.subtle}>Real wallet balance from Supabase</div>
            <div style={styles.balanceButtons}>
              <button style={styles.primaryButton} onClick={() => setModal("deposit")}><Icon name="plus" size={20} />Deposit</button>
              <button style={styles.secondaryButton} onClick={() => setModal("withdraw")}><Icon name="plus" size={20} />Withdraw</button>
            </div>
          </div>
          <div style={styles.walletVisual} aria-hidden="true">
            <div style={styles.walletShape}>
              <img src="/ceo-auth-reference-transparent.png" alt="" style={styles.walletLogo} />
            </div>
          </div>
        </section>

        <section style={styles.quickGrid}>
          <QuickAction icon="userPlus" label="Invite" onClick={() => setModal("invite")} />
          <QuickAction icon="gift" label="Rewards" onClick={() => setModal("rewards")} />
          <QuickAction icon="gift" label="Giveaway" onClick={() => setModal("giveaway")} />
        </section>

        <section style={styles.marketSection}>
          <div style={styles.tabsRow}>
            {(["Hot", "New", "Gainers", "Losers", "Favorites"] as MarketTab[]).map((tab) => <button key={tab} onClick={() => setMarketTab(tab)} style={{ ...styles.tab, ...(marketTab === tab ? styles.tabActive : {}) }}><Icon name={tab === "Favorites" ? "star" : tab === "Gainers" ? "chart" : tab === "Losers" ? "chart" : tab === "New" ? "plus" : "star"} size={17} />{tab}</button>)}
          </div>
          <div style={styles.marketHeader}><span aria-hidden="true" /><span>Pair</span><span>Last Price</span><span>24h Change</span><span>Action</span></div>
          {filteredMarkets.map((m) => <MarketRow key={m.symbol} market={m} favorite={favoriteSymbols.includes(m.symbol)} onFavorite={() => toggleFavorite(m.symbol)} onTrade={() => onTrade(m.symbol)} />)}
          {!filteredMarkets.length && <Empty text={marketTab === "Favorites" ? "No favorite markets yet." : "No market data is available yet."} />}
          {markets.length > 3 && <button style={styles.viewAll} onClick={() => setShowAllMarkets((value) => !value)}>{showAllMarkets ? "Show Featured Markets" : "View All Markets"} <Icon name="arrow" size={19} /></button>}
        </section>

        <section style={styles.feedSection}>
          <div style={styles.sectionTitle}><span style={styles.goldBar} />CEO Exchange</div>
          <div style={styles.feedTabs}>{(["CEO Exchange", "Following", "Campaign", "Announcements"] as FeedTab[]).map((tab) => <button key={tab} onClick={() => { setFeedTab(tab); if (userId) void loadPosts(userId, tab); }} style={{ ...styles.feedTab, ...(feedTab === tab ? styles.feedTabActive : {}) }}>{tab}</button>)}</div>
          {(feedTab === "Campaign" || feedTab === "Announcements") && <>
            {admin && <button style={styles.createPostButton} onClick={() => setModal("announcement")}><Icon name="plus" size={19} />Create {feedTab === "Campaign" ? "campaign" : "announcement"}</button>}
            {platformAnnouncements.filter((a) => feedTab === "Campaign" ? /campaign/i.test(a.type ?? "") : !/campaign/i.test(a.type ?? "")).map((a) => <PlatformCard key={a.id} item={a} />)}
          </>}
          {(feedTab === "CEO Exchange" || feedTab === "Following") && <>
            <button style={styles.createPostButton} onClick={() => setModal("post")}><Icon name="plus" size={18} />Create post</button>
            {filteredPosts.map((p) => <PostCard key={p.id} post={p} onView={() => void recordView(p.id)} onLike={() => void toggleLike(p)} onComment={() => void openComments(p.id)} onRepost={() => void repost(p)} onShare={() => void sharePost(p.id)} />)}
            {!filteredPosts.length && <Empty text={feedTab === "Following" ? "You are not following anyone yet." : "No posts yet."} />}
          </>}
        </section>
      </main>

      <nav style={styles.bottomNav}>
        <NavItem icon="home" label="Home" active onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <NavItem icon="chart" label="Markets" onClick={() => notify("Markets navigation is coming next.")} />
        <NavItem icon="trade" label="Trade" onClick={() => notify("Trade navigation is coming next.")} />
        <NavItem icon="percent" label="Earn" onClick={() => notify("Earn navigation is coming next.")} />
        <NavItem icon="wallet" label="Assets" onClick={() => notify("Assets navigation is coming next.")} />
      </nav>

      {toast && <div style={styles.toast}>{toast}</div>}
      {modal === "deposit" && <DepositModal networks={networks} deposits={deposits} result={depositResult} onClose={() => { setDepositResult(null); closeModal(); }} onDeposit={createDeposit} />}
      {modal === "withdraw" && <WithdrawModal wallets={wallets} networks={networks} withdrawals={withdrawals} onClose={closeModal} onRequestOtp={requestWithdrawalOtp} onCalculateFee={calculateFee} onWithdraw={submitWithdrawal} />}
      {modal === "notifications" && <NotificationsModal tab={notificationTab} setTab={setNotificationTab} announcements={announcements} notifications={notifications} logins={logins} warnings={adminWarnings} unread={{ Announcements: unreadAnnouncements, Transactions: unreadTransactions, "Security/Login": unreadSecurity }} onAnnouncementRead={markAnnouncementRead} onNotificationRead={markNotificationRead} onRememberWarning={rememberWarningCount} onClose={closeModal} />}
      {modal === "support" && <SupportModal tickets={tickets} selectedTicket={selectedTicket} setSelectedTicket={async (id) => { setSelectedTicket(id); await loadSelectedTicket(id); }} messages={ticketMessages} attachments={ticketAttachments} history={ticketStatusHistory} onClose={closeModal} onCreate={createTicket} onSend={sendTicketMessage} />}
      {modal === "invite" && <InviteModal referral={referral} link={referralLink} onClose={closeModal} onCopy={async () => { if (referralLink) { await navigator.clipboard.writeText(referralLink); notify("Referral link copied."); } }} />}
      {modal === "rewards" && <RewardsModal referral={referral} onClose={closeModal} />}
      {modal === "giveaway" && <GiveawayModal giveaways={giveaways} onClose={closeModal} />}
      {modal === "menu" && <MenuModal profile={profile} onClose={closeModal} onLogout={async () => { await supabase.auth.signOut(); onLogout?.(); }} />}
      {modal === "post" && commentPostId ? <CommentsModal comments={comments} onClose={closeModal} onAdd={addComment} /> : modal === "post" ? <CreatePostModal onClose={closeModal} onCreate={createPost} /> : null}
      {modal === "announcement" && <CreateAnnouncementModal defaultType={feedTab === "Campaign" ? "campaign" : "announcement"} onClose={closeModal} onCreate={createPlatformAnnouncement} />}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button style={styles.quickAction} onClick={onClick}><span style={styles.quickIcon}><Icon name={icon} size={30} /></span><span>{label}</span></button>;
}

function MarketRow({ market, favorite, onFavorite, onTrade }: { market: Market; favorite: boolean; onFavorite: () => void; onTrade: () => void }) {
  const change = market.change_24h == null ? null : Number(market.change_24h);
  return (
    <div style={styles.marketRow}>
      <button style={{ ...styles.starButton, ...(favorite ? styles.starButtonActive : {}) }} onClick={onFavorite} aria-label={favorite ? "Remove favorite" : "Add favorite"} title={favorite ? "Remove from Favorites" : "Add to Favorites"}><Icon name="star" size={18} /></button>
      <div style={styles.pair}><b>{market.symbol}</b><span>{market.base_name || market.base_asset}{market.volume_24h == null ? " · No volume yet" : ` · Vol ${formatMoney(Number(market.volume_24h))}`}</span></div>
      <div style={styles.price}>{market.last_price == null ? "—" : formatPrice(Number(market.last_price))}</div>
      <div style={{ ...styles.change, color: change == null ? "#777" : change >= 0 ? "#22c7a4" : "#ff6574" }}>{change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}</div>
      <button style={styles.tradeButton} onClick={onTrade}>Trade</button>
    </div>
  );
}

function PostCard({ post, onView, onLike, onComment, onRepost, onShare }: { post: Post; onView: () => void; onLike: () => void; onComment: () => void; onRepost: () => void; onShare: () => void }) {
  useEffect(() => { onView(); }, [post.id]);
  const name = post.profile?.nickname || "CEO Member";
  return <article style={styles.postCard}><div style={styles.postHead}><Avatar url={post.profile?.profile_picture_url} text={name} /><div style={{ flex: 1 }}><b>{name}</b><div style={styles.postTime}>{timeAgo(post.created_at)} ago</div></div><button style={styles.moreButton}>•••</button></div>{post.content && <div style={styles.postText}>{post.content}</div>}{post.image_url && <img src={post.image_url} alt="Post" style={styles.postImage} onError={(e) => { e.currentTarget.style.display = "none"; }} />}<div style={styles.postActions}><button onClick={onLike} style={{ ...styles.postAction, color: post.likedByMe ? GOLD_LIGHT : "#aaa" }}><Icon name="heart" size={19} />{post.likes_count ?? post.likes ?? 0}</button><button onClick={onComment} style={styles.postAction}><Icon name="comment" size={19} />{post.comments_count ?? 0}</button><button onClick={onRepost} style={styles.postAction}><Icon name="repost" size={19} />{post.reposts_count ?? 0}</button><button onClick={onShare} style={styles.postAction}><Icon name="share" size={19} />Share</button></div></article>;
}

function PlatformCard({ item }: { item: PlatformAnnouncement }) {
  return <article style={styles.announcementCard}><div style={styles.announcementMeta}><span style={styles.pill}>{item.type || "Announcement"}</span><span>{timeAgo(item.created_at)} ago</span></div><h3 style={styles.announcementTitle}>{item.title}</h3><p style={styles.announcementBody}>{item.content}</p></article>;
}

function Avatar({ url, text }: { url?: string | null; text: string }) {
  return url ? <img src={url} alt="" style={styles.avatar} /> : <div style={styles.avatarFallback}>{initials(text)}</div>;
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ ...styles.navItem, color: active ? GOLD_LIGHT : "#777" }}><Icon name={icon} size={25} /><span>{label}</span></button>;
}

function Empty({ text }: { text: string }) { return <div style={styles.empty}>{text}</div>; }

function ModalShell({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div style={styles.overlay}><div style={{ ...styles.modal, ...(wide ? styles.modalWide : {}) }}><div style={styles.modalHeader}><h2>{title}</h2><button style={styles.iconButton} onClick={onClose}><Icon name="close" size={22} /></button></div>{children}</div></div>;
}

function DepositModal({
  networks,
  walletAddresses,
  depositAddresses,
  deposits,
  onClose,
}: {
  networks: Network[];
  walletAddresses: WalletAddress[];
  depositAddresses: DepositAddress[];
  deposits: Deposit[];
  onClose: () => void;
}) {
  type Step = "methods" | "coins" | "networks" | "address";
  const [step, setStep] = useState<Step>("methods");
  const [search, setSearch] = useState("");
  const [asset, setAsset] = useState("");
  const [network, setNetwork] = useState<Network | null>(null);

  const depositNetworks = networks.filter((n) => n.is_active !== false && n.deposit_enabled === true);
  const assetMap = new Map<string, { symbol: string; name: string }>();
  depositNetworks.forEach((n) => {
    const symbol = String(n.assets?.symbol ?? "").toUpperCase();
    if (symbol && !assetMap.has(symbol)) assetMap.set(symbol, { symbol, name: String(n.assets?.name ?? symbol) });
  });

  const assets = [...assetMap.values()]
    .filter((x) => `${x.symbol} ${x.name}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const assetNetworks = depositNetworks.filter(
    (n) => String(n.assets?.symbol ?? "").toUpperCase() === asset.toUpperCase()
  );

  const addressForNetwork = (n: Network | null) => {
    if (!n) return "";
    const walletAddress = walletAddresses.find((x) => x.network_id === n.id)?.address;
    if (walletAddress) return walletAddress;
    return depositAddresses.find(
      (x) =>
        String(x.coin ?? "").toUpperCase() === asset.toUpperCase() &&
        String(x.network ?? "").toUpperCase() === n.network_name.toUpperCase()
    )?.address ?? "";
  };

  const address = addressForNetwork(network);
  const minDeposit = network?.min_deposit ?? null;
  const qrUrl = address
    ? `https://quickchart.io/qr?size=280&margin=2&text=${encodeURIComponent(address)}`
    : "";

  const goBack = () => {
    if (step === "methods") onClose();
    else if (step === "coins") setStep("methods");
    else if (step === "networks") setStep("coins");
    else setStep("networks");
  };

  const chooseAsset = (symbol: string) => {
    setAsset(symbol);
    setNetwork(null);
    setSearch("");
    setStep("networks");
  };

  const chooseNetwork = (n: Network) => {
    setNetwork(n);
    setStep("address");
  };

  const recentAssets = [...new Set(
    deposits.map((d) => String(d.asset ?? "").toUpperCase()).filter(Boolean)
  )].slice(0, 6);

  return (
    <ModalShell
      title={step === "methods" ? "Select Payment Method" : step === "coins" ? "Select Coin" : step === "networks" ? "Choose a Chain Type" : `${asset}-Deposit`}
      onClose={onClose}
      wide={step === "coins" || step === "networks"}
    >
      {step !== "methods" && (
        <button type="button" style={styles.flowBack} onClick={goBack}>
          <Icon name="arrowLeft" size={19} /> Back
        </button>
      )}

      {step === "methods" && (
        <>
          <button type="button" style={styles.methodLarge} onClick={() => setStep("coins")}>
            <span style={styles.methodLargeIcon}><Icon name="download" size={23} /></span>
            <span style={styles.methodLargeText}><b>Deposit Crypto</b><small>Transfer crypto from your on-chain wallet or another exchange.</small></span>
            <Icon name="arrow" size={21} />
          </button>
          <button type="button" style={styles.methodLargeDisabled} disabled>
            <span style={styles.methodLargeIcon}><Icon name="trade" size={23} /></span>
            <span style={styles.methodLargeText}><b>P2P Trading</b><small>More choices, better prices — available later.</small></span>
            <span style={styles.comingSoon}>Later</span>
          </button>
          <button type="button" style={styles.methodLargeDisabled} disabled>
            <span style={styles.methodLargeIcon}><Icon name="userPlus" size={23} /></span>
            <span style={styles.methodLargeText}><b>Deposit via CEO User</b><small>CEO User transfers will be added later.</small></span>
            <span style={styles.comingSoon}>Later</span>
          </button>
        </>
      )}

      {step === "coins" && (
        <>
          <div style={styles.depositSearch}>
            <Icon name="search" size={20} />
            <input style={styles.depositSearchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search deposit coin" />
            {search && <button type="button" style={styles.iconButton} onClick={() => setSearch("")}><Icon name="close" size={18} /></button>}
          </div>

          {recentAssets.length > 0 && (
            <div style={styles.recentBlock}>
              <div style={styles.recentTitle}>Recent</div>
              <div style={styles.chipRow}>
                {recentAssets.map((x) => <button type="button" key={x} style={styles.assetChip} onClick={() => chooseAsset(x)}>{x}</button>)}
              </div>
            </div>
          )}

          <div style={styles.assetList}>
            {assets.map((x) => (
              <button type="button" key={x.symbol} style={styles.assetRow} onClick={() => chooseAsset(x.symbol)}>
                <span style={styles.assetIcon}>{x.symbol.slice(0, 1)}</span>
                <span style={styles.assetInfo}><b>{x.symbol}</b><small>{x.name}</small></span>
                <Icon name="arrow" size={19} />
              </button>
            ))}
            {!assets.length && (
              <div style={styles.emptyPanel}>
                <b>No crypto deposit currencies are enabled.</b>
                <p>Only active deposit networks configured in Supabase are shown. No fake currencies or networks are added.</p>
              </div>
            )}
          </div>
        </>
      )}

      {step === "networks" && (
        <>
          <div style={styles.networkNotice}>
            <Icon name="shield" size={18} />
            <span>Make sure the network you deposit on is the same network used for the deposit address.</span>
          </div>
          <div style={styles.chainList}>
            {assetNetworks.map((n) => (
              <button type="button" key={n.id} style={styles.chainRow} onClick={() => chooseNetwork(n)}>
                <span style={styles.chainIcon}>{n.network_name.slice(0, 1)}</span>
                <span style={styles.chainInfo}>
                  <b>{n.network_name}</b>
                  <small>Minimum deposit: {n.min_deposit == null ? "Not configured" : `${formatAmount(Number(n.min_deposit))} ${asset}`}</small>
                </span>
                <Icon name="arrow" size={19} />
              </button>
            ))}
            {!assetNetworks.length && (
              <div style={styles.emptyPanel}>
                <b>No enabled deposit network for {asset}.</b>
                <p>This page never invents a network or address.</p>
              </div>
            )}
          </div>
        </>
      )}

      {step === "address" && network && (
        <>
          <div style={styles.depositNetworkPicker}>
            <span>Network:</span>
            <button type="button" onClick={() => setStep("networks")}>
              {network.network_name}<Icon name="chevron" size={17} />
            </button>
          </div>

          {!address ? (
            <div style={styles.emptyPanel}>
              <b>Deposit address is not available yet.</b>
              <p>There is no real user-specific address stored for this asset/network. The frontend will not display a fake address.</p>
            </div>
          ) : (
            <>
              <div style={styles.depositQrWrap}>
                <img src={qrUrl} alt={`${asset} ${network.network_name} deposit QR code`} style={styles.depositQrLarge} />
              </div>

              <div style={styles.addressCard}>
                <div style={styles.addressLabel}>Wallet Address</div>
                <div style={styles.addressValue}>{address}</div>
              </div>

              <div style={styles.depositDetails}>
                <div>
                  <span>Minimum Deposit Amount</span>
                  <b>{minDeposit == null ? "Not configured" : `${formatAmount(Number(minDeposit))} ${asset}`}</b>
                </div>
              </div>

              <div style={styles.depositActions}>
                <button type="button" style={styles.secondaryButtonFull} onClick={() => { void navigator.clipboard?.writeText(address); }}>
                  <Icon name="copy" size={18} /> Copy Address
                </button>
                <button type="button" style={styles.primaryButtonFull} onClick={() => {
                  const link = document.createElement("a");
                  link.href = qrUrl;
                  link.target = "_blank";
                  link.rel = "noreferrer";
                  link.click();
                }}>
                  Save Picture
                </button>
              </div>
            </>
          )}
        </>
      )}

      {step !== "methods" && (
        <>
          <div style={styles.divider} />
          <h3 style={styles.smallTitle}>Recent deposits</h3>
          {deposits.slice(0, 8).map((d) => (
            <div key={d.id} style={styles.listRow}>
              <span><b>{d.asset}</b> {formatAmount(Number(d.amount))}</span>
              <span style={styles.status}>{d.status || "PENDING"}</span>
            </div>
          ))}
          {!deposits.length && <Empty text="No deposits yet." />}
        </>
      )}
    </ModalShell>
  );
}

function WithdrawModal({
  wallets,
  networks,
  withdrawals,
  onClose,
  onRequestOtp,
  onCalculateFee,
  onWithdraw,
}: {
  wallets: Wallet[];
  networks: Network[];
  withdrawals: Withdrawal[];
  onClose: () => void;
  onRequestOtp: () => Promise<void>;
  onCalculateFee: (asset: string, network: string, amount: string) => Promise<any>;
  onWithdraw: (asset: string, network: string, destination: string, amount: string, otp: string) => Promise<string | null>;
}) {
  type Step = "coins" | "method" | "form" | "otp" | "done";
  const [step, setStep] = useState<Step>("coins");
  const [asset, setAsset] = useState("");
  const [network, setNetwork] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [otp, setOtp] = useState("");
  const [fee, setFee] = useState<any>(null);
  const [requestId, setRequestId] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [search, setSearch] = useState("");

  const withdrawableWallets = wallets
    .filter((w) => Number(w.balance ?? 0) > 0)
    .filter((w) => w.wallet_type.toLowerCase() !== "savings");

  const uniqueWallets = [...new Map(withdrawableWallets.map((w) => [w.asset.toUpperCase(), w])).values()]
    .filter((w) => w.asset.toLowerCase().includes(search.trim().toLowerCase()));

  const balance = Number(
    wallets.find((w) => w.asset.toUpperCase() === asset.toUpperCase() && w.wallet_type.toLowerCase() !== "savings")?.balance ??
    wallets.find((w) => w.asset.toUpperCase() === asset.toUpperCase())?.balance ??
    0
  );

  const availableNetworks = networks.filter(
    (n) =>
      n.withdrawal_enabled === true &&
      (n.assets?.symbol || "").toUpperCase() === asset.toUpperCase()
  );
  const selectedNetwork = availableNetworks.find((n) => n.network_name === network) ?? null;

  useEffect(() => {
    if (!amount || !network || !asset) {
      setFee(null);
      return;
    }
    let cancelled = false;
    void onCalculateFee(asset, network, amount).then((x) => {
      if (!cancelled) setFee(x);
    });
    return () => { cancelled = true; };
  }, [amount, asset, network, onCalculateFee]);

  const chooseAsset = (value: string) => {
    setAsset(value);
    setNetwork("");
    setDestination("");
    setAmount("");
    setFee(null);
    setStep("method");
  };

  const sendOtp = async () => {
    if (!destination.trim() || !amount || Number(amount) <= 0 || !network || Number(amount) > balance) return;
    setOtpSending(true);
    try {
      await onRequestOtp();
      setStep("otp");
    } finally {
      setOtpSending(false);
    }
  };

  const confirmWithdrawal = async () => {
    if (!/^\d{6}$/.test(otp)) return;
    const id = await onWithdraw(asset, network, destination, amount, otp);
    if (id) {
      setRequestId(id);
      setStep("done");
    }
  };

  const goBack = () => {
    if (step === "coins") onClose();
    else if (step === "method") setStep("coins");
    else if (step === "form") setStep("method");
    else if (step === "otp") setStep("form");
    else setStep("coins");
  };

  const qrUrl = destination
    ? `https://quickchart.io/qr?size=280&margin=2&text=${encodeURIComponent(destination)}`
    : "";

  return (
    <ModalShell title={step === "coins" ? "Select Coin" : step === "method" ? "Withdraw" : step === "form" ? `${asset}-On-Chain` : step === "otp" ? "Confirm Withdrawal" : "Transaction Details"} onClose={onClose} wide={step === "coins"}>
      {step !== "coins" && step !== "done" && (
        <button type="button" style={styles.flowBack} onClick={goBack}>
          <Icon name="arrowLeft" size={19} /> Back
        </button>
      )}

      {step === "coins" && (
        <>
          <div style={styles.depositSearch}>
            <Icon name="search" size={20} />
            <input style={styles.depositSearchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search withdrawal currency" />
            {search && <button type="button" style={styles.iconButton} onClick={() => setSearch("")}><Icon name="close" size={18} /></button>}
          </div>
          <div style={styles.assetList}>
            {uniqueWallets.map((w) => (
              <button type="button" key={w.asset} style={styles.assetRow} onClick={() => chooseAsset(w.asset)}>
                <span style={styles.assetIcon}>{w.asset.slice(0, 1)}</span>
                <span style={styles.assetInfo}><b>{w.asset.toUpperCase()}</b><small>Available balance</small></span>
                <span style={styles.assetBalance}>{formatAmount(Number(w.balance ?? 0))}</span>
              </button>
            ))}
            {!uniqueWallets.length && <div style={styles.emptyPanel}><b>No currency with an available balance.</b><p>Only balances currently present in your Supabase wallet are shown.</p></div>}
          </div>
        </>
      )}

      {step === "method" && (
        <>
          <div style={styles.balanceHero}>
            <div><span>Available balance</span><strong>{formatAmount(balance)} {asset}</strong></div>
          </div>
          <button type="button" style={styles.methodLarge} onClick={() => setStep("form")}>
            <span style={styles.methodLargeIcon}><Icon name="upload" size={23} /></span>
            <span style={styles.methodLargeText}><b>On-Chain</b><small>Withdrawal to an on-chain address</small></span>
            <Icon name="arrow" size={21} />
          </button>
          <button type="button" style={styles.methodLargeDisabled} disabled>
            <span style={styles.methodLargeIcon}><Icon name="userPlus" size={23} /></span>
            <span style={styles.methodLargeText}><b>Internal Transfer to CEO User</b><small>CEO User transfer will be added later. No Bybit transfer is used.</small></span>
            <span style={styles.comingSoon}>Later</span>
          </button>
        </>
      )}

      {step === "form" && (
        <>
          <div style={styles.balanceHero}>
            <div><span>Available balance</span><strong>{formatAmount(balance)} {asset}</strong></div>
          </div>

          <label style={styles.cleanField}>
            <span>Address</span>
            <input style={styles.cleanInput} value={destination} onChange={(e) => setDestination(e.target.value.trimStart())} placeholder="Input or paste withdrawal address" autoCapitalize="none" autoCorrect="off" />
          </label>

          <label style={styles.cleanField}>
            <span>Network</span>
            <select style={styles.cleanInput} value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="">Please choose a chain type</option>
              {availableNetworks.map((n) => <option key={n.id} value={n.network_name}>{n.network_name}</option>)}
            </select>
          </label>

          <label style={styles.cleanField}>
            <span>Amount</span>
            <div style={styles.amountInputWrap}>
              <input style={styles.cleanInput} type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Min. withdrawal: ${selectedNetwork?.min_withdrawal == null ? "Not configured" : formatAmount(Number(selectedNetwork.min_withdrawal))}`} />
              <b>{asset}</b>
            </div>
          </label>

          {selectedNetwork?.min_withdrawal != null && <div style={styles.minimumLine}>Minimum withdrawal: {formatAmount(Number(selectedNetwork.min_withdrawal))} {asset}</div>}

          {fee?.success && (
            <div style={styles.feeBox}>
              <span>Network fee</span><b>{formatAmount(Number(fee.network_fee))}</b>
              <span>Platform fee</span><b>{formatAmount(Number(fee.platform_fee))}</b>
              <span>Total fee</span><b>{formatAmount(Number(fee.total_fee))}</b>
              <span>You receive</span><b>{formatAmount(Number(fee.net_amount))}</b>
            </div>
          )}

          <button
            type="button"
            style={styles.primaryButtonFull}
            disabled={!destination.trim() || !network || !amount || Number(amount) <= 0 || Number(amount) > balance || otpSending}
            onClick={() => void sendOtp()}
          >
            <Icon name="upload" size={19} /> Withdraw
          </button>
        </>
      )}

      {step === "otp" && (
        <div style={styles.otpPage}>
          <div style={styles.otpIcon}><Icon name="shield" size={30} /></div>
          <h3>Check your email</h3>
          <p>A 6-digit verification code was sent to your account email. Enter it below to confirm this withdrawal.</p>
          <input
            style={styles.otpInputLarge}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
          <button type="button" style={styles.primaryButtonFull} disabled={otp.length !== 6} onClick={() => void confirmWithdrawal()}>
            Confirm
          </button>
        </div>
      )}

      {step === "done" && (
        <>
          <div style={styles.transactionHero}>
            <div style={styles.successMark}>✓</div>
            <h3>Withdrawal Submitted</h3>
            <span>{requestId}</span>
          </div>
          <div style={styles.transactionQr}>
            {qrUrl && <img src={qrUrl} alt="Withdrawal destination QR code" style={styles.depositQrLarge} />}
          </div>
          <div style={styles.transactionCard}>
            <div><span>Asset</span><b>{asset}</b></div>
            <div><span>Network</span><b>{network}</b></div>
            <div><span>Amount</span><b>{formatAmount(Number(amount))} {asset}</b></div>
            <div><span>Address</span><b>{destination}</b></div>
            <div><span>Transaction ID</span><b>{requestId}</b></div>
            <div><span>Status</span><b>Pending</b></div>
          </div>
          <button type="button" style={styles.secondaryButtonFull} onClick={onClose}>Done</button>
        </>
      )}

      {step !== "done" && step !== "coins" && (
        <>
          <div style={styles.divider} />
          <h3 style={styles.smallTitle}>Recent withdrawals</h3>
          {withdrawals.slice(0, 8).map((w) => (
            <div key={w.id} style={styles.listRow}>
              <span><b>{w.asset}</b> {formatAmount(Number(w.amount))}</span>
              <span style={styles.status}>{w.status || "PENDING"}</span>
            </div>
          ))}
          {!withdrawals.length && <Empty text="No withdrawals yet." />}
        </>
      )}
    </ModalShell>
  );
}

function NotificationsModal({ tab, setTab, announcements, notifications, logins, warnings, unread, onAnnouncementRead, onNotificationRead, onRememberWarning, onClose }: { tab: NotificationTab; setTab: (x: NotificationTab) => void; announcements: Announcement[]; notifications: Notification[]; logins: LoginHistory[]; warnings: { id: string; description: string | null; event_type: string | null; created_at: string | null }[]; unread: Record<NotificationTab, number>; onAnnouncementRead: (x: Announcement) => Promise<void>; onNotificationRead: (x: Notification) => Promise<void>; onRememberWarning: () => void; onClose: () => void }) {
  return <ModalShell title="Notifications" onClose={onClose} wide><div style={styles.modalTabs}>{(["Announcements", "Transactions", "Security/Login"] as NotificationTab[]).map((x) => <button key={x} onClick={() => setTab(x)} style={{ ...styles.modalTab, ...(tab === x ? styles.modalTabActive : {}) }}>{x}{unread[x] > 0 && <span style={styles.tabBadge}>{unread[x]}</span>}</button>)}</div>{tab === "Announcements" && announcements.map((a) => <button key={a.id} onClick={() => void onAnnouncementRead(a)} style={{ ...styles.notificationCard, opacity: a.read ? 0.65 : 1 }}><div style={styles.notificationTitle}>{a.title || "Announcement"}{!a.read && <span style={styles.dot} />}</div><div>{a.body}</div><small>{timeAgo(a.created_at)} ago</small></button>)}{tab === "Transactions" && notifications.filter((n) => /deposit|withdraw/i.test(n.type ?? "")).map((n) => <button key={n.id} onClick={() => void onNotificationRead(n)} style={styles.notificationCard}><div style={styles.notificationTitle}>{n.type || "Transaction"}{!n.is_read && <span style={styles.dot} />}</div><div>{n.message}</div><small>{timeAgo(n.created_at)} ago</small></button>)}{tab === "Security/Login" && <>{warningCountDelta > 0 && <div style={styles.warningItem}><Icon name="alert" size={19} /><div><b>Account warning count increased</b><div>Your profile now has {profile?.warning_count ?? 0} warning(s).</div><small>This alert is local until you mark the current count as seen.</small></div></div>}{warnings.filter((w) => /warn/i.test(w.event_type ?? "") || /warn/i.test(w.description ?? "")).map((w) => <div key={w.id} style={styles.warningItem}><Icon name="alert" size={19} /><div><b>Security warning</b><div>{w.description}</div><small>{timeAgo(w.created_at)} ago</small></div></div>)}{logins.map((l) => <div key={l.id} style={styles.loginItem}><Icon name="shield" size={19} /><div><b>{deviceName(l.user_agent)}</b><div>IP: {l.ip_address || "Unavailable"}</div><small>{l.created_at ? new Date(l.created_at).toLocaleString() : ""}</small></div></div>)}<button style={styles.secondaryButtonFull} onClick={onRememberWarning}>Mark current warning count as seen</button></>}{tab === "Announcements" && !announcements.length && <Empty text="No announcements." />}{tab === "Transactions" && !notifications.filter((n) => /deposit|withdraw/i.test(n.type ?? "")).length && <Empty text="No transaction notifications." />}{tab === "Security/Login" && !logins.length && !warnings.length && <Empty text="No security events yet." />}</ModalShell>;
}

function SupportModal({ tickets, selectedTicket, setSelectedTicket, messages, attachments, history, onClose, onCreate, onSend }: { tickets: Ticket[]; selectedTicket: string | null; setSelectedTicket: (id: string) => Promise<void>; messages: TicketMessage[]; attachments: TicketAttachment[]; history: StatusHistory[]; onClose: () => void; onCreate: (subject: string, message: string, attachmentUrl: string) => Promise<void>; onSend: (message: string) => Promise<void> }) {
  const [newTicket, setNewTicket] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [reply, setReply] = useState("");
  return <ModalShell title="Support" onClose={onClose} wide><div style={styles.supportGrid}><aside style={styles.ticketList}>{tickets.map((t) => <button key={t.id} onClick={() => { setNewTicket(false); void setSelectedTicket(t.id); }} style={{ ...styles.ticketItem, ...(selectedTicket === t.id ? styles.ticketItemActive : {}) }}><b>{t.subject || "Support ticket"}</b><span>{t.status || "OPEN"}</span><small>{timeAgo(t.updated_at || t.created_at)} ago</small></button>)}<button style={styles.secondaryButtonFull} onClick={() => { setNewTicket(true); }}>New ticket</button></aside><div style={styles.ticketThread}>{newTicket ? <><h3>Open a support ticket</h3><label style={styles.label}>Subject<input style={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} /></label><label style={styles.label}>Message<textarea style={styles.textarea} value={message} onChange={(e) => setMessage(e.target.value)} /></label><label style={styles.label}>Existing attachment URL (optional)<input style={styles.input} value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://…" /></label><div style={styles.warningBox}><Icon name="alert" size={18} />No support-specific storage bucket exists in the live project, so this UI does not create a new bucket or pretend file upload works. Existing ticket_attachments records are displayed.</div><button style={styles.primaryButtonFull} onClick={() => void onCreate(subject, message, attachmentUrl)}>Create ticket</button></> : <><div style={styles.threadHeader}><b>{tickets.find((t) => t.id === selectedTicket)?.subject || "Support ticket"}</b><span>{tickets.find((t) => t.id === selectedTicket)?.status || ""}</span></div><div style={styles.messages}>{messages.map((m) => <div key={m.id} style={styles.messageBubble}><div>{m.message}</div><small>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</small></div>)}</div>{attachments.length > 0 && <div style={styles.attachments}>{attachments.map((a) => <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" style={styles.attachment}>{a.file_url}</a>)}</div>}<div style={styles.history}>{history.map((h) => <span key={h.id} style={styles.pill}>{h.status}</span>)}</div><div style={styles.otpRow}><input style={{ ...styles.input, flex: 1 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to support" /><button style={styles.primaryButton} onClick={() => { void onSend(reply); setReply(""); }}>Send</button></div></>}</div></div></ModalShell>;
}

function InviteModal({ referral, link, onClose, onCopy }: { referral: Referral | null; link: string; onClose: () => void; onCopy: () => Promise<void> }) {
  return <ModalShell title="Invite" onClose={onClose}><p style={styles.modalHint}>Your referral link uses the current domain dynamically and your existing profiles.referral_code.</p><div style={styles.referralCode}>{referral?.referral_code || "Not assigned"}</div><div style={styles.linkBox}>{link || "No referral code is available."}</div><button style={styles.primaryButtonFull} disabled={!link} onClick={() => void onCopy()}><Icon name="copy" size={19} />Copy referral link</button><div style={styles.statsGrid}><Stat label="Total referrals" value={referral?.total_referrals ?? 0} /><Stat label="Qualified" value={referral?.qualified_referrals ?? 0} /><Stat label="Reward cycles" value={referral?.reward_cycles ?? 0} /></div></ModalShell>;
}

function RewardsModal({ referral, onClose }: { referral: Referral | null; onClose: () => void }) {
  return <ModalShell title="Rewards" onClose={onClose}><div style={styles.rewardHero}>${formatMoney(Number(referral?.total_rewards ?? 0))}</div><div style={styles.modalHint}>Total rewards from the existing referrals record.</div><div style={styles.statsGrid}><Stat label="Eligible amount" value={`$${formatMoney(Number(referral?.reward_eligible_amount ?? 0))}`} /><Stat label="Qualified referrals" value={referral?.qualified_referrals ?? 0} /><Stat label="Reward cycles" value={referral?.reward_cycles ?? 0} /></div></ModalShell>;
}

function GiveawayModal({ giveaways, onClose }: { giveaways: Giveaway[]; onClose: () => void }) {
  return <ModalShell title="Giveaway" onClose={onClose}>{giveaways.map((g) => <div key={g.id} style={styles.giveawayCard}><div style={styles.notificationMeta}><span style={styles.pill}>{g.status || "ACTIVE"}</span><span>{g.ends_at ? `Ends ${new Date(g.ends_at).toLocaleDateString()}` : ""}</span></div><h3>{g.title || "Giveaway"}</h3><p>{g.description}</p><b>Prize: ${formatMoney(Number(g.prize_amount ?? 0))}</b>{g.winner_id && <div style={styles.subtle}>Winner selected</div>}</div>)}{!giveaways.length && <Empty text="No giveaways are currently listed." />}</ModalShell>;
}

function MenuModal({ profile, onClose, onLogout }: { profile: Profile | null; onClose: () => void; onLogout: () => Promise<void> }) {
  return <ModalShell title="Menu" onClose={onClose}><div style={styles.profileMenu}><Avatar url={profile?.profile_picture_url} text={profile?.nickname || "CEO"} /><div><b>{profile?.nickname || "CEO"}</b><small>{profile?.email || ""}</small></div></div><button style={styles.menuItem} onClick={() => onClose()}>Settings <Icon name="arrow" size={18} /></button><button style={styles.menuItem} onClick={() => onClose()}>Security <Icon name="shield" size={18} /></button><button style={{ ...styles.menuItem, color: "#ff6574" }} onClick={() => void onLogout()}>Sign out <Icon name="logout" size={18} /></button></ModalShell>;
}

function CreatePostModal({ onClose, onCreate }: { onClose: () => void; onCreate: (content: string, imageUrl: string) => Promise<void> }) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  return <ModalShell title="Create post" onClose={onClose}><p style={styles.modalHint}>Posts are image + caption only. The live schema has image_url but no dedicated social-feed storage bucket, so this build accepts an image URL and does not create a bucket.</p><label style={styles.label}>Image URL<input style={styles.input} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></label><label style={styles.label}>Caption<textarea style={styles.textarea} maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a caption…" /></label><button style={styles.primaryButtonFull} onClick={() => void onCreate(content, imageUrl)}>Publish</button></ModalShell>;
}

function CreateAnnouncementModal({ defaultType, onClose, onCreate }: { defaultType: string; onClose: () => void; onCreate: (title: string, content: string, type: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState(defaultType);
  return <ModalShell title="Admin post" onClose={onClose}><p style={styles.modalHint}>Only an administrator can publish to platform_announcements. This uses the existing author_role/type/is_active columns; no new schema is created.</p><label style={styles.label}>Type<input style={styles.input} value={type} onChange={(e) => setType(e.target.value)} /></label><label style={styles.label}>Title<input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} /></label><label style={styles.label}>Content<textarea style={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} /></label><button style={styles.primaryButtonFull} onClick={() => void onCreate(title, content, type)}>Publish</button></ModalShell>;
}

function CommentsModal({ comments, onClose, onAdd }: { comments: Comment[]; onClose: () => void; onAdd: (content: string) => Promise<void> }) {
  const [text, setText] = useState("");
  return <ModalShell title="Comments" onClose={onClose}><div style={styles.comments}>{comments.map((c) => <div key={c.id} style={styles.commentRow}><Avatar url={c.profile?.profile_picture_url} text={c.profile?.nickname || "CE"} /><div><b>{c.profile?.nickname || "CEO Member"}</b><div>{c.content}</div><small>{timeAgo(c.created_at)} ago</small></div></div>)}{!comments.length && <Empty text="No comments yet." />}</div><div style={styles.otpRow}><input style={{ ...styles.input, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment" /><button style={styles.primaryButton} onClick={() => { void onAdd(text); setText(""); }}>Post</button></div></ModalShell>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) { return <div style={styles.stat}><span>{label}</span><b>{value}</b></div>; }

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: BG, color: "#fff", paddingBottom: 82, fontFamily: "Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", overflowX: "hidden" },
  header: { position: "sticky", top: 0, zIndex: 20, minHeight: 68, padding: "9px 12px", display: "grid", gridTemplateColumns: "auto minmax(70px,1fr) auto", gap: 8, alignItems: "center", background: "rgba(5,5,5,.97)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${BORDER}` },
  brand: { display: "flex", alignItems: "center", gap: 9, minWidth: 0 },
  logo: { width: 34, height: 34, objectFit: "contain", borderRadius: 10 },
  brandName: { maxWidth: 48, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 800, fontSize: 14 },
  topSearch: { height: 40, minWidth: 0, display: "flex", alignItems: "center", gap: 7, padding: "0 10px", border: `1px solid ${BORDER}`, borderRadius: 13, background: "#0b0b0b", color: "#777" },
  topSearchInput: { flex: 1, minWidth: 0, width: "100%", border: 0, outline: 0, background: "transparent", color: "#fff", fontSize: 14, padding: 0 },
  headerActions: { display: "flex", gap: 5 },
  iconSquare: { position: "relative", width: 38, height: 38, border: `1px solid #211b0d`, borderRadius: 13, background: "#090909", color: GOLD_LIGHT, display: "grid", placeItems: "center", cursor: "pointer" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: "#eab308", color: "#090909", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" },
  iconButton: { border: 0, background: "transparent", color: "#aaa", display: "grid", placeItems: "center", cursor: "pointer" },
  errorBar: { margin: "12px 16px 0", padding: 12, border: "1px solid #4c2025", borderRadius: 12, background: "#1d0c0e", color: "#ff9aa3", fontSize: 13 },
  retry: { float: "right", border: 0, background: "transparent", color: GOLD_LIGHT, cursor: "pointer" },
  content: { width: "min(760px,100%)", margin: "0 auto", padding: "12px 12px 20px" },
  balanceCard: { minHeight: 228, borderRadius: 22, border: `1px solid #1f1a0e`, background: "radial-gradient(circle at 88% 22%,#35270e 0,#15120b 22%,#0e0e0e 52%,#0a0a0a 100%)", padding: "20px 18px", display: "flex", justifyContent: "space-between", overflow: "hidden", position: "relative" },
  balanceInfo: { position: "relative", zIndex: 2, maxWidth: 390 },
  muted: { color: "#a5a5a5", fontSize: 15, marginBottom: 4 },
  balanceLine: { display: "flex", alignItems: "center", gap: 9 },
  "balanceLine strong": { fontSize: 34, letterSpacing: -1.1 },
  eyeButton: { border: 0, background: "transparent", color: "#aaa", cursor: "pointer", padding: 4 },
  subtle: { color: "#777", fontSize: 12, marginTop: 7 },
  balanceButtons: { display: "flex", gap: 9, marginTop: 20, flexWrap: "wrap" },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: 0, borderRadius: 11, padding: "10px 16px", background: `linear-gradient(135deg,${GOLD},#d98e00)`, color: "#090909", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: `1px solid #8b6416`, borderRadius: 11, padding: "9px 16px", background: "transparent", color: GOLD_LIGHT, fontWeight: 700, cursor: "pointer" },
  walletVisual: { width: 130, minWidth: 105, position: "relative", display: "grid", placeItems: "center", alignSelf: "center" },
  walletShape: { width: 112, height: 78, borderRadius: "12px 12px 18px 18px", background: "linear-gradient(145deg,#171717,#030303)", border: "1px solid #6d4c10", transform: "rotate(-6deg)", boxShadow: "0 14px 25px rgba(0,0,0,.55),inset 0 0 0 1px #18110a", display: "grid", placeItems: "center" },
  walletLogo: { width: 42, height: 42, objectFit: "contain", display: "block" },
  quickGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "18px 4px 20px" },
  quickAction: { border: 0, background: "transparent", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" },
  quickIcon: { width: 58, height: 58, borderRadius: 16, background: "#0c0c0c", border: "1px solid #151515", color: GOLD_LIGHT, display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgba(0,0,0,.28)" },
  marketSection: { marginTop: 2 },
  tabsRow: { display: "flex", overflowX: "auto", gap: 4, borderBottom: "1px solid #242424", scrollbarWidth: "none" },
  tab: { whiteSpace: "nowrap", border: 0, background: "transparent", color: "#888", padding: "11px 9px", display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer", fontWeight: 650, fontSize: 12 },
  tabActive: { color: GOLD_LIGHT, borderBottom: `2px solid ${GOLD}` },
  marketHeader: { display: "grid", gridTemplateColumns: "28px 1.45fr 1fr .75fr .62fr", gap: 6, padding: "9px 6px 6px", color: "#666", fontSize: 10 },
  marketRow: { minHeight: 54, display: "grid", gridTemplateColumns: "28px 1.45fr 1fr .75fr .62fr", alignItems: "center", gap: 5, padding: "7px 6px", borderRadius: 10, background: "#0d0d0d", border: "1px solid #151515", marginBottom: 5 },
  starButton: { border: 0, background: "transparent", color: "#555", padding: 0, cursor: "pointer", borderRadius: 7, width: 28, height: 28, display: "grid", placeItems: "center" },
  starButtonActive: { color: GOLD_LIGHT, background: "#1b1508" },
  pair: { display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" },
  "pair span": { color: "#666", fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" },
  price: { fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" },
  change: { fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" },
  tradeButton: { border: `1px solid #785716`, borderRadius: 9, background: "transparent", color: GOLD_LIGHT, padding: "7px 6px", cursor: "pointer", fontWeight: 700, fontSize: 11 },
  viewAll: { width: "100%", border: 0, background: "transparent", color: GOLD_LIGHT, padding: "14px 0 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontWeight: 700 },
  feedSection: { borderTop: "1px solid #171717", paddingTop: 22 },
  sectionTitle: { display: "flex", alignItems: "center", gap: 9, fontWeight: 800, fontSize: 18, marginBottom: 15 },
  goldBar: { width: 5, height: 30, borderRadius: 4, background: GOLD },
  feedTabs: { display: "flex", gap: 5, overflowX: "auto", borderBottom: "1px solid #272727" },
  feedTab: { whiteSpace: "nowrap", border: 0, background: "transparent", color: "#777", padding: "12px 12px", cursor: "pointer", fontWeight: 600 },
  feedTabActive: { color: GOLD_LIGHT, borderBottom: `2px solid ${GOLD}` },
  createPostButton: { margin: "14px 0", border: `1px solid #7c5a16`, borderRadius: 12, background: "#0e0e0e", color: GOLD_LIGHT, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" },
  postCard: { background: "#101010", borderRadius: 17, marginTop: 12, padding: "14px 14px 11px", border: "1px solid #171717" },
  postHead: { display: "flex", alignItems: "center", gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: "50%", objectFit: "cover", border: `1px solid #60470f` },
  avatarFallback: { width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: "#1a1408", color: GOLD_LIGHT, border: `1px solid #60470f`, fontWeight: 800, fontSize: 12 },
  postTime: { color: "#777", fontSize: 11, marginTop: 3 },
  moreButton: { marginLeft: "auto", border: 0, background: "transparent", color: "#777", fontSize: 17, cursor: "pointer" },
  postText: { padding: "13px 2px 12px", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  postImage: { width: "100%", maxHeight: 520, objectFit: "cover", borderRadius: 13, display: "block", marginBottom: 10 },
  postActions: { display: "flex", alignItems: "center", gap: 20, paddingTop: 4 },
  postAction: { border: 0, background: "transparent", color: "#aaa", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 5 },
  announcementCard: { marginTop: 12, background: "#101010", border: "1px solid #191919", borderRadius: 16, padding: 16 },
  announcementMeta: { display: "flex", gap: 8, color: "#777", fontSize: 11, alignItems: "center" },
  pill: { display: "inline-flex", alignItems: "center", border: "1px solid #5f4610", color: GOLD_LIGHT, borderRadius: 99, padding: "4px 8px", fontSize: 10 },
  announcementTitle: { margin: "10px 0 6px", fontSize: 17 },
  announcementBody: { margin: 0, color: "#bbb", lineHeight: 1.5, whiteSpace: "pre-wrap" },
  bottomNav: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, height: 78, display: "grid", gridTemplateColumns: "repeat(5,1fr)", background: "rgba(9,9,9,.98)", borderTop: "1px solid #202020", paddingBottom: "env(safe-area-inset-bottom)" },
  navItem: { border: 0, background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 10, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.78)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 },
  modal: { width: "min(620px,100%)", maxHeight: "90vh", overflowY: "auto", background: "#0b0b0b", border: "1px solid #2a2110", borderRadius: "20px 20px 0 0", padding: "16px 14px calc(18px + env(safe-area-inset-bottom))", boxShadow: "0 -20px 60px rgba(0,0,0,.6)" },
  modalWide: { width: "min(880px,100%)" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  "modalHeader h2": { margin: 0, fontSize: 19 },
  modalHint: { color: "#8c8c8c", fontSize: 13, lineHeight: 1.5 },
  flowBack: { border: 0, background: "transparent", color: "#aaa", display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 0 10px", cursor: "pointer", fontWeight: 700 },
  methodLarge: { width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", border: "1px solid #242424", borderRadius: 14, background: "#101010", color: "#fff", padding: "14px 12px", marginBottom: 9, cursor: "pointer" },
  methodLargeDisabled: { width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", border: "1px solid #202020", borderRadius: 14, background: "#0e0e0e", color: "#777", padding: "14px 12px", marginBottom: 9, cursor: "not-allowed" },
  methodLargeIcon: { width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "#181818", color: GOLD_LIGHT, flex: "0 0 auto" },
  methodLargeText: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  "methodLargeText b": { fontSize: 15, color: "#fff" },
  "methodLargeText small": { color: "#777", lineHeight: 1.35, fontSize: 11 },
  comingSoon: { color: "#777", fontSize: 10, fontWeight: 800, border: "1px solid #2a2a2a", borderRadius: 999, padding: "4px 7px" },
  depositSearch: { display: "flex", alignItems: "center", gap: 8, minHeight: 48, borderRadius: 16, background: "#17171b", padding: "0 13px", color: "#666", marginBottom: 12 },
  depositSearchInput: { flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "#fff", fontSize: 15 },
  recentBlock: { marginBottom: 12 },
  recentTitle: { color: "#777", fontSize: 11, marginBottom: 7 },
  chipRow: { display: "flex", gap: 7, flexWrap: "wrap" },
  assetChip: { border: 0, borderRadius: 999, background: "#1b1b21", color: "#eee", padding: "8px 14px", cursor: "pointer", fontWeight: 700 },
  assetList: { display: "flex", flexDirection: "column", gap: 2 },
  assetRow: { width: "100%", display: "flex", alignItems: "center", gap: 11, border: 0, borderBottom: "1px solid #171717", background: "transparent", color: "#fff", padding: "12px 2px", textAlign: "left", cursor: "pointer" },
  assetIcon: { width: 40, height: 40, borderRadius: "50%", background: "#1c1c22", border: "1px solid #2a2a2a", display: "grid", placeItems: "center", color: "#eee", fontWeight: 900, flex: "0 0 auto" },
  assetInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 },
  "assetInfo b": { fontSize: 15 },
  "assetInfo small": { color: "#666", fontSize: 11 },
  assetBalance: { color: "#ddd", fontWeight: 700, fontSize: 13 },
  networkNotice: { display: "flex", gap: 9, alignItems: "flex-start", background: "#17181c", borderRadius: 12, padding: 12, color: "#bbb", fontSize: 11, lineHeight: 1.45, marginBottom: 12 },
  chainList: { display: "flex", flexDirection: "column", gap: 2 },
  chainRow: { width: "100%", display: "flex", alignItems: "center", gap: 11, border: 0, borderBottom: "1px solid #171717", background: "transparent", color: "#fff", padding: "13px 2px", textAlign: "left", cursor: "pointer" },
  chainIcon: { width: 40, height: 40, borderRadius: "50%", background: "#181818", border: "1px solid #2b2b2b", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, flex: "0 0 auto" },
  chainInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  "chainInfo b": { fontSize: 15 },
  "chainInfo small": { color: "#666", fontSize: 11 },
  depositNetworkPicker: { display: "flex", justifyContent: "center", alignItems: "center", gap: 6, margin: "2px 0 12px", color: "#666", fontSize: 13 },
  depositNetworkPickerButton: { border: 0, background: "transparent", color: "#ddd", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: 700 },
  depositQrWrap: { display: "flex", justifyContent: "center", padding: "4px 0 14px" },
  depositQrLarge: { width: 220, height: 220, background: "#fff", borderRadius: 10, padding: 6, display: "block", objectFit: "contain" },
  addressCard: { background: "#151519", borderRadius: 15, padding: 13, border: "1px solid #232329" },
  addressLabel: { color: "#777", fontSize: 12, marginBottom: 7 },
  addressValue: { color: "#fff", fontSize: 13, lineHeight: 1.45, overflowWrap: "anywhere", fontWeight: 700 },
  depositDetails: { marginTop: 12, padding: "0 2px", color: "#777", fontSize: 12 },
  depositActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 },
  balanceHero: { padding: "12px 13px", borderRadius: 14, background: "#111113", border: "1px solid #202024", marginBottom: 12 },
  cleanField: { display: "flex", flexDirection: "column", gap: 7, margin: "13px 0", color: "#999", fontSize: 12 },
  cleanInput: { width: "100%", minHeight: 50, border: 0, borderRadius: 12, outline: 0, background: "#202126", color: "#fff", padding: "12px 14px", colorScheme: "dark" },
  amountInputWrap: { position: "relative" },
  "amountInputWrap .cleanInput": { paddingRight: 68 },
  "amountInputWrap b": { position: "absolute", right: 13, top: 15, color: "#fff", pointerEvents: "none" },
  minimumLine: { color: "#777", fontSize: 11, margin: "-3px 2px 9px" },
  otpPage: { textAlign: "center", padding: "20px 6px 6px" },
  otpIcon: { width: 60, height: 60, margin: "0 auto 10px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#17130a", color: GOLD_LIGHT, border: "1px solid #5a4313" },
  "otpPage h3": { margin: "6px 0", fontSize: 19, color: "#fff" },
  "otpPage p": { color: "#777", lineHeight: 1.5, fontSize: 12, margin: "0 auto 16px", maxWidth: 390 },
  otpInputLarge: { width: "100%", maxWidth: 310, display: "block", margin: "0 auto 12px", minHeight: 56, border: "1px solid #3a321e", borderRadius: 14, background: "#111", color: "#fff", textAlign: "center", letterSpacing: 8, fontSize: 24, outline: 0 },
  transactionHero: { textAlign: "center", padding: "8px 0 14px" },
  successMark: { width: 52, height: 52, margin: "0 auto 8px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#13251e", color: "#39d98a", fontSize: 28, fontWeight: 900 },
  "transactionHero h3": { margin: "7px 0", fontSize: 18 },
  "transactionHero span": { color: "#777", fontSize: 10, overflowWrap: "anywhere" },
  transactionQr: { display: "flex", justifyContent: "center", marginBottom: 12 },
  transactionCard: { background: "#111", borderRadius: 14, border: "1px solid #222", padding: "4px 13px" },
  transactionCardRow: { display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid #1e1e1e", fontSize: 12 },
  transactionCardLabel: { color: "#777" },
  transactionCardValue: { color: "#eee", textAlign: "right", maxWidth: "68%", overflowWrap: "anywhere" },

  label: { display: "flex", flexDirection: "column", gap: 7, margin: "13px 0", color: "#aaa", fontSize: 12 },
  input: { width: "100%", minHeight: 46, border: "1px solid #302711", borderRadius: 12, outline: 0, background: "#101010", color: "#fff", padding: "10px 12px", colorScheme: "dark" },
  textarea: { width: "100%", minHeight: 110, resize: "vertical", border: "1px solid #302711", borderRadius: 12, outline: 0, background: "#101010", color: "#fff", padding: "10px 12px", lineHeight: 1.5 },
  methodGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginBottom: 14 },
  methodCard: { minHeight: 78, border: "1px solid #242424", borderRadius: 12, background: "#101010", color: "#aaa", padding: "9px 7px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", textAlign: "center" },
  methodCardActive: { borderColor: "#8b6416", color: GOLD_LIGHT, background: "#151107" },
  "methodCard span": { fontSize: 11, fontWeight: 800 },
  "methodCard small": { fontSize: 9, color: "#666", lineHeight: 1.2 },
  emptyPanel: { border: "1px solid #252525", borderRadius: 13, background: "#101010", padding: 15, color: "#aaa", fontSize: 12, lineHeight: 1.5 },
  depositResult: { marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #4d3810", background: "#11100b", textAlign: "center" },
  resultTitle: { color: "#999", fontSize: 11, marginBottom: 3 },
  resultAmount: { color: GOLD_LIGHT, fontSize: 20, display: "block", marginBottom: 10 },
  qr: { width: 150, height: 150, background: "#fff", borderRadius: 8, padding: 6, display: "block", margin: "0 auto 10px" },
  addressBox: { padding: "10px 11px", borderRadius: 10, border: "1px solid #2b2518", background: "#090909", color: "#ddd", fontSize: 11, lineHeight: 1.45, overflowWrap: "anywhere", textAlign: "left" },
  primaryButtonFull: { width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: 0, borderRadius: 12, padding: "13px 16px", background: `linear-gradient(135deg,${GOLD},#d98e00)`, color: "#090909", fontWeight: 800, cursor: "pointer", marginTop: 6 },
  secondaryButtonFull: { width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: `1px solid #725316`, borderRadius: 12, padding: "11px 14px", background: "transparent", color: GOLD_LIGHT, fontWeight: 700, cursor: "pointer", marginTop: 7 },
  divider: { height: 1, background: "#242424", margin: "18px 0" },
  smallTitle: { fontSize: 14, color: "#aaa", margin: "0 0 8px" },
  listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1c1c1c", fontSize: 13 },
  status: { color: GOLD_LIGHT, fontSize: 11 },
  modalTabs: { display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid #222", marginBottom: 10 },
  modalTab: { position: "relative", border: 0, background: "transparent", color: "#777", padding: "11px 9px", cursor: "pointer", whiteSpace: "nowrap" },
  modalTabActive: { color: GOLD_LIGHT, borderBottom: `2px solid ${GOLD}` },
  tabBadge: { marginLeft: 5, display: "inline-grid", placeItems: "center", minWidth: 16, height: 16, padding: "0 4px", borderRadius: 99, background: GOLD, color: "#090909", fontSize: 9, fontWeight: 900 },
  notificationCard: { width: "100%", textAlign: "left", border: "1px solid #1d1d1d", background: "#111", color: "#ddd", borderRadius: 13, padding: 13, marginBottom: 8, cursor: "pointer" },
  notificationTitle: { display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#fff", marginBottom: 5 },
  dot: { width: 7, height: 7, borderRadius: "50%", background: GOLD, display: "inline-block" },
  "notificationCard small": { color: "#666", display: "block", marginTop: 7 },
  warningItem: { display: "flex", gap: 10, padding: 12, borderRadius: 12, border: "1px solid #4d3510", background: "#181207", color: "#e8d59c", marginBottom: 8 },
  loginItem: { display: "flex", gap: 10, padding: 12, borderRadius: 12, background: "#101010", marginBottom: 7, color: "#ccc" },
  "loginItem small": { color: "#666" },
  supportGrid: { display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 12, minHeight: 430 },
  ticketList: { borderRight: "1px solid #222", paddingRight: 10 },
  ticketItem: { width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: 4, border: "1px solid transparent", background: "transparent", color: "#ccc", padding: 10, borderRadius: 11, cursor: "pointer" },
  ticketItemActive: { background: "#17130a", borderColor: "#4e3a12", color: "#fff" },
  "ticketItem span": { color: GOLD_LIGHT, fontSize: 10 },
  "ticketItem small": { color: "#666" },
  ticketThread: { minWidth: 0 },
  threadHeader: { display: "flex", justifyContent: "space-between", borderBottom: "1px solid #222", paddingBottom: 10, marginBottom: 10 },
  messages: { minHeight: 250, maxHeight: 420, overflowY: "auto" },
  messageBubble: { maxWidth: "88%", background: "#151515", border: "1px solid #202020", borderRadius: 13, padding: 10, marginBottom: 8, lineHeight: 1.45 },
  "messageBubble small": { display: "block", color: "#666", marginTop: 6, fontSize: 10 },
  attachments: { display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" },
  attachment: { color: GOLD_LIGHT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  history: { display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" },
  otpRow: { display: "flex", gap: 8, alignItems: "center", marginTop: 12 },
  warningBox: { display: "flex", gap: 9, alignItems: "flex-start", border: "1px solid #594314", background: "#171106", color: "#d7c58e", borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 1.45, margin: "10px 0" },
  infoBox: { display: "flex", gap: 8, alignItems: "flex-start", border: "1px solid #3c321b", background: "#121108", color: "#c5b98d", borderRadius: 11, padding: 10, fontSize: 11, lineHeight: 1.4, margin: "8px 0 12px" },
  balanceMini: { color: "#8c8c8c", fontSize: 12, marginTop: -4 },
  feeBox: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: 12, border: "1px solid #272727", borderRadius: 12, background: "#101010", margin: "10px 0", fontSize: 13 },
  referralCode: { width: "fit-content", padding: "10px 14px", borderRadius: 12, background: "#181207", border: "1px solid #594314", color: GOLD_LIGHT, fontWeight: 900, letterSpacing: 1 },
  linkBox: { margin: "12px 0", padding: 12, borderRadius: 11, background: "#101010", border: "1px solid #222", color: "#aaa", overflowWrap: "anywhere", fontSize: 12 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 },
  stat: { padding: 12, borderRadius: 12, background: "#111", border: "1px solid #1e1e1e", display: "flex", flexDirection: "column", gap: 5 },
  "stat span": { color: "#777", fontSize: 11 },
  rewardHero: { fontSize: 38, fontWeight: 900, color: GOLD_LIGHT },
  giveawayCard: { padding: 14, borderRadius: 14, background: "#111", border: "1px solid #242424", marginBottom: 9 },
  notificationMeta: { display: "flex", alignItems: "center", gap: 7, color: "#777", fontSize: 11 },
  profileMenu: { display: "flex", alignItems: "center", gap: 11, padding: 12, borderRadius: 13, background: "#111", marginBottom: 9 },
  "profileMenu small": { display: "block", color: "#777", marginTop: 4 },
  menuItem: { width: "100%", border: 0, borderBottom: "1px solid #202020", background: "transparent", color: "#ddd", padding: "15px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" },
  comments: { maxHeight: 450, overflowY: "auto" },
  commentRow: { display: "flex", gap: 9, padding: "10px 0", borderBottom: "1px solid #1e1e1e", lineHeight: 1.4 },
  "commentRow small": { display: "block", color: "#666", marginTop: 4 },
  empty: { padding: "30px 10px", color: "#666", textAlign: "center", fontSize: 13 },
  toast: { position: "fixed", left: "50%", bottom: 94, transform: "translateX(-50%)", zIndex: 100, width: "min(92%,520px)", background: "#171717", border: "1px solid #5e4511", color: "#eee", borderRadius: 12, padding: "12px 14px", boxShadow: "0 12px 30px rgba(0,0,0,.5)", fontSize: 13 },
  center: { minHeight: "100vh", background: BG, color: "#aaa", display: "grid", placeItems: "center", gap: 10 },
  spinner: { width: 28, height: 28, borderRadius: "50%", border: "3px solid #333", borderTopColor: GOLD, animation: "spin 1s linear infinite" },
};

if (typeof document !== "undefined") {
  const id = "ceo-home-inline-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      html, body, #root { margin: 0; min-height: 100%; background: #050505; }
      *, *::before, *::after { box-sizing: border-box; }
      button, input, textarea, select { font: inherit; -webkit-tap-highlight-color: transparent; }
      input, textarea, select { color-scheme: dark; }
      input::placeholder, textarea::placeholder { color: #68686d; opacity: 1; }
      select option { background: #101010; color: #fff; }
      button:disabled { opacity: .5; cursor: not-allowed; }
      @media (max-width: 420px) {
        body { overflow-x: hidden; }
      }
      @media (max-width: 380px) {
        header { }
      }
    `;
    document.head.appendChild(style);
  }
}

export { styles };
