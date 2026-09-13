/**
 * CEO Exchange — User Center
 * Full-screen profile / account hub.
 * Replaces the old small Menu bottom-sheet.
 *
 * Wire in Home.tsx:
 *   import UserCenter from "./UserCenter";
 *   ...
 *   {modal === "menu" && (
 *     <UserCenter
 *       profile={profile}
 *       onClose={closeModal}
 *       onLogout={async () => { await supabase.auth.signOut(); onLogout?.(); }}
 *       onOpenSettings={(tab) => { closeModal(); setSettingsTab(tab); setSettingsOpen(true); }}
 *       onOpenSupport={() => { closeModal(); setModal("support"); }}
 *       onOpenNotifications={() => { closeModal(); setModal("notifications"); }}
 *     />
 *   )}
 */

import React from "react";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";
const BG = "#050505";
const CARD = "#101010";
const BORDER = "#2a2110";

const MOTION = `
@keyframes ucIn {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ucRow {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

type ProfileLite = {
  nickname?: string | null;
  email?: string | null;
  profile_picture_url?: string | null;
  referral_code?: string | null;
  role?: string | null;
} | null;

type Props = {
  profile: ProfileLite;
  onClose: () => void;
  onLogout: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenSupport: () => void;
  onOpenNotifications: () => void;
};

export default function UserCenter({
  profile,
  onClose,
  onLogout,
  onOpenSettings,
  onOpenSupport,
  onOpenNotifications,
}: Props) {
  const displayName = profile?.nickname || profile?.email?.split("@")[0] || "User";
  const email = profile?.email || "—";
  const avatar = profile?.profile_picture_url;

  const rows: {
    label: string;
    sub?: string;
    icon: string;
    action: () => void;
    danger?: boolean;
  }[] = [
    {
      label: "Settings",
      sub: "Profile, preferences, language",
      icon: "⚙",
      action: () => onOpenSettings("My Info"),
    },
    {
      label: "Security",
      sub: "Password, 2FA, devices",
      icon: "🛡",
      action: () => onOpenSettings("Security"),
    },
    {
      label: "Inbox",
      sub: "Alerts, updates, activity",
      icon: "🔔",
      action: onOpenNotifications,
    },
    {
      label: "Support",
      sub: "Live chat with the team",
      icon: "🎧",
      action: onOpenSupport,
    },
    {
      label: "Sign out",
      icon: "→",
      action: onLogout,
      danger: true,
    },
  ];

  return (
    <div style={shell}>
      <style>{MOTION}</style>

      <header style={header}>
        <button type="button" style={iconBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h1 style={title}>User Center</h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={body}>
        {/* Profile card */}
        <div style={{ ...profileCard, animation: "ucIn 0.32s ease-out both" }}>
          <div style={avatarWrap}>
            {avatar ? (
              <img src={avatar} alt="" style={avatarImg} />
            ) : (
              <div style={avatarFallback}>
                {(displayName[0] || "U").toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={nameText}>{displayName}</div>
            <div style={emailText}>{email}</div>
            {profile?.role && (profile.role === "owner" || profile.role === "admin") && (
              <span style={roleBadge}>{profile.role}</span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 18, animation: "ucIn 0.34s ease-out both" }}>
          {rows.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={r.action}
              style={{
                ...row,
                animation: `ucRow 0.3s ease-out both`,
                animationDelay: `${0.05 + i * 0.04}s`,
                color: r.danger ? "#f87171" : "#eee",
              }}
            >
              <span style={{
                ...rowIcon,
                borderColor: r.danger ? "#4c2025" : BORDER,
                background: r.danger ? "#1d0c0e" : "#17130a",
              }}>
                {r.icon}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{r.sub}</div>}
              </span>
              {!r.danger && <span style={chevron}>›</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── styles ───
const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 90,
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
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 800,
  color: "#f5f5f5",
};

const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: "#aaa",
  fontSize: 18,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 14px calc(28px + env(safe-area-inset-bottom))",
  WebkitOverflowScrolling: "touch",
};

const profileCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px",
  borderRadius: 16,
  background: CARD,
  border: `1px solid ${BORDER}`,
};

const avatarWrap: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  overflow: "hidden",
  flexShrink: 0,
  border: `1.5px solid ${BORDER}`,
};

const avatarImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const avatarFallback: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "#1a1508",
  color: GOLD,
  fontWeight: 800,
  fontSize: 22,
};

const nameText: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: "#fff",
  marginBottom: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emailText: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const roleBadge: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 700,
  background: "rgba(245,181,27,0.15)",
  color: GOLD,
  textTransform: "uppercase",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  minHeight: 62,
  padding: "12px 14px",
  marginBottom: 8,
  border: 0,
  borderRadius: 14,
  background: CARD,
  cursor: "pointer",
  textAlign: "left",
};

const rowIcon: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  display: "grid",
  placeItems: "center",
  fontSize: 16,
  flexShrink: 0,
};

const chevron: React.CSSProperties = {
  color: "#555",
  fontSize: 20,
};
