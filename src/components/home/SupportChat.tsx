/**
 * CEO Exchange — Support / CEO AI
 * Full-screen dark support (inspired by dedicated support UX, CEO-branded).
 *
 * Flow:
 * 1. Welcome screen (CEO AI + Start Asking)
 * 2. Collect name → email (required before chat)
 * 3. Create ticket (mode: ai) + first AI greeting
 * 4. Chat with CEO AI; user can request human agent
 * 5. Power button ends & deletes chat (no history)
 *
 * Drop at: src/components/home/SupportChat.tsx
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const BG = "#000000";
const CARD = "#121212";
const BORDER = "#2a2a2a";
const MUTED = "#8a8a8a";

const MOTION = `
@keyframes ceoScIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ceoScBubble {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ceoScPulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
@keyframes ceoScGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,181,27,0.0); }
  50% { box-shadow: 0 0 24px 2px rgba(245,181,27,0.15); }
}
`;

const HUMAN_KEYWORDS =
  /\b(agent|human|real person|talk to (a )?person|speak to (a )?(human|agent)|transfer( me)? to (an? )?agent|customer service|live agent)\b/i;

type Ticket = {
  id: string;
  subject: string | null;
  message: string | null;
  status: string | null;
  mode?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  created_at: string | null;
  last_activity_at?: string | null;
  closed_at?: string | null;
};

type Msg = {
  id: string;
  ticket_id: string | null;
  sender_id: string | null;
  sender_type?: string | null;
  message: string | null;
  created_at: string | null;
};

type Screen = "welcome" | "gate_name" | "gate_email" | "chat";

type Props = {
  onClose: () => void;
};

export default function SupportChat({ onClose }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState("");
  const [screen, setScreen] = useState<Screen>("welcome");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [error, setError] = useState("");
  const [closedLocal, setClosedLocal] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const gateInputRef = useRef<HTMLInputElement | null>(null);

  const mode = ((ticket?.mode || "ai") as string).toLowerCase() === "human" ? "human" : "ai";
  const isClosed =
    closedLocal ||
    (ticket?.status || "").toUpperCase() === "CLOSED" ||
    !!ticket?.closed_at;

  const scrollBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      setUserId(u?.id ?? null);
      const em = u?.email || "";
      setSessionEmail(em);
      setContactEmail(em);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (screen === "gate_name" || screen === "gate_email") {
      setTimeout(() => gateInputRef.current?.focus(), 120);
    }
  }, [screen]);

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
    if (!ticket?.id || isClosed) return;
    void loadMessages(ticket.id);

    const channel = supabase
      .channel(`ceo-support-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          const st = (row.sender_type || "").toLowerCase();
          if (st === "admin") setAgentTyping(false);
          if (st === "ai") setAiTyping(false);
          scrollBottom();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${ticket.id}`,
        },
        (payload) => {
          const row = payload.new as Ticket;
          setTicket((t) => (t ? { ...t, ...row } : row));
          if ((row.status || "").toUpperCase() === "CLOSED" || row.closed_at) {
            setClosedLocal(true);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticket?.id, isClosed, loadMessages]);

  async function endChat() {
    if (!ticket?.id) {
      onClose();
      return;
    }
    try {
      await supabase.from("ticket_messages").delete().eq("ticket_id", ticket.id);
      await supabase.from("support_tickets").delete().eq("id", ticket.id);
    } catch {
      await supabase
        .from("support_tickets")
        .update({ status: "CLOSED", closed_at: new Date().toISOString() })
        .eq("id", ticket.id);
    }
    setTicket(null);
    setMessages([]);
    setClosedLocal(true);
    setScreen("welcome");
    onClose();
  }

  async function startTicket() {
    if (!userId) {
      setError("Please sign in again.");
      return;
    }
    const name = contactName.trim();
    const email = contactEmail.trim();
    if (!name) {
      setError("Please enter your name.");
      setScreen("gate_name");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      setScreen("gate_email");
      return;
    }

    setSending(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: "CEO AI chat",
          message: `Contact: ${name} <${email}>`,
          status: "OPEN",
          channel: "live_chat",
          mode: "ai",
          contact_name: name,
          contact_email: email,
        })
        .select(
          "id,subject,message,status,mode,contact_name,contact_email,created_at,last_activity_at,closed_at"
        )
        .single();
      if (e) throw e;

      setTicket(data as Ticket);
      setScreen("chat");
      setClosedLocal(false);

      const welcomeMsg = `Hi ${name}! I'm CEO AI — your 24/7 assistant for CEO Exchange. Ask me about KYC, deposits, withdrawals, security, or your account.`;
      const welcome: Msg = {
        id: `local-welcome-${Date.now()}`,
        ticket_id: data.id,
        sender_id: null,
        sender_type: "ai",
        message: welcomeMsg,
        created_at: new Date().toISOString(),
      };
      setMessages([welcome]);

      void supabase.from("ticket_messages").insert({
        ticket_id: data.id,
        sender_type: "ai",
        message: welcomeMsg,
      });
    } catch (err: any) {
      setError(err?.message || "Could not start chat.");
    } finally {
      setSending(false);
    }
  }

  async function requestHuman(ticketId: string) {
    await supabase.from("support_tickets").update({ mode: "human" }).eq("id", ticketId);
    setTicket((t) => (t ? { ...t, mode: "human" } : t));
    const noteText = "Transferring you to a human agent… Please wait.";
    const note: Msg = {
      id: `local-handoff-${Date.now()}`,
      ticket_id: ticketId,
      sender_id: null,
      sender_type: "ai",
      message: noteText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, note]);
    void supabase.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender_type: "ai",
      message: noteText,
    });
  }

  async function callAi(ticketId: string) {
    setAiTyping(true);
    try {
      const { data, error: e } = await supabase.functions.invoke("support-ai-reply", {
        body: { ticket_id: ticketId },
      });
      if (e) throw e;
      if (data?.error) {
        setError("CEO AI is temporarily unavailable. You can keep messaging or ask for an agent.");
        return;
      }
      // Product rule: do NOT auto-transfer on handoff unless user asked (handled in sendMessage).
    } catch {
      setError("CEO AI is temporarily unavailable.");
    } finally {
      setAiTyping(false);
    }
  }

  async function sendMessage() {
    if (!userId || !ticket?.id || !draft.trim() || sending || isClosed) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    setError("");

    try {
      const wantsHuman = HUMAN_KEYWORDS.test(text);

      const { error: e } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: userId,
        sender_type: "user",
        message: text,
      });
      if (e) throw e;

      if (wantsHuman && mode === "ai") {
        await requestHuman(ticket.id);
      } else if (mode === "ai") {
        void callAi(ticket.id);
      } else {
        setAgentTyping(true);
        setTimeout(() => setAgentTyping(false), 12000);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  if (screen === "welcome") {
    return (
      <div style={shell}>
        <style>{MOTION}</style>
        <header style={topBar}>
          <button type="button" style={iconBtn} onClick={onClose} aria-label="Back">
            ←
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" style={powerBtn} onClick={onClose} aria-label="Close support" title="Close">
            ⌁
          </button>
        </header>

        <div style={welcomeBody}>
          <div style={{ animation: "ceoScIn 0.4s ease-out both" }}>
            <div style={botAvatarWrap}>
              <div style={botAvatar}>AI</div>
            </div>
            <h1 style={welcomeTitle}>CEO AI</h1>
            <p style={welcomeSub}>24/7 dedicated support for CEO Exchange</p>
            <p style={welcomeLine}>Hello — how can I assist you today?</p>
          </div>

          {error && <div style={errBox}>{error}</div>}

          <button
            type="button"
            style={startBtn}
            onClick={() => {
              setError("");
              setScreen("gate_name");
            }}
          >
            Start asking
          </button>
        </div>
      </div>
    );
  }

  if (screen === "gate_name") {
    return (
      <div style={shell}>
        <style>{MOTION}</style>
        <header style={topBar}>
          <button type="button" style={iconBtn} onClick={() => setScreen("welcome")}>
            ←
          </button>
          <div style={headerCenter}>
            <div style={headerTitle}>CEO AI</div>
            <div style={headerSub}>Almost there</div>
          </div>
          <button type="button" style={powerBtn} onClick={endChat} aria-label="End">
            ⌁
          </button>
        </header>
        <div style={gateBody}>
          <p style={gatePrompt}>What should we call you?</p>
          <input
            ref={gateInputRef}
            style={gateInput}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Your name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && contactName.trim()) {
                setError("");
                setScreen("gate_email");
              }
            }}
          />
          {error && <div style={errBox}>{error}</div>}
          <button
            type="button"
            style={startBtn}
            disabled={!contactName.trim()}
            onClick={() => {
              if (!contactName.trim()) return;
              setError("");
              setScreen("gate_email");
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (screen === "gate_email") {
    return (
      <div style={shell}>
        <style>{MOTION}</style>
        <header style={topBar}>
          <button type="button" style={iconBtn} onClick={() => setScreen("gate_name")}>
            ←
          </button>
          <div style={headerCenter}>
            <div style={headerTitle}>CEO AI</div>
            <div style={headerSub}>One more step</div>
          </div>
          <button type="button" style={powerBtn} onClick={endChat} aria-label="End">
            ⌁
          </button>
        </header>
        <div style={gateBody}>
          <p style={gatePrompt}>What email should we use for this chat?</p>
          <input
            ref={gateInputRef}
            style={gateInput}
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={sessionEmail || "you@email.com"}
            onKeyDown={(e) => {
              if (e.key === "Enter") void startTicket();
            }}
          />
          {error && <div style={errBox}>{error}</div>}
          <button type="button" style={startBtn} disabled={sending} onClick={() => void startTicket()}>
            {sending ? "Starting…" : "Start chat"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <style>{MOTION}</style>
      <header style={topBar}>
        <button
          type="button"
          style={iconBtn}
          onClick={() => {
            setScreen("welcome");
            setTicket(null);
            setMessages([]);
          }}
          aria-label="Back"
        >
          ←
        </button>
        <div style={headerCenter}>
          <div style={headerTitle}>{mode === "ai" ? "CEO AI" : "Support Agent"}</div>
          <div style={{ ...headerSub, color: isClosed ? "#f87171" : mode === "ai" ? GOLD : "#6ee7a8" }}>
            {isClosed ? "Chat closed" : mode === "ai" ? "Assistant online" : "Agent connected"}
          </div>
        </div>
        <button type="button" style={powerBtn} onClick={() => void endChat()} aria-label="End chat" title="End chat">
          ⌁
        </button>
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
                marginBottom: 12,
                animation: "ceoScBubble 0.28s ease-out both",
              }}
            >
              <div
                style={{
                  maxWidth: "84%",
                  padding: "12px 14px",
                  borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: mine ? GOLD : CARD,
                  color: mine ? "#0a0a0a" : "#ececec",
                  border: mine ? "none" : `1px solid ${BORDER}`,
                }}
              >
                {!mine && (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.4,
                      color: isAi ? GOLD : "#8ab4ff",
                      marginBottom: 4,
                    }}
                  >
                    {isAi ? "CEO AI" : "Agent"}
                  </div>
                )}
                <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.message}</div>
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 6,
                    textAlign: "right",
                    color: mine ? "rgba(0,0,0,0.4)" : "#666",
                  }}
                >
                  {m.created_at
                    ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : ""}
                </div>
              </div>
            </div>
          );
        })}

        {aiTyping && !isClosed && <div style={typingLine}>CEO AI is typing…</div>}
        {agentTyping && !isClosed && (
          <div style={{ ...typingLine, color: "#8ab4ff" }}>Agent is typing…</div>
        )}
        {error && <div style={errBox}>{error}</div>}

        {isClosed && (
          <div style={closedBanner}>
            This chat has ended. Start a new conversation from Support anytime.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!isClosed ? (
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
            placeholder={mode === "ai" ? "Drop your question here" : "Message agent…"}
          />
          <button
            type="button"
            style={{
              ...sendBtn,
              opacity: !draft.trim() || sending ? 0.4 : 1,
            }}
            disabled={!draft.trim() || sending}
            onClick={() => void sendMessage()}
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      ) : (
        <div style={composerClosed}>
          <button
            type="button"
            style={startBtn}
            onClick={() => {
              setClosedLocal(false);
              setTicket(null);
              setMessages([]);
              setScreen("welcome");
            }}
          >
            New chat
          </button>
        </div>
      )}
    </div>
  );
}

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: BG,
  display: "flex",
  flexDirection: "column",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  color: "#f5f5f5",
};

const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  paddingTop: "calc(10px + env(safe-area-inset-top))",
  borderBottom: "1px solid #141414",
};

const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: "#ccc",
  fontSize: 20,
  cursor: "pointer",
};

const powerBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: "1px solid #2a2110",
  borderRadius: 12,
  background: "#14100a",
  color: GOLD,
  fontSize: 18,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const headerCenter: React.CSSProperties = {
  flex: 1,
  textAlign: "center",
};

const headerTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: "#f5f5f5",
};

const headerSub: React.CSSProperties = {
  fontSize: 11,
  color: MUTED,
  marginTop: 2,
};

const welcomeBody: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 24px calc(32px + env(safe-area-inset-bottom))",
  textAlign: "center",
};

const botAvatarWrap: React.CSSProperties = {
  marginBottom: 16,
};

const botAvatar: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  background: "linear-gradient(145deg,#1a1508,#0a0a0a)",
  border: `2px solid ${GOLD}`,
  color: GOLD,
  fontWeight: 900,
  fontSize: 22,
  display: "grid",
  placeItems: "center",
  margin: "0 auto",
  animation: "ceoScGlow 2.4s ease-in-out infinite",
};

const welcomeTitle: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 22,
  fontWeight: 800,
  color: "#fff",
};

const welcomeSub: React.CSSProperties = {
  margin: "0 0 18px",
  fontSize: 13,
  color: MUTED,
};

const welcomeLine: React.CSSProperties = {
  margin: "0 0 28px",
  fontSize: 14,
  color: "#bbb",
  lineHeight: 1.45,
};

const startBtn: React.CSSProperties = {
  width: "100%",
  maxWidth: 340,
  minHeight: 50,
  border: 0,
  borderRadius: 28,
  background: "linear-gradient(135deg,#e8a90f,#f5b51b)",
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const gateBody: React.CSSProperties = {
  flex: 1,
  padding: "28px 20px",
  animation: "ceoScIn 0.32s ease-out both",
};

const gatePrompt: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#f0f0f0",
  marginBottom: 16,
};

const gateInput: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: "0 16px",
  fontSize: 16,
  outline: "none",
  marginBottom: 16,
  boxSizing: "border-box",
};

const chatBody: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 14px",
};

const typingLine: React.CSSProperties = {
  color: GOLD,
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 8,
  animation: "ceoScPulse 1.1s ease-in-out infinite",
};

const closedBanner: React.CSSProperties = {
  marginTop: 12,
  padding: "14px 16px",
  borderRadius: 14,
  background: "#1a1010",
  border: "1px solid #3a2020",
  color: "#ffb4b4",
  fontSize: 13,
  textAlign: "center",
  lineHeight: 1.4,
};

const composer: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  padding: "10px 12px",
  paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
  borderTop: "1px solid #141414",
  background: "#050505",
};

const composerClosed: React.CSSProperties = {
  padding: "12px 16px calc(16px + env(safe-area-inset-bottom))",
  borderTop: "1px solid #141414",
};

const composerInput: React.CSSProperties = {
  flex: 1,
  minHeight: 46,
  borderRadius: 24,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: "0 18px",
  fontSize: 14,
  outline: "none",
};

const sendBtn: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: "50%",
  border: 0,
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  flexShrink: 0,
};

const errBox: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "#1d0c0e",
  border: "1px solid #4c2025",
  color: "#ff9aa3",
  fontSize: 12,
  marginBottom: 12,
  textAlign: "left",
};
