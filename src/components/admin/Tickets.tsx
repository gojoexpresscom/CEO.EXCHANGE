import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Ticket = {
  id: string;
  user_id?: string | null;
  subject?: string | null;
  message?: string | null;
  status?: string | null;
  channel?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  created_at?: string | null;
  last_activity_at?: string | null;
  closed_at?: string | null;
};

type Msg = {
  id: string;
  ticket_id: string | null;
  sender_id: string | null;
  sender_type?: string | null;
  message: string;
  created_at: string | null;
};

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";

export default function Tickets() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAdminId(data.session?.user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id,user_id,subject,message,status,channel,contact_name,contact_email,created_at,last_activity_at,closed_at"
      )
      .order("last_activity_at", { ascending: false, nullsFirst: false });
    if (error) {
      // Fallback if nullsFirst unsupported
      const { data: d2 } = await supabase
        .from("support_tickets")
        .select(
          "id,user_id,subject,message,status,channel,contact_name,contact_email,created_at,last_activity_at,closed_at"
        )
        .order("created_at", { ascending: false });
      setRows((d2 as Ticket[]) ?? []);
    } else {
      setRows((data as Ticket[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Latest message preview per ticket (from ticket_messages)
  useEffect(() => {
    if (!rows.length) return;
    let cancelled = false;
    async function previewsLoad() {
      const map: Record<string, string> = {};
      await Promise.all(
        rows.slice(0, 40).map(async (t) => {
          const { data } = await supabase
            .from("ticket_messages")
            .select("message")
            .eq("ticket_id", t.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.message) map[t.id] = data.message;
          else if (t.message) map[t.id] = t.message;
        })
      );
      if (!cancelled) setPreviews(map);
    }
    void previewsLoad();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const loadMessages = useCallback(async (ticketId: string) => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("id,ticket_id,sender_id,sender_type,message,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (!error) setMessages((data as Msg[]) ?? []);
    setMsgLoading(false);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId);
    const channel = supabase
      .channel(`admin-ticket-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${selectedId}`,
        },
        (payload) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId, loadMessages]);

  async function updateStatus(id: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (/closed|resolved|ended/i.test(status)) {
      patch.closed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
    if (error) setBanner(error.message);
    else {
      setBanner(`Ticket marked ${status}`);
      await load();
    }
  }

  async function sendReply() {
    const body = reply.trim();
    if (!body || !selectedId || !adminId || sending) return;
    setSending(true);
    setBanner("");
    try {
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedId,
        sender_id: adminId,
        sender_type: "admin",
        message: body,
      });
      // Ensure ticket is in human mode when agent replies
      await supabase
        .from("support_tickets")
        .update({ mode: "human", assigned_admin_id: adminId })
        .eq("id", selectedId);
      if (error) throw error;
      // last_activity_at updated by backend trigger — do not invent another mechanism
      setReply("");
      await loadMessages(selectedId);
      await load();
    } catch (e: any) {
      setBanner(e?.message || "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const closed =
    selected?.closed_at != null || /closed|resolved|ended/i.test(selected?.status || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 480 }}>
      {banner && <div style={{ color: GOLD, fontSize: 13 }}>{banner}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedId ? "minmax(260px, 1fr) minmax(0, 1.4fr)" : "1fr",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {/* Ticket list */}
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #1a1a1a",
            borderRadius: 14,
            overflow: "hidden",
            maxHeight: 640,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a1a1a", color: "#aaa", fontSize: 13, fontWeight: 700 }}>
            Support tickets
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>No tickets</div>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    borderBottom: "1px solid #151515",
                    background: selectedId === r.id ? "#17130a" : "transparent",
                    padding: "12px 14px",
                    cursor: "pointer",
                    color: "#ddd",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: "#eee", fontWeight: 700, fontSize: 13 }}>
                      {r.subject || "Live chat"}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#666",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(previews[r.id] || r.message || r.contact_email || "—").slice(0, 100)}
                  </div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                    {r.last_activity_at
                      ? new Date(r.last_activity_at).toLocaleString()
                      : r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        {selectedId && selected && (
          <div
            style={{
              background: "#0a0a0a",
              border: "1px solid #1a1a1a",
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              minHeight: 480,
              maxHeight: 640,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #1a1a1a",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  {selected.subject || "Support conversation"}
                </div>
                <div style={{ color: "#777", fontSize: 11, marginTop: 2 }}>
                  {selected.contact_name || "User"}
                  {selected.contact_email ? ` · ${selected.contact_email}` : ""}
                  {selected.channel ? ` · ${selected.channel}` : ""}
                  {" · "}
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["open", "pending", "closed"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void updateStatus(selected.id, st)}
                    style={{
                      border: `1px solid ${/closed/i.test(st) ? "#444" : "#5a4313"}`,
                      background: "transparent",
                      color: GOLD_LIGHT,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 11,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    Mark {st}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  style={{
                    border: "1px solid #333",
                    background: "transparent",
                    color: "#aaa",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Close panel
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
              {msgLoading && <div style={{ color: "#666", textAlign: "center" }}>Loading messages…</div>}
              {!msgLoading && messages.length === 0 && (
                <div style={{ color: "#666", textAlign: "center", padding: 24 }}>
                  No messages yet. Reply below to start the conversation.
                </div>
              )}
              {messages.map((m) => {
                const st = (m.sender_type || "").toLowerCase();
                const mine = st === "admin" || (!st && m.sender_id === adminId);
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "82%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: mine ? "#1a1508" : "#151515",
                        border: mine ? `1px solid ${GOLD}` : "1px solid #222",
                        color: "#eee",
                        fontSize: 13,
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      <div style={{ fontSize: 10, color: mine ? GOLD : "#888", marginBottom: 4 }}>
                        {mine ? "Admin" : "User"}
                      </div>
                      {m.message}
                      <div style={{ color: "#666", fontSize: 10, marginTop: 6 }}>
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {closed ? (
              <div style={{ padding: 14, borderTop: "1px solid #1a1a1a", color: "#888", fontSize: 13 }}>
                This ticket is closed. Re-open it to continue the conversation.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: 12,
                  borderTop: "1px solid #1a1a1a",
                  alignItems: "flex-end",
                }}
              >
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply…"
                  rows={2}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    maxHeight: 120,
                    resize: "vertical",
                    border: "1px solid #2a2110",
                    borderRadius: 10,
                    background: "#101010",
                    color: "#fff",
                    padding: "10px 12px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    outline: 0,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={sending || !reply.trim() || !adminId}
                  onClick={() => void sendReply()}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    padding: "12px 16px",
                    background: `linear-gradient(135deg,${GOLD},#d98e00)`,
                    color: "#090909",
                    fontWeight: 800,
                    cursor: "pointer",
                    opacity: sending || !reply.trim() ? 0.5 : 1,
                  }}
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const v = (status || "open").toLowerCase();
  const color =
    v === "closed" || v === "resolved"
      ? "#888"
      : v === "pending"
        ? GOLD
        : "#39d98a";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        color,
        border: `1px solid ${color}55`,
        background: `${color}18`,
        textTransform: "capitalize",
      }}
    >
      {status || "open"}
    </span>
  );
}
