/**
 * CEO Exchange — Notifications Center
 * Drop-in replacement for the old NotificationsModal inside Home.tsx.
 *
 * Usage in Home.tsx:
 *   import NotificationsCenter from "./NotificationsCenter"; // or relative path
 *   ...
 *   {modal === "notifications" && (
 *     <NotificationsCenter
 *       announcements={announcements}
 *       notifications={notifications}
 *       logins={logins}
 *       warnings={adminWarnings}
 *       profile={profile}
 *       onAnnouncementRead={markAnnouncementRead}
 *       onNotificationRead={markNotificationRead}
 *       onRememberWarning={rememberWarningCount}
 *       onOpenSupport={() => { closeModal(); setModal("support"); }}
 *       onClose={closeModal}
 *     />
 *   )}
 *
 * Also apply the unreadSecurity regex fix from Home.tsx_PATCH.md
 * so ban / ban_lifted appear in Platform Alerts.
 */

import React, { useMemo, useState } from "react";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";
const BG = "#050505";
const CARD = "#101010";
const BORDER = "#2a2110";

const MOTION = `
@keyframes ceoNotifIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ceoNotifRow {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ceoNotifPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,181,27,0.35); }
  50%      { box-shadow: 0 0 0 6px rgba(245,181,27,0); }
}
`;

type Announcement = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string | null;
  read?: boolean;
};

type Notification = {
  id: string;
  is_read?: boolean | null;
  type: string | null;
  message: string | null;
  created_at: string | null;
};

type LoginHistory = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

type WarningRow = {
  id: string;
  description: string | null;
  event_type: string | null;
  created_at: string | null;
};

type ProfileLite = {
  warning_count?: number | null;
} | null;

type CategoryId =
  | "overview"
  | "platform_alerts"
  | "account_activity"
  | "platform_updates"
  | "wallet_activity"
  | "rewards"
  | "support";

type Props = {
  announcements: Announcement[];
  notifications: Notification[];
  logins: LoginHistory[];
  warnings: WarningRow[];
  profile: ProfileLite;
  onAnnouncementRead: (a: Announcement) => Promise<void>;
  onNotificationRead: (n: Notification) => Promise<void>;
  onRememberWarning: () => void;
  onOpenSupport: () => void;
  onClose: () => void;
};

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  if (/iphone|ipad/i.test(ua)) return "iPhone / iPad";
  if (/android/i.test(ua)) return "Android device";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  return "Web browser";
}

export default function NotificationsCenter({
  announcements,
  notifications,
  logins,
  warnings,
  profile,
  onAnnouncementRead,
  onNotificationRead,
  onRememberWarning,
  onOpenSupport,
  onClose,
}: Props) {
  const [view, setView] = useState<CategoryId>("overview");

  // Grouped data
  // Exact type strings confirmed by Claude + safe fallbacks
  const platformAlerts = useMemo(
    () =>
      notifications.filter((n) => {
        const t = (n.type ?? "").trim();
        return /^(ban|ban_lifted|warning|kyc|security|2FA_ENABLED|GENERAL)$/i.test(t);
      }),
    [notifications]
  );

  const walletActivity = useMemo(
    () =>
      notifications.filter((n) => {
        const t = (n.type ?? "").trim();
        // Note: backend writes "withdrawal" (not "withdraw")
        return /^(deposit|withdrawal|swap)$/i.test(t);
      }),
    [notifications]
  );

  const rewardItems = useMemo(
    () =>
      notifications.filter((n) => {
        const t = (n.type ?? "").trim();
        return /^(reward|referral)$/i.test(t);
      }),
    [notifications]
  );

  const unreadPlatform = platformAlerts.filter((n) => !n.is_read).length;
  const unreadWallet = walletActivity.filter((n) => !n.is_read).length;
  const unreadAnnouncements = announcements.filter((a) => !a.read).length;
  const unreadRewards = rewardItems.filter((n) => !n.is_read).length;

  const categories: {
    id: CategoryId;
    label: string;
    subtitle: string;
    icon: string;
    count: number;
  }[] = [
    {
      id: "platform_alerts",
      label: "Platform Alerts",
      subtitle: "Bans, warnings, security notices",
      icon: "⚡",
      count: unreadPlatform,
    },
    {
      id: "account_activity",
      label: "Account Activity",
      subtitle: "Logins & device history",
      icon: "🛡",
      count: 0,
    },
    {
      id: "platform_updates",
      label: "Platform Updates",
      subtitle: "Official announcements",
      icon: "📢",
      count: unreadAnnouncements,
    },
    {
      id: "wallet_activity",
      label: "Wallet Activity",
      subtitle: "Deposits, withdrawals, transfers",
      icon: "💳",
      count: unreadWallet,
    },
    {
      id: "rewards",
      label: "Rewards & Campaigns",
      subtitle: "Bonuses and referral updates",
      icon: "🎁",
      count: unreadRewards,
    },
    {
      id: "support",
      label: "Support Inbox",
      subtitle: "Open live chat with the team",
      icon: "🎧",
      count: 0,
    },
  ];

  const totalUnread =
    unreadPlatform + unreadWallet + unreadAnnouncements + unreadRewards;

  // ─── Detail views ───
  if (view !== "overview") {
    return (
      <div style={shell}>
        <style>{MOTION}</style>
        <header style={header}>
          <button type="button" style={backBtn} onClick={() => setView("overview")} aria-label="Back">
            ←
          </button>
          <h2 style={title}>
            {categories.find((c) => c.id === view)?.label || "Notifications"}
          </h2>
          <button type="button" style={closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div style={body}>
          {view === "platform_alerts" && (
            <div style={{ animation: "ceoNotifIn 0.3s ease-out both" }}>
              {platformAlerts.length === 0 && (
                <Empty text="No platform alerts yet." />
              )}
              {platformAlerts.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  style={{
                    ...card,
                    animation: `ceoNotifRow 0.28s ease-out both`,
                    animationDelay: `${i * 0.03}s`,
                    opacity: n.is_read ? 0.7 : 1,
                  }}
                  onClick={() => void onNotificationRead(n)}
                >
                  <div style={cardTitle}>
                    <span style={iconCircle}>⚡</span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {labelForType(n.type)}
                      {!n.is_read && <span style={dot} />}
                    </span>
                  </div>
                  <p style={cardBody}>{n.message || "—"}</p>
                  <small style={cardTime}>{timeAgo(n.created_at)}</small>
                </button>
              ))}
            </div>
          )}

          {view === "account_activity" && (
            <div style={{ animation: "ceoNotifIn 0.3s ease-out both" }}>
              {logins.length === 0 && <Empty text="No login history yet." />}
              {logins.map((l, i) => (
                <div
                  key={l.id}
                  style={{
                    ...card,
                    animation: `ceoNotifRow 0.28s ease-out both`,
                    animationDelay: `${i * 0.03}s`,
                  }}
                >
                  <div style={cardTitle}>
                    <span style={iconCircle}>🛡</span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {deviceName(l.user_agent)}
                    </span>
                  </div>
                  <p style={cardBody}>IP: {l.ip_address || "Unavailable"}</p>
                  <small style={cardTime}>
                    {l.created_at
                      ? new Date(l.created_at).toLocaleString()
                      : ""}
                  </small>
                </div>
              ))}
              {(profile?.warning_count ?? 0) > 0 && (
                <button
                  type="button"
                  style={{ ...secondaryBtn, marginTop: 12 }}
                  onClick={onRememberWarning}
                >
                  Mark warning count as seen
                </button>
              )}
            </div>
          )}

          {view === "platform_updates" && (
            <div style={{ animation: "ceoNotifIn 0.3s ease-out both" }}>
              {announcements.length === 0 && (
                <Empty text="No platform updates yet." />
              )}
              {announcements.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  style={{
                    ...card,
                    animation: `ceoNotifRow 0.28s ease-out both`,
                    animationDelay: `${i * 0.03}s`,
                    opacity: a.read ? 0.7 : 1,
                  }}
                  onClick={() => void onAnnouncementRead(a)}
                >
                  <div style={cardTitle}>
                    <span style={iconCircle}>📢</span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {a.title || "Update"}
                      {!a.read && <span style={dot} />}
                    </span>
                  </div>
                  <p style={cardBody}>{a.body}</p>
                  <small style={cardTime}>{timeAgo(a.created_at)}</small>
                </button>
              ))}
            </div>
          )}

          {view === "wallet_activity" && (
            <div style={{ animation: "ceoNotifIn 0.3s ease-out both" }}>
              {walletActivity.length === 0 && (
                <Empty text="No wallet activity notifications." />
              )}
              {walletActivity.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  style={{
                    ...card,
                    animation: `ceoNotifRow 0.28s ease-out both`,
                    animationDelay: `${i * 0.03}s`,
                    opacity: n.is_read ? 0.7 : 1,
                  }}
                  onClick={() => void onNotificationRead(n)}
                >
                  <div style={cardTitle}>
                    <span style={iconCircle}>💳</span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {labelForType(n.type)}
                      {!n.is_read && <span style={dot} />}
                    </span>
                  </div>
                  <p style={cardBody}>{n.message || "—"}</p>
                  <small style={cardTime}>{timeAgo(n.created_at)}</small>
                </button>
              ))}
            </div>
          )}

          {view === "rewards" && (
            <div style={{ animation: "ceoNotifIn 0.3s ease-out both" }}>
              {rewardItems.length === 0 && (
                <Empty text="No reward notifications yet." />
              )}
              {rewardItems.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  style={{
                    ...card,
                    animation: `ceoNotifRow 0.28s ease-out both`,
                    animationDelay: `${i * 0.03}s`,
                    opacity: n.is_read ? 0.7 : 1,
                  }}
                  onClick={() => void onNotificationRead(n)}
                >
                  <div style={cardTitle}>
                    <span style={iconCircle}>🎁</span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {labelForType(n.type)}
                      {!n.is_read && <span style={dot} />}
                    </span>
                  </div>
                  <p style={cardBody}>{n.message || "—"}</p>
                  <small style={cardTime}>{timeAgo(n.created_at)}</small>
                </button>
              ))}
            </div>
          )}

          {view === "support" && (
            <div style={{ animation: "ceoNotifIn 0.3s ease-out both", textAlign: "center", paddingTop: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
              <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 18, fontWeight: 800 }}>
                Support Inbox
              </h3>
              <p style={{ color: "#888", fontSize: 13, lineHeight: 1.5, maxWidth: 280, margin: "0 auto 20px" }}>
                Open a live conversation with the CEO Exchange support team.
              </p>
              <button type="button" style={primaryBtn} onClick={onOpenSupport}>
                Open Support Chat
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Overview (category list) ───
  return (
    <div style={shell}>
      <style>{MOTION}</style>
      <header style={header}>
        <button type="button" style={backBtn} onClick={onClose} aria-label="Back">
          ←
        </button>
        <h2 style={title}>Inbox</h2>
        <button type="button" style={closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div style={{ ...body, animation: "ceoNotifIn 0.32s ease-out both" }}>
        <div style={summaryBar}>
          <span style={{ color: GOLD_LIGHT, fontWeight: 800, fontSize: 15 }}>
            {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
          </span>
          <span style={{ color: "#666", fontSize: 12 }}>CEO Exchange</span>
        </div>

        {categories.map((c, i) => (
          <button
            key={c.id}
            type="button"
            style={{
              ...row,
              animation: `ceoNotifRow 0.3s ease-out both`,
              animationDelay: `${i * 0.04}s`,
            }}
            onClick={() => setView(c.id)}
          >
            <span style={rowIcon}>{c.icon}</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <div style={rowLabel}>{c.label}</div>
              <div style={rowSub}>{c.subtitle}</div>
            </span>
            {c.count > 0 && (
              <span style={countBadge}>{c.count > 99 ? "99+" : c.count}</span>
            )}
            <span style={chevron}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function labelForType(type: string | null) {
  if (!type) return "Notification";
  const t = type.toLowerCase();
  if (t === "ban") return "Account suspended";
  if (t === "ban_lifted") return "Suspension lifted";
  if (t === "warning") return "Account warning";
  if (t === "kyc") return "Identity verification";
  if (t === "security") return "Security notice";
  if (t === "2fa_enabled") return "Authenticator enabled";
  if (t === "deposit") return "Deposit update";
  if (t === "withdrawal") return "Withdrawal update";
  if (t === "swap") return "Swap update";
  if (t === "reward") return "Reward unlocked";
  if (t === "referral") return "Referral update";
  if (t === "general") return "Notice";
  return type.replace(/_/g, " ");
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: "#555", fontSize: 14 }}>
      {text}
    </div>
  );
}

// ─── Styles ───
const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: BG,
  display: "flex",
  flexDirection: "column",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  paddingTop: "calc(12px + env(safe-area-inset-top))",
  borderBottom: "1px solid #1a1a1a",
  flexShrink: 0,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 800,
  color: "#f5f5f5",
  flex: 1,
  textAlign: "center",
};

const backBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: GOLD,
  fontSize: 20,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const closeBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: "#888",
  fontSize: 18,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 14px calc(24px + env(safe-area-inset-bottom))",
  WebkitOverflowScrolling: "touch",
};

const summaryBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 4px 16px",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  minHeight: 64,
  padding: "14px 14px",
  marginBottom: 8,
  border: 0,
  borderRadius: 14,
  background: CARD,
  color: "#ddd",
  textAlign: "left",
  cursor: "pointer",
};

const rowIcon: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "#17130a",
  border: `1px solid ${BORDER}`,
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  flexShrink: 0,
};

const rowLabel: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#eee",
  marginBottom: 2,
};

const rowSub: React.CSSProperties = {
  fontSize: 12,
  color: "#777",
};

const countBadge: React.CSSProperties = {
  minWidth: 22,
  height: 22,
  borderRadius: 99,
  background: GOLD,
  color: "#0a0a0a",
  fontSize: 11,
  fontWeight: 800,
  display: "grid",
  placeItems: "center",
  padding: "0 6px",
};

const chevron: React.CSSProperties = {
  color: "#555",
  fontSize: 20,
  fontWeight: 300,
};

const card: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "14px 14px",
  marginBottom: 8,
  border: 0,
  borderRadius: 14,
  background: CARD,
  color: "#ddd",
  cursor: "pointer",
};

const cardTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  fontWeight: 700,
  color: "#eee",
  marginBottom: 6,
};

const iconCircle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "#17130a",
  border: `1px solid ${BORDER}`,
  display: "grid",
  placeItems: "center",
  fontSize: 13,
  flexShrink: 0,
};

const cardBody: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 13,
  color: "#aaa",
  lineHeight: 1.45,
  paddingLeft: 38,
};

const cardTime: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#666",
  paddingLeft: 38,
};

const dot: React.CSSProperties = {
  display: "inline-block",
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: GOLD,
  marginLeft: 8,
  verticalAlign: "middle",
  animation: "ceoNotifPulse 1.8s ease-out infinite",
};

const primaryBtn: React.CSSProperties = {
  minHeight: 48,
  padding: "0 24px",
  border: 0,
  borderRadius: 12,
  background: `linear-gradient(135deg,${GOLD},#d98e00)`,
  color: "#090909",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: `1px solid #725316`,
  borderRadius: 12,
  background: "transparent",
  color: GOLD_LIGHT,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
