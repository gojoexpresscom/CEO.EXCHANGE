/**
 * CEO Exchange — Social Message hub (Personal center → Message)
 * Three sections open real drill-down lists from user_notifications / follows.
 */

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const BG = "#050505";
const CARD = "#121212";
const BORDER = "#2a2a2a";

type Props = {
  userId: string;
  onClose: () => void;
};

type SectionId = "followers" | "interactions" | "assistant";

type HubRow = {
  id: SectionId;
  title: string;
  subtitle: string;
  icon: string;
};

type Notif = {
  id: string;
  type: string | null;
  message: string | null;
  created_at: string | null;
  is_read: boolean | null;
  from_user_id?: string | null;
};

type FollowUser = {
  user_id: string;
  nickname: string | null;
  profile_picture_url: string | null;
  uid?: string | null;
  bio?: string | null;
  followed_at?: string | null;
};

function timeAgo(value: string | null | undefined) {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
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

/** Empty state matching the product screenshots */
function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        minHeight: 280,
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
          position: "relative",
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
      <p style={{ color: "#777", fontSize: 14, margin: 0 }}>{label}</p>
    </div>
  );
}

export default function SocialMessages({ userId, onClose }: Props) {
  const [section, setSection] = useState<SectionId | null>(null);
  const [rows, setRows] = useState<HubRow[]>([
    { id: "followers", title: "New followers", subtitle: "No new notifications", icon: "👤" },
    { id: "interactions", title: "Interaction messages", subtitle: "No new notifications", icon: "🔔" },
    { id: "assistant", title: "Square assistant", subtitle: "Community tips and updates", icon: "💬" },
  ]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [newFollowers, setNewFollowers] = useState<FollowUser[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const refreshHub = useCallback(async () => {
    const { data } = await supabase
      .from("user_notifications")
      .select("id,type,message,created_at,is_read")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const list = (data ?? []) as Notif[];
    setNotifs(list);

    const followNotifs = list.filter((n) => /follow/i.test(String(n.type || n.message || "")));
    const interactionNotifs = list.filter((n) =>
      /like|comment|mention|repost|interaction|social/i.test(String(n.type || n.message || ""))
    );
    const assistantNotifs = list.filter((n) =>
      /assistant|tip|update|system|announcement/i.test(String(n.type || n.message || ""))
    );

    setRows([
      {
        id: "followers",
        title: "New followers",
        subtitle:
          followNotifs.length > 0
            ? `${followNotifs.length} recent`
            : "No new notifications",
        icon: "👤",
      },
      {
        id: "interactions",
        title: "Interaction messages",
        subtitle:
          interactionNotifs.filter((n) => !n.is_read).length > 0
            ? `${interactionNotifs.filter((n) => !n.is_read).length} unread`
            : interactionNotifs.length > 0
              ? `${interactionNotifs.length} messages`
              : "No new notifications",
        icon: "🔔",
      },
      {
        id: "assistant",
        title: "Square assistant",
        subtitle:
          assistantNotifs.length > 0
            ? `${assistantNotifs.length} updates`
            : "Community tips and updates",
        icon: "💬",
      },
    ]);
  }, [userId]);

  useEffect(() => {
    void refreshHub();
  }, [refreshHub]);

  const openSection = async (id: SectionId) => {
    setSection(id);
    setLoadingDetail(true);
    try {
      if (id === "followers") {
        // Prefer real recent followers from user_follows / get_followers
        const { data, error } = await supabase.rpc("get_followers", {
          p_user_id: userId,
          p_limit: 50,
          p_offset: 0,
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          setNewFollowers(data as FollowUser[]);
        } else {
          setNewFollowers([]);
        }
      }
      // interactions & assistant use notifs already loaded
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Detail: New followers ──────────────────────────────────────────
  if (section === "followers") {
    return (
      <div style={shell}>
        <header style={header}>
          <button type="button" style={backBtn} onClick={() => setSection(null)} aria-label="Back">
            ←
          </button>
          <h2 style={title}>Followers</h2>
          <span style={{ width: 40 }} />
        </header>
        <div style={body}>
          {loadingDetail && <p style={emptyText}>Loading…</p>}
          {!loadingDetail && newFollowers.length === 0 && <EmptyState label="No new followers" />}
          {!loadingDetail &&
            newFollowers.map((u) => (
              <div key={u.user_id} style={userRow}>
                {u.profile_picture_url ? (
                  <img src={u.profile_picture_url} alt="" style={av} />
                ) : (
                  <div style={avFb}>{(u.nickname || u.uid || "U").slice(0, 1).toUpperCase()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#eee" }}>
                    {(u.nickname && u.nickname.trim()) || (u.uid ? `User ${u.uid}` : "User")}
                  </div>
                  {u.bio && (
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
                      {u.bio}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // ── Detail: Interaction messages ───────────────────────────────────
  if (section === "interactions") {
    const items = notifs.filter((n) =>
      /like|comment|mention|repost|interaction|social|follow/i.test(String(n.type || n.message || ""))
    );
    return (
      <div style={shell}>
        <header style={header}>
          <button type="button" style={backBtn} onClick={() => setSection(null)} aria-label="Back">
            ←
          </button>
          <h2 style={title}>All messages</h2>
          <span style={{ width: 40 }} />
        </header>
        <div style={body}>
          {items.length === 0 && <EmptyState label="No messages" />}
          {items.map((n) => (
            <div key={n.id} style={notifRow}>
              <div style={notifIcon}>🔔</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "#eee", lineHeight: 1.4 }}>
                  {n.message || n.type || "Notification"}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Detail: Square assistant ───────────────────────────────────────
  if (section === "assistant") {
    const items = notifs.filter((n) =>
      /assistant|tip|update|system|announcement/i.test(String(n.type || n.message || ""))
    );
    return (
      <div style={shell}>
        <header style={header}>
          <button type="button" style={backBtn} onClick={() => setSection(null)} aria-label="Back">
            ←
          </button>
          <h2 style={title}>Square assistant</h2>
          <span style={{ width: 40 }} />
        </header>
        <div style={body}>
          {items.length === 0 && <EmptyState label="No notifications" />}
          {items.map((n) => (
            <div key={n.id} style={notifRow}>
              <div style={notifIcon}>💬</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "#eee", lineHeight: 1.4 }}>
                  {n.message || n.type || "Update"}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Hub ────────────────────────────────────────────────────────────
  return (
    <div style={shell}>
      <header style={header}>
        <button type="button" style={backBtn} onClick={onClose} aria-label="Back">
          ←
        </button>
        <h2 style={title}>Message</h2>
        <span style={{ width: 40 }} />
      </header>
      <div style={body}>
        {rows.map((r) => (
          <button key={r.id} type="button" style={row} onClick={() => void openSection(r.id)}>
            <span style={icon}>{r.icon}</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <div style={rowTitle}>{r.title}</div>
              <div style={rowSub}>{r.subtitle}</div>
            </span>
          </button>
        ))}
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
const backBtn: React.CSSProperties = {
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
  padding: "8px 14px calc(24px + env(safe-area-inset-bottom))",
  WebkitOverflowScrolling: "touch",
};
const row: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 4px",
  border: 0,
  borderBottom: `1px solid ${BORDER}`,
  background: "transparent",
  cursor: "pointer",
  color: "#eee",
};
const icon: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: CARD,
  border: `1px solid ${BORDER}`,
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  flexShrink: 0,
};
const rowTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#f2f2f2" };
const rowSub: React.CSSProperties = { fontSize: 12, color: "#777", marginTop: 3 };
const emptyText: React.CSSProperties = { color: "#666", textAlign: "center", padding: 28, fontSize: 13 };
const userRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: `1px solid ${BORDER}`,
};
const av: React.CSSProperties = { width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
const avFb: React.CSSProperties = {
  ...av,
  display: "grid",
  placeItems: "center",
  background: CARD,
  color: GOLD,
  fontWeight: 800,
  fontSize: 16,
};
const notifRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "14px 0",
  borderBottom: `1px solid ${BORDER}`,
};
const notifIcon: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: CARD,
  border: `1px solid ${BORDER}`,
  display: "grid",
  placeItems: "center",
  fontSize: 16,
  flexShrink: 0,
};
