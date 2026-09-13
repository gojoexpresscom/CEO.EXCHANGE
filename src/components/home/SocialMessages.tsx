/**
 * CEO Exchange — Social Message hub (Personal center FAB → Message)
 * CEO black/gold design — not a Bybit clone.
 * Sections mirror product needs using existing notification data when available.
 */

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const BG = "#050505";
const CARD = "#121212";
const BORDER = "#2a2a2a";

type Props = {
  userId: string;
  onClose: () => void;
};

type Row = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
};

export default function SocialMessages({ userId, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([
    { id: "followers", title: "New followers", subtitle: "No new notifications", icon: "👤" },
    { id: "interactions", title: "Interaction messages", subtitle: "No new notifications", icon: "🔔" },
    { id: "assistant", title: "Square assistant", subtitle: "No new notifications", icon: "💬" },
  ]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("id,type,message,created_at,is_read")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      const list = data ?? [];
      const unread = list.filter((n) => !n.is_read).length;
      const social = list.filter((n) =>
        /follow|like|comment|mention|repost|social/i.test(String(n.type || n.message || ""))
      );

      setRows([
        {
          id: "followers",
          title: "New followers",
          subtitle:
            social.filter((n) => /follow/i.test(String(n.type || n.message))).length > 0
              ? `${social.filter((n) => /follow/i.test(String(n.type || n.message))).length} recent`
              : "No new notifications",
          icon: "👤",
        },
        {
          id: "interactions",
          title: "Interaction messages",
          subtitle:
            unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "No new notifications",
          icon: "🔔",
        },
        {
          id: "assistant",
          title: "Square assistant",
          subtitle: "Community tips and updates",
          icon: "💬",
        },
      ]);
    })();
  }, [userId]);

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
          <button key={r.id} type="button" style={row} onClick={() => undefined}>
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
  padding: "8px 14px calc(24px + env(safe-area-inset-bottom))",
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
