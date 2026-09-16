/**
 * CEO Exchange — Social Personal Center / Profile
 * Uses get_public_profile / follow RPCs from Cloud. Not Settings.
 * Portfolio tab: real wallets + market_tickers for distribution & weighted PnL.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const BG = "#050505";
const CARD = "#121212";
const BORDER = "#2a2a2a";
const GREEN = "#16c784";
const RED = "#ea3943";

type Profile = {
  id: string;
  nickname: string | null;
  profile_picture_url: string | null;
  uid?: string | null;
  bio?: string | null;
  created_at?: string | null;
};

type Post = {
  id: string;
  user_id: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string | null;
  likes_count?: number | null;
  shares_count?: number | null;
};

type ListUser = {
  user_id: string;
  nickname: string | null;
  profile_picture_url: string | null;
  uid?: string | null;
  bio?: string | null;
  followed_at?: string | null;
  is_followed_by_me?: boolean | null;
};

type WalletRow = {
  asset: string;
  balance: number;
  locked_balance: number;
  escrow_balance?: number;
  wallet_type?: string;
  account_type?: string | null;
};

type TickerRow = {
  symbol: string;
  last_price: number | null;
  change_24h: number | null;
};

type PositionSlice = {
  asset: string;
  value: number;
  pct: number;
  change24h: number | null;
};

type Props = {
  profileUserId: string;
  currentUserId: string;
  onClose: () => void;
  notify?: (m: string) => void;
};

type Period = "7D" | "1M" | "3M" | "6M";

function parseBackendTs(value: string): number {
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s.replace(" ", "T") + "Z").getTime();
  }
  return new Date(s).getTime();
}

function timeAgo(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return "";
  const t = parseBackendTs(value);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, nowMs - t);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(t).toLocaleDateString();
}

function yearsActive(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const t = parseBackendTs(createdAt);
  if (!Number.isFinite(t)) return null;
  const years = (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
  if (years < 0.1) return null;
  return `${years.toFixed(1)} Years`;
}

const STABLE = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD", "USD"]);

function priceOf(asset: string, tickers: Map<string, TickerRow>): { price: number; change: number | null } {
  const a = asset.toUpperCase();
  if (STABLE.has(a)) return { price: 1, change: 0 };
  // Prefer ASSETUSDT, then ASSET/USDT, then any symbol containing the asset
  const candidates = [`${a}USDT`, `${a}/USDT`, `${a}_USDT`, a];
  for (const s of candidates) {
    const t = tickers.get(s) || tickers.get(s.toLowerCase());
    if (t?.last_price != null && Number.isFinite(t.last_price) && t.last_price > 0) {
      return { price: t.last_price, change: t.change_24h ?? null };
    }
  }
  // Fallback: scan map for symbol that starts with asset
  for (const [sym, t] of tickers) {
    if (sym.toUpperCase().startsWith(a) && t.last_price != null && t.last_price > 0) {
      return { price: t.last_price, change: t.change_24h ?? null };
    }
  }
  return { price: 0, change: null };
}

/** Simple SVG area chart for period PnL (no external chart lib). */
function PnLChart({
  pct,
  positive,
  width = 320,
  height = 120,
}: {
  pct: number;
  positive: boolean;
  width?: number;
  height?: number;
}) {
  // Generate a gentle curve that ends at `pct`. Purely visual of the reported %.
  const points = 24;
  const mid = height * 0.55;
  const amp = Math.min(height * 0.35, Math.abs(pct) * 2.2 + 8);
  const path: string[] = [];
  const area: string[] = [];
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * width;
    const t = i / points;
    // mild oscillation + linear trend toward final pct
    const wave = Math.sin(t * Math.PI * 2.2) * (1 - t * 0.55) * amp * 0.45;
    const trend = -((pct >= 0 ? 1 : -1) * amp * 0.55) * t;
    const y = mid + wave + trend;
    path.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    area.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const stroke = positive ? GREEN : RED;
  const fillId = positive ? "pnlFillG" : "pnlFillR";
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", height: 120 }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={`${path.join(" ")} L${width},${height} L0,${height} Z`}
        fill={`url(#${fillId})`}
      />
      <path d={path.join(" ")} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Donut for position distribution. */
function Donut({ slices }: { slices: PositionSlice[] }) {
  const size = 140;
  const r = 52;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const colors = [GOLD, GREEN, "#3b82f6", "#a855f7", "#f97316", "#14b8a6", "#e11d48", "#64748b"];
  if (slices.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f1f1f" strokeWidth={stroke} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={stroke} />
      {slices.map((s, i) => {
        const len = (s.pct / 100) * circ;
        const el = (
          <circle
            key={s.asset}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

export default function SocialProfile({ profileUserId, currentUserId, onClose, notify }: Props) {
  const isSelf = profileUserId === currentUserId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [likesTotal, setLikesTotal] = useState(0);
  const [sharesTotal, setSharesTotal] = useState(0);
  const [iFollow, setIFollow] = useState(false);
  const [tab, setTab] = useState<"posts" | "portfolio" | "followers" | "following">("posts");
  const [list, setList] = useState<ListUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  // Portfolio state
  const [period, setPeriod] = useState<Period>("7D");
  const [positions, setPositions] = useState<PositionSlice[]>([]);
  const [pnlPct, setPnlPct] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioPrivate, setPortfolioPrivate] = useState(false);

  const load = useCallback(async () => {
    const profilePromise = isSelf
      ? supabase
          .from("profiles")
          .select("id,nickname,profile_picture_url,bio,uid,created_at")
          .eq("id", profileUserId)
          .maybeSingle()
          .then((r) => ({ data: r.data as Profile | null, error: r.error }))
      : supabase.rpc("get_public_profile", { p_id: profileUserId }).then((r) => ({
          data: (Array.isArray(r.data) ? r.data[0] : r.data) as Profile | null,
          error: r.error,
        }));

    const [{ data: p }, { data: postraws }, countsRes, followingRes] = await Promise.all([
      profilePromise,
      supabase
        .from("posts")
        .select("id,user_id,content,image_url,created_at,likes_count,shares_count")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_follow_counts", { p_user_id: profileUserId }),
      !isSelf
        ? supabase.rpc("is_following", { p_target_user_id: profileUserId })
        : Promise.resolve({ data: false, error: null }),
    ]);

    setProfile(p ?? null);
    setBioDraft((p as any)?.bio || "");
    const pr = (postraws ?? []) as Post[];
    setPosts(pr);
    setLikesTotal(pr.reduce((a, x) => a + (x.likes_count || 0), 0));
    setSharesTotal(pr.reduce((a, x) => a + (x.shares_count || 0), 0));

    const counts = Array.isArray(countsRes.data) ? countsRes.data[0] : countsRes.data;
    setFollowers(Number(counts?.followers_count ?? 0));
    setFollowing(Number(counts?.following_count ?? 0));
    setIFollow(Boolean(followingRes.data));
  }, [profileUserId, currentUserId, isSelf]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    setPortfolioPrivate(false);
    try {
      const [{ data: wallets, error: wErr }, { data: tickers, error: tErr }] = await Promise.all([
        supabase
          .from("wallets")
          .select("asset,balance,locked_balance,escrow_balance,wallet_type,account_type")
          .eq("user_id", profileUserId),
        supabase.from("market_tickers").select("symbol,last_price,change_24h"),
      ]);

      if (wErr) {
        // RLS often blocks reading another user's wallets
        if (!isSelf) {
          setPortfolioPrivate(true);
          setPositions([]);
          setPnlPct(0);
          return;
        }
        throw wErr;
      }
      if (tErr) throw tErr;

      const tickerMap = new Map<string, TickerRow>();
      for (const t of (tickers ?? []) as TickerRow[]) {
        if (t.symbol) tickerMap.set(t.symbol.toUpperCase(), t);
      }

      // Aggregate by asset across account types (spot + futures + funding)
      const byAsset = new Map<string, number>();
      for (const w of (wallets ?? []) as WalletRow[]) {
        const bal = Number(w.balance || 0) + Number(w.locked_balance || 0) + Number(w.escrow_balance || 0);
        if (!Number.isFinite(bal) || bal <= 0) continue;
        const asset = (w.asset || "").toUpperCase();
        if (!asset) continue;
        byAsset.set(asset, (byAsset.get(asset) || 0) + bal);
      }

      const slices: PositionSlice[] = [];
      let totalValue = 0;
      let weightedChange = 0;
      let weightSum = 0;

      for (const [asset, qty] of byAsset) {
        const { price, change } = priceOf(asset, tickerMap);
        const value = qty * (price > 0 ? price : 0);
        // Still include zero-price assets with tiny residual so they appear if only one holding
        const v = value > 0 ? value : (STABLE.has(asset) ? qty : 0);
        if (v <= 0 && !STABLE.has(asset)) continue;
        const useVal = v > 0 ? v : qty; // stable fallback
        slices.push({ asset, value: useVal, pct: 0, change24h: change });
        totalValue += useVal;
        if (change != null && Number.isFinite(change)) {
          weightedChange += change * useVal;
          weightSum += useVal;
        }
      }

      // Sort by value desc and compute %
      slices.sort((a, b) => b.value - a.value);
      for (const s of slices) {
        s.pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
      }

      // Cap display at top 8 + "Other"
      let display = slices;
      if (slices.length > 8) {
        const top = slices.slice(0, 7);
        const rest = slices.slice(7);
        const otherVal = rest.reduce((a, x) => a + x.value, 0);
        top.push({
          asset: "Other",
          value: otherVal,
          pct: totalValue > 0 ? (otherVal / totalValue) * 100 : 0,
          change24h: null,
        });
        display = top;
      }

      setPositions(display);
      const avg = weightSum > 0 ? weightedChange / weightSum : 0;
      setPnlPct(Number.isFinite(avg) ? avg : 0);
    } catch (e: any) {
      setPortfolioError(e?.message || "Failed to load portfolio");
      setPositions([]);
      setPnlPct(0);
    } finally {
      setPortfolioLoading(false);
    }
  }, [profileUserId, isSelf]);

  useEffect(() => {
    if (tab === "portfolio") void loadPortfolio();
  }, [tab, loadPortfolio]);

  const loadList = async (kind: "followers" | "following") => {
    setTab(kind);
    const rpc = kind === "followers" ? "get_followers" : "get_following";
    const { data, error } = await supabase.rpc(rpc, {
      p_user_id: profileUserId,
      p_limit: 50,
      p_offset: 0,
    });
    if (error) {
      notify?.(error.message);
      setList([]);
      return;
    }
    setList((data as ListUser[]) ?? []);
  };

  const toggleFollow = async () => {
    if (isSelf || busy) return;
    setBusy(true);
    try {
      if (iFollow) {
        const { error } = await supabase.rpc("unfollow_user", { p_target_user_id: profileUserId });
        if (error) throw error;
        setIFollow(false);
        setFollowers((n) => Math.max(0, n - 1));
      } else {
        const { error } = await supabase.rpc("follow_user", { p_target_user_id: profileUserId });
        if (error) throw error;
        setIFollow(true);
        setFollowers((n) => n + 1);
      }
    } catch (e: any) {
      notify?.(e?.message || "Could not update follow.");
    } finally {
      setBusy(false);
    }
  };

  const saveBio = async () => {
    if (!isSelf) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bio: bioDraft.trim() || null })
        .eq("id", currentUserId);
      if (error) throw error;
      setEditingBio(false);
      await load();
      notify?.("Bio updated.");
    } catch (e: any) {
      notify?.(e?.message || "Could not save bio.");
    } finally {
      setBusy(false);
    }
  };

  const name = (profile?.nickname && profile.nickname.trim()) || (profile?.uid ? `User ${profile.uid}` : "User");
  const avatar = profile?.profile_picture_url || null;
  const years = yearsActive(profile?.created_at);
  const pnlPositive = pnlPct >= 0;
  const periodLabel = period; // 7D / 1M / …

  // Date range labels for chart footer (visual only)
  const rangeDates = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (period === "7D") start.setDate(end.getDate() - 7);
    else if (period === "1M") start.setMonth(end.getMonth() - 1);
    else if (period === "3M") start.setMonth(end.getMonth() - 3);
    else start.setMonth(end.getMonth() - 6);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: fmt(start), end: fmt(end) };
  }, [period]);

  return (
    <div style={shell}>
      <header style={header}>
        <button type="button" style={iconBtn} onClick={onClose} aria-label="Back">
          ←
        </button>
        <h1 style={title}>{isSelf ? "My Profile" : name}</h1>
        <span style={{ width: 40 }} />
      </header>

      <div style={body}>
        <div style={hero}>
          {avatar ? (
            <img src={avatar} alt="" style={avatarStyle} />
          ) : (
            <div style={avatarFallback}>{name.slice(0, 2).toUpperCase()}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={nameStyle}>{name}</div>
            {profile?.uid && <div style={uidStyle}>UID {profile.uid}</div>}
            {years && (
              <div style={yearsBadge}>
                <span style={{ opacity: 0.7 }}>♥</span> {years}
              </div>
            )}
            {isSelf ? (
              editingBio ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                    placeholder="Add a bio…"
                    style={bioInput}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button type="button" style={primaryBtn} disabled={busy} onClick={() => void saveBio()}>
                      Save
                    </button>
                    <button type="button" style={ghostBtn} onClick={() => setEditingBio(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" style={bioBtn} onClick={() => setEditingBio(true)}>
                  {bioDraft || "Click here to add a bio…"} ✎
                </button>
              )
            ) : (
              <p style={bioText}>{bioDraft || ""}</p>
            )}
          </div>
          {isSelf ? (
            <button type="button" style={editChip} onClick={() => setEditingBio(true)}>
              Edit
            </button>
          ) : (
            <button type="button" style={iFollow ? ghostBtn : primaryBtn} disabled={busy} onClick={() => void toggleFollow()}>
              {iFollow ? "Following" : "Follow"}
            </button>
          )}
        </div>

        <div style={stats}>
          <button type="button" style={stat} onClick={() => setTab("posts")}>
            <b>{likesTotal}</b>
            <span>Likes</span>
          </button>
          <button type="button" style={stat} onClick={() => setTab("posts")}>
            <b>{sharesTotal}</b>
            <span>Shares</span>
          </button>
          <button type="button" style={stat} onClick={() => void loadList("following")}>
            <b>{following}</b>
            <span>Following</span>
          </button>
          <button type="button" style={stat} onClick={() => void loadList("followers")}>
            <b>{followers}</b>
            <span>Followers</span>
          </button>
        </div>

        <div style={tabs}>
          <button type="button" style={{ ...tabBtn, ...(tab === "posts" ? tabActive : {}) }} onClick={() => setTab("posts")}>
            Posts
          </button>
          <button
            type="button"
            style={{ ...tabBtn, ...(tab === "portfolio" ? tabActive : {}) }}
            onClick={() => setTab("portfolio")}
          >
            Portfolio
          </button>
        </div>

        {(tab === "followers" || tab === "following") && (
          <div>
            {list.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "72px 24px",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: "linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%)",
                    border: `1px solid ${BORDER}`,
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 16,
                    boxShadow: "0 0 40px rgba(245,181,27,0.08)",
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                      stroke="#666"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M14 2v6h6" stroke="#666" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 13h8M8 17h5" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p style={{ color: "#777", fontSize: 14, margin: 0 }}>
                  {tab === "followers" ? "No followers yet" : "Not following anyone yet"}
                </p>
              </div>
            )}
            {list.map((u) => {
              const displayName =
                (u.nickname && u.nickname.trim()) || (u.uid ? `User ${u.uid}` : "User");
              const alreadyFollow = Boolean(u.is_followed_by_me);
              return (
                <div key={u.user_id} style={userRow}>
                  {u.profile_picture_url ? (
                    <img src={u.profile_picture_url} alt="" style={smallAv} />
                  ) : (
                    <div style={smallAvFb}>{(u.nickname || u.uid || "U").slice(0, 1).toUpperCase()}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#eee" }}>{displayName}</div>
                    {(u.bio || u.uid) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#888",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {u.bio || (u.uid ? `UID ${u.uid}` : "")}
                      </div>
                    )}
                  </div>
                  {/* Show Follow / Following chip for other users when viewing a list */}
                  {u.user_id !== currentUserId && (
                    <button
                      type="button"
                      style={alreadyFollow ? listGhostBtn : listFollowBtn}
                      disabled={busy}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setBusy(true);
                        try {
                          if (alreadyFollow) {
                            const { error } = await supabase.rpc("unfollow_user", {
                              p_target_user_id: u.user_id,
                            });
                            if (error) throw error;
                            setList((prev) =>
                              prev.map((x) =>
                                x.user_id === u.user_id ? { ...x, is_followed_by_me: false } : x
                              )
                            );
                            if (tab === "following" && isSelf) {
                              setFollowing((n) => Math.max(0, n - 1));
                            }
                          } else {
                            const { error } = await supabase.rpc("follow_user", {
                              p_target_user_id: u.user_id,
                            });
                            if (error) throw error;
                            setList((prev) =>
                              prev.map((x) =>
                                x.user_id === u.user_id ? { ...x, is_followed_by_me: true } : x
                              )
                            );
                            if (tab === "following" && isSelf) {
                              setFollowing((n) => n + 1);
                            }
                          }
                        } catch (err: any) {
                          notify?.(err?.message || "Could not update follow.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {alreadyFollow ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "portfolio" && (
          <div>
            {portfolioLoading && <p style={empty}>Loading portfolio…</p>}
            {portfolioPrivate && (
              <p style={empty}>This user&apos;s portfolio is private.</p>
            )}
            {portfolioError && !portfolioPrivate && (
              <p style={{ ...empty, color: RED }}>{portfolioError}</p>
            )}
            {!portfolioLoading && !portfolioPrivate && !portfolioError && (
              <>
                {/* Asset report / PnL */}
                <div style={assetCard}>
                  <div style={assetHeader}>
                    <span style={{ color: "#aaa", fontSize: 13, fontWeight: 600 }}>
                      Asset report <span style={{ opacity: 0.5 }}>ⓘ</span>
                    </span>
                  </div>
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>{periodLabel} PnL(%)</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: pnlPositive ? GREEN : RED,
                      letterSpacing: -0.5,
                      marginBottom: 8,
                    }}
                  >
                    {pnlPositive ? "+" : ""}
                    {pnlPct.toFixed(2)}%
                  </div>
                  <div style={{ position: "relative", margin: "0 -4px" }}>
                    <PnLChart pct={pnlPct} positive={pnlPositive} />
                    <div
                      style={{
                        position: "absolute",
                        right: 4,
                        top: 4,
                        background: "#1a1a1a",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "2px 8px",
                        fontSize: 11,
                        color: "#ccc",
                      }}
                    >
                      {rangeDates.end}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "#555", fontSize: 11 }}>
                    <span>{rangeDates.start}</span>
                    <span>{rangeDates.end}</span>
                  </div>
                  <div style={periodRow}>
                    {(["7D", "1M", "3M", "6M"] as Period[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        style={{
                          ...periodBtn,
                          ...(period === p ? periodBtnActive : {}),
                        }}
                        onClick={() => setPeriod(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position distribution */}
                <div style={assetCard}>
                  <div style={assetHeader}>
                    <span style={{ color: "#aaa", fontSize: 13, fontWeight: 600 }}>
                      Position distribution <span style={{ opacity: 0.5 }}>ⓘ</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                    <Donut slices={positions} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {positions.length === 0 ? (
                        <p style={{ color: "#666", fontSize: 13, margin: 0 }}>No positions</p>
                      ) : (
                        positions.map((s, i) => {
                          const colors = [GOLD, GREEN, "#3b82f6", "#a855f7", "#f97316", "#14b8a6", "#e11d48", "#64748b"];
                          return (
                            <div
                              key={s.asset}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 6,
                                fontSize: 13,
                                color: "#ddd",
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: colors[i % colors.length],
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontWeight: 600 }}>{s.asset}</span>
                              <span style={{ color: "#888", marginLeft: "auto" }}>
                                {s.pct < 0.01 && s.pct > 0 ? "< 0.01" : s.pct.toFixed(2)}%
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <p style={{ color: "#555", fontSize: 11, textAlign: "center", marginTop: 12 }}>
                  PnL uses value-weighted 24h market change of current holdings. Historical equity curve requires balance snapshots (not yet available).
                </p>
              </>
            )}
          </div>
        )}

        {tab === "posts" && (
          <div>
            {posts.length === 0 && <p style={empty}>No posts yet.</p>}
            {posts.map((p) => (
              <article key={p.id} style={postCard}>
                <div style={{ color: "#777", fontSize: 12, marginBottom: 6 }}>{timeAgo(p.created_at)}</div>
                {p.content && (
                  <div style={{ color: "#eee", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{p.content}</div>
                )}
                {p.image_url && <img src={p.image_url} alt="" style={postImg} />}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 94,
  background: BG,
  display: "flex",
  flexDirection: "column",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
};
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  paddingTop: "calc(12px + env(safe-area-inset-top))",
  borderBottom: "1px solid #1a1a1a",
};
const title: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 800, color: "#f5f5f5" };
const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: "#eee",
  fontSize: 20,
  cursor: "pointer",
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 14px 40px",
  WebkitOverflowScrolling: "touch",
};
const hero: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 16,
};
const avatarStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  border: `2px solid ${BORDER}`,
};
const avatarFallback: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: CARD,
  color: GOLD,
  fontWeight: 800,
  fontSize: 22,
  flexShrink: 0,
  border: `2px solid ${BORDER}`,
};
const nameStyle: React.CSSProperties = { color: "#f5f5f5", fontWeight: 800, fontSize: 18 };
const uidStyle: React.CSSProperties = { color: "#777", fontSize: 12, marginTop: 2 };
const yearsBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 6,
  padding: "2px 8px",
  borderRadius: 10,
  background: "#1a1a1a",
  border: `1px solid ${BORDER}`,
  color: "#aaa",
  fontSize: 11,
  fontWeight: 600,
};
const bioBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#888",
  fontSize: 13,
  padding: 0,
  marginTop: 6,
  cursor: "pointer",
  textAlign: "left",
};
const bioText: React.CSSProperties = { color: "#999", fontSize: 13, margin: "6px 0 0" };
const bioInput: React.CSSProperties = {
  width: "100%",
  minHeight: 64,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: 10,
  fontFamily: "inherit",
};
const primaryBtn: React.CSSProperties = {
  border: 0,
  borderRadius: 20,
  padding: "8px 14px",
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: "8px 14px",
  background: CARD,
  color: "#ddd",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const editChip: React.CSSProperties = { ...ghostBtn, flexShrink: 0 };
const stats: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  marginBottom: 16,
  padding: 12,
  borderRadius: 16,
  background: CARD,
  border: `1px solid ${BORDER}`,
};
const stat: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#eee",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  cursor: "pointer",
  alignItems: "center",
};
const tabs: React.CSSProperties = { display: "flex", gap: 18, borderBottom: "1px solid #1a1a1a", marginBottom: 14 };
const tabBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#777",
  fontWeight: 700,
  fontSize: 14,
  padding: "10px 0",
  cursor: "pointer",
};
const tabActive: React.CSSProperties = { color: "#fff", boxShadow: "inset 0 -2px 0 #fff" };
const empty: React.CSSProperties = { color: "#666", textAlign: "center", padding: 28, fontSize: 13 };
const postCard: React.CSSProperties = { padding: "14px 0", borderBottom: `1px solid ${BORDER}` };
const postImg: React.CSSProperties = {
  width: "100%",
  maxHeight: 220,
  objectFit: "cover",
  borderRadius: 12,
  marginTop: 10,
};
const userRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: `1px solid ${BORDER}`,
  color: "#eee",
};
const smallAv: React.CSSProperties = { width: 40, height: 40, borderRadius: "50%", objectFit: "cover" };
const smallAvFb: React.CSSProperties = {
  ...smallAv,
  display: "grid",
  placeItems: "center",
  background: CARD,
  color: GOLD,
  fontWeight: 800,
};
const listFollowBtn: React.CSSProperties = {
  border: 0,
  borderRadius: 20,
  padding: "6px 14px",
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};
const listGhostBtn: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: "6px 14px",
  background: CARD,
  color: "#ddd",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};
const assetCard: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 14,
  marginBottom: 14,
};
const assetHeader: React.CSSProperties = { marginBottom: 4 };
const periodRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
};
const periodBtn: React.CSSProperties = {
  flex: 1,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "8px 0",
  background: "transparent",
  color: "#888",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const periodBtnActive: React.CSSProperties = {
  background: GOLD,
  color: "#0a0a0a",
  borderColor: GOLD,
};
