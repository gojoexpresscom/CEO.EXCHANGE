/**
 * CEO Exchange — Support Chat (user side)
 * Mobile-first full-screen chat with CEO AI + human handoff.
 *
 * Drop into: src/components/support/SupportChat.tsx
 * (or src/components/home/SupportChat.tsx — match your import)
 *
 * Backend (already live per GROK_AI_ADDENDUM):
 * - support_tickets.mode: 'ai' | 'human'
 * - ticket_messages.sender_type: 'user' | 'admin' | 'ai'
 * - edge function support-ai-reply: { ticket_id } -> { reply, handoff } | { error }
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";
const BG = "#050505";
const CARD = "#101010";
const BORDER = "#2a2110";

const MOTION = `
@keyframes scIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scBubble {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes scPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`;

type Ticket = {
  id: string;
  subject: string | null;
  message: string | null;
  status: string | null;
  mode?: string | null;
  created_at: string | null;
  last_activity_at?: string | null;
};

type Msg = {
  id: string;
  ticket_id: string | null;
  sender_id: string | null;
  sender_type?: string | null;
  message: string | null;
  created_at: string | null;
};

const HUMAN_KEYWORDS = /\b(agent|human|real person|talk to (a )?person|speak to (a )?human|customer service)\b/i;

type Props = {
  onClose: () => void;
};

export default function SupportChat({ onClose }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const active = tickets.find((t) => t.id === activeId) || null;
  const mode = (active?.mode || "ai") as "ai" | "human";

  const scrollBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const loadTickets = useCallback(async (uid: string) => {
    const { data, error: e } = await supabase
      .from("support_tickets")
      .select("id,subject,message,status,mode,created_at,last_activity_at")
      .eq("user_id", uid)
      .order("last_activity_at", { ascending: false });
    if (e) throw e;
    setTickets((data || []) as Ticket[]);
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data, error: e } = await supabase
      .from("ticket_messages")
      .select("id,ticket_id,sender_id,sender_type,message,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (e) throw e;
    setMessages((data || []) as Msg[]);
    scrollBottom();
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const id = data.session?.user?.id ?? null;
      setUserId(id);
      if (id) {
        void loadTickets(id)
          .catch((e) => setError(e?.message || "Failed to load tickets"))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [loadTickets]);

  // Realtime messages for active ticket
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    const channel = supabase
      .channel(`support-chat-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          scrollBottom();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as Ticket;
          setTickets((prev) => prev.map((t) => (t.id === row.id ? { ...t, ...row } : t)));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, loadMessages]);

  async function openTicket(t: Ticket) {
    setActiveId(t.id);
    setView("chat");
    setError("");
  }

  async function createTicket() {
    if (!userId) return;
    const subject = newSubject.trim() || "Support request";
    const message = newMessage.trim();
    if (!message) {
      setError("Please write a message.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject,
          message,
          status: "OPEN",
          channel: "live_chat",
          mode: "ai",
        })
        .select("id,subject,message,status,mode,created_at,last_activity_at")
        .single();
      if (e) throw e;

      // First user message in thread
      await supabase.from("ticket_messages").insert({
        ticket_id: data.id,
        sender_id: userId,
        sender_type: "user",
        message,
      });

      setTickets((prev) => [data as Ticket, ...prev]);
      setActiveId(data.id);
      setNewSubject("");
      setNewMessage("");
      setView("chat");

      // Kick CEO AI
      void callAi(data.id);
    } catch (err: any) {
      setError(err?.message || "Could not create ticket.");
    } finally {
      setSending(false);
    }
  }

  async function requestHuman(ticketId: string) {
    await supabase.from("support_tickets").update({ mode: "human" }).eq("id", ticketId);
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, mode: "human" } : t))
    );
    // Local system-style note (optional insert as user-visible message)
    setMessages((prev) => [
      ...prev,
      {
        id: `local-handoff-${Date.now()}`,
        ticket_id: ticketId,
        sender_id: null,
        sender_type: "admin",
        message: "Connecting you to a human agent…",
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function callAi(ticketId: string) {
    setAiTyping(true);
    try {
      const { data, error: e } = await supabase.functions.invoke("support-ai-reply", {
        body: { ticket_id: ticketId },
      });
      if (e) throw e;
      if (data?.error) {
        setError("CEO AI is temporarily unavailable — tap Talk to a human.");
        return;
      }
      if (data?.handoff) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, mode: "human" } : t))
        );
      }
      // AI message is inserted by the edge function; realtime will deliver it.
      // If the function also returns reply text, we could optimistic-append — skip to avoid doubles.
    } catch {
      setError("CEO AI is temporarily unavailable — tap Talk to a human.");
    } finally {
      setAiTyping(false);
    }
  }

  async function sendMessage() {
    if (!userId || !activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    setError("");

    try {
      // Keyword → human
      if (mode === "ai" && HUMAN_KEYWORDS.test(text)) {
        await supabase.from("ticket_messages").insert({
          ticket_id: activeId,
          sender_id: userId,
          sender_type: "user",
          message: text,
        });
        await requestHuman(activeId);
        return;
      }

      const { error: e } = await supabase.from("ticket_messages").insert({
        ticket_id: activeId,
        sender_id: userId,
        sender_type: "user",
        message: text,
      });
      if (e) throw e;

      if (mode === "ai") {
        void callAi(activeId);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  // ─── LIST ───
  if (view === "list") {
    return (
      <div style={shell}>
        <style>{MOTION}</style>
        <header style={header}>
          <button type="button" style={iconBtn} onClick={onClose}>
            ✕
          </button>
          <h2 style={title}>Support</h2>
          <button type="button" style={goldChip} onClick={() => setView("new")}>
            + New
          </button>
        </header>
        <div style={body}>
          {loading && <p style={muted}>Loading…</p>}
          {!loading && tickets.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 48, animation: "scIn 0.3s ease-out both" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎧</div>
              <p style={{ color: "#ccc", fontWeight: 700 }}>No conversations yet</p>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 18 }}>
                Chat with CEO AI or our team anytime.
              </p>
              <button type="button" style={primaryBtn} onClick={() => setView("new")}>
                Start chat
              </button>
            </div>
          )}
          {tickets.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void openTicket(t)}
              style={{
                ...ticketRow,
                animation: `scIn 0.28s ease-out both`,
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 700, color: "#eee", marginBottom: 4 }}>
                  {t.subject || "Support"}
                </div>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {(t.mode || "ai") === "ai" ? "CEO AI" : "Human agent"} ·{" "}
                  {(t.status || "OPEN").toLowerCase()}
                </div>
              </div>
              <span style={{ color: "#555", fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── NEW TICKET ───
  if (view === "new") {
    return (
      <div style={shell}>
        <style>{MOTION}</style>
        <header style={header}>
          <button type="button" style={iconBtn} onClick={() => setView("list")}>
            ←
          </button>
          <h2 style={title}>New chat</h2>
          <div style={{ width: 40 }} />
        </header>
        <div style={{ ...body, animation: "scIn 0.3s ease-out both" }}>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 16, lineHeight: 1.45 }}>
            CEO AI answers first. You can switch to a human agent anytime.
          </p>
          <label style={label}>
            Subject
            <input
              style={input}
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. Deposit question"
            />
          </label>
          <label style={label}>
            Message
            <textarea
              style={textarea}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="How can we help?"
              rows={5}
            />
          </label>
          {error && <div style={errBox}>{error}</div>}
          <button type="button" style={primaryBtn} disabled={sending} onClick={() => void createTicket()}>
            {sending ? "Starting…" : "Start with CEO AI"}
          </button>
        </div>
      </div>
    );
  }

  // ─── CHAT ───
  return (
    <div style={shell}>
      <style>{MOTION}</style>
      <header style={header}>
        <button
          type="button"
          style={iconBtn}
          onClick={() => {
            setView("list");
            setActiveId(null);
            setMessages([]);
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 800, color: "#f5f5f5", fontSize: 15 }}>
            {mode === "ai" ? "CEO AI" : "Support"}
          </div>
          <div style={{ fontSize: 11, color: mode === "ai" ? GOLD : "#6ee7a8" }}>
            {mode === "ai" ? "Assistant online" : "Human agent"}
          </div>
        </div>
        {mode === "ai" ? (
          <button type="button" style={humanBtn} onClick={() => activeId && void requestHuman(activeId)}>
            Human
          </button>
        ) : (
          <div style={{ width: 52 }} />
        )}
      </header>

      <div style={chatBody}>
        {messages.map((m) => {
          const st = (m.sender_type || "user").toLowerCase();
          const mine = st === "user";
          const isAi = st === "ai";
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 10,
                animation: "scBubble 0.25s ease-out both",
              }}
            >
              <div
                style={{
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: mine ? "linear-gradient(135deg,#c9970a,#f5b51b)" : isAi ? "#12100a" : CARD,
                  border: mine ? "none" : `1px solid ${isAi ? "#3d3210" : BORDER}`,
                  color: mine ? "#0a0a0a" : "#e8e8e8",
                }}
              >
                {!mine && (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: isAi ? GOLD : "#8ab4ff",
                      marginBottom: 4,
                      letterSpacing: 0.3,
                    }}
                  >
                    {isAi ? "CEO AI" : "Support"}
                  </div>
                )}
                <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                  {m.message}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: mine ? "rgba(0,0,0,0.45)" : "#666",
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
              </div>
            </div>
          );
        })}

        {aiTyping && (
          <div style={{ color: GOLD, fontSize: 12, fontWeight: 600, marginBottom: 8, animation: "scPulse 1s infinite" }}>
            CEO AI is typing…
          </div>
        )}
        {error && <div style={errBox}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={composer}>
        <input
          style={composerInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={mode === "ai" ? "Message CEO AI…" : "Message support…"}
        />
        <button
          type="button"
          style={{
            ...sendBtn,
            opacity: !draft.trim() || sending ? 0.45 : 1,
          }}
          disabled={!draft.trim() || sending}
          onClick={() => void sendMessage()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// styles
const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: BG,
  display: "flex",
  flexDirection: "column",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
};
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 12px",
  paddingTop: "calc(12px + env(safe-area-inset-top))",
  borderBottom: "1px solid #1a1a1a",
};
const title: React.CSSProperties = {
  margin: 0,
  flex: 1,
  textAlign: "center",
  fontSize: 16,
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
};
const goldChip: React.CSSProperties = {
  minHeight: 32,
  padding: "0 12px",
  border: 0,
  borderRadius: 10,
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const humanBtn: React.CSSProperties = {
  minHeight: 32,
  padding: "0 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  background: "#17130a",
  color: GOLD_LIGHT,
  fontWeight: 700,
  fontSize: 11,
  cursor: "pointer",
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "14px 14px calc(20px + env(safe-area-inset-bottom))",
};
const chatBody: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "14px 12px",
};
const ticketRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "14px",
  marginBottom: 8,
  border: 0,
  borderRadius: 14,
  background: CARD,
  cursor: "pointer",
};
const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 14,
  color: "#888",
  fontSize: 12,
  fontWeight: 600,
};
const input: React.CSSProperties = {
  minHeight: 46,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: "0 14px",
  fontSize: 14,
  outline: "none",
};
const textarea: React.CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
};
const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  border: 0,
  borderRadius: 12,
  background: `linear-gradient(135deg,${GOLD},#d98e00)`,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 8,
};
const composer: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "10px 12px",
  paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
  borderTop: "1px solid #1a1a1a",
  background: "#0a0a0a",
};
const composerInput: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  borderRadius: 22,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: "0 16px",
  fontSize: 14,
  outline: "none",
};
const sendBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: 0,
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",
};
const errBox: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#1d0c0e",
  border: "1px solid #4c2025",
  color: "#ff9aa3",
  fontSize: 12,
  marginBottom: 8,
};
const muted: React.CSSProperties = { color: "#666", textAlign: "center", paddingTop: 40 };
