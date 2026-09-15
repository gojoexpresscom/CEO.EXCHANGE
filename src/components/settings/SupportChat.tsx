import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { GOLD, GOLD_LIGHT, BORDER } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";

type Props = {
  userId: string;
  ticketId: string | null;
  contactName: string;
  contactEmail: string;
  onClose: () => void;
  onTicketCreated: (id: string) => void;
  notify: (msg: string) => void;
};

type Msg = {
  id: string;
  ticket_id: string | null;
  sender_id: string | null;
  message: string;
  created_at: string | null;
};

type Ticket = {
  id: string;
  status: string | null;
  closed_at: string | null;
  subject: string | null;
};

export default function SupportChat({
  userId,
  ticketId: initialTicketId,
  contactName,
  contactEmail,
  onClose,
  onTicketCreated,
  notify,
}: Props) {
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const loadTicket = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from("support_tickets")
      .select("id,status,closed_at,subject")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    setTicket((data as Ticket) ?? null);
    return data as Ticket | null;
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from("ticket_messages")
      .select("id,ticket_id,sender_id,message,created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    if (e) throw e;
    setMessages((data as Msg[]) ?? []);
    scrollBottom();
  }, []);

  useEffect(() => {
    let alive = true;
    async function init() {
      setLoading(true);
      setError("");
      try {
        let id = ticketId;
        if (!id) {
          const { data: existing } = await supabase
            .from("support_tickets")
            .select("id,status,closed_at,subject")
            .eq("user_id", userId)
            .in("status", ["open", "pending", "waiting", "active"])
            .is("closed_at", null)
            .order("last_activity_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing?.id) {
            id = existing.id;
            setTicketId(id);
            setTicket(existing as Ticket);
            onTicketCreated(id);
          } else {
            const { data: created, error: ce } = await supabase
              .from("support_tickets")
              .insert({
                user_id: userId,
                contact_name: contactName,
                contact_email: contactEmail,
                channel: "live_chat",
                subject: "Live chat",
                status: "open",
                last_activity_at: new Date().toISOString(),
              })
              .select("id,status,closed_at,subject")
              .single();
            if (ce) throw ce;
            id = created.id;
            setTicketId(id);
            setTicket(created as Ticket);
            onTicketCreated(id);
          }
        } else {
          await loadTicket(id);
        }
        if (id && alive) await loadMessages(id);
      } catch (e: any) {
        if (alive) setError(e?.message || "Could not open chat.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void init();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`ticket-msgs-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          scrollBottom();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${ticketId}` },
        (payload) => {
          setTicket(payload.new as Ticket);
        }
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void loadMessages(ticketId);
      void loadTicket(ticketId);
    }, 12000);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [ticketId, loadMessages, loadTicket]);

  const closed =
    ticket?.closed_at != null ||
    /closed|resolved|ended/i.test(ticket?.status || "");

  const send = async () => {
    const body = text.trim();
    if (!body || !ticketId || closed || sending) return;
    setSending(true);
    setError("");
    try {
      const { error: ie } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        sender_id: userId,
        message: body,
      });
      if (ie) throw ie;
      await supabase
        .from("support_tickets")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", ticketId);
      setText("");
      await loadMessages(ticketId);
      inputRef.current?.focus();
    } catch (e: any) {
      setError(e?.message || "Message couldn't be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const shortId = ticketId ? ticketId.replace(/-/g, "").slice(0, 8).toUpperCase() : "—";

  const ui = (
    <div
      role="dialog"
      aria-label="Live support chat"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        fontFamily: "inherit",
      }}
    >
      <style>{`
        .ceo-sc-input {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: ${GOLD};
        }
        .ceo-sc-input::placeholder {
          color: #6b6b6b !important;
          -webkit-text-fill-color: #6b6b6b !important;
          opacity: 1;
        }
        .ceo-sc-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .ceo-sc-send:not(:disabled):active {
          transform: scale(0.96);
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          borderBottom: "1px solid #141414",
          flexShrink: 0,
          background: "#050505",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            border: 0,
            borderRadius: 12,
            background: "transparent",
            color: "#f5f5f5",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <SIcon name="back" size={22} />
        </button>

        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: 0.2 }}>
            CEO Support
          </div>
          <div
            style={{
              color: closed ? "#888" : GOLD_LIGHT,
              fontSize: 11,
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            {closed ? "Chat ended" : "Agent online"}
            {!closed && ticketId ? ` · #${shortId}` : ""}
          </div>
        </div>

        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: "#0c0c0c",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
          aria-hidden
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: closed ? "#555" : "#39d98a",
              boxShadow: closed ? "none" : "0 0 8px rgba(57,217,138,0.6)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 16px 12px",
          WebkitOverflowScrolling: "touch",
          background: "#050505",
        }}
      >
        {loading && (
          <p style={{ color: "#666", textAlign: "center", marginTop: 40, fontSize: 14 }}>
            Connecting…
          </p>
        )}

        {error && (
          <div
            style={{
              border: "1px solid #4c2025",
              background: "#1d0c0e",
              color: "#ff9aa3",
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {!loading && messages.length === 0 && !closed && (
          <div style={{ textAlign: "center", marginTop: 48, padding: "0 24px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                margin: "0 auto 14px",
                background: "linear-gradient(135deg,#1a1508,#0d0d0d)",
                border: `1.5px solid ${BORDER}`,
                display: "grid",
                placeItems: "center",
                color: GOLD,
              }}
            >
              <SIcon name="headset" size={24} />
            </div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              How can we help?
            </div>
            <div style={{ color: "#777", fontSize: 13, lineHeight: 1.5 }}>
              An agent will join shortly. Send a message anytime.
            </div>
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  padding: "11px 14px",
                  borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: mine ? "linear-gradient(135deg,#2a2110,#1a1508)" : "#141414",
                  border: mine ? `1px solid ${BORDER}` : "1px solid #222",
                  color: "#fff",
                  fontSize: 15,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.message}
                <div
                  style={{
                    color: "#777",
                    fontSize: 10,
                    marginTop: 6,
                    textAlign: mine ? "right" : "left",
                  }}
                >
                  {m.created_at
                    ? new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div
          style={{
            padding: "14px 16px",
            paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
            borderTop: "1px solid #141414",
            background: "#050505",
          }}
        >
          <div
            style={{
              border: `1px solid ${BORDER}`,
              background: "#121108",
              color: "#c5b98d",
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            This conversation has ended.
          </div>
          <button
            type="button"
            onClick={() => {
              setTicketId(null);
              setTicket(null);
              setMessages([]);
              setLoading(true);
              window.setTimeout(() => {
                void (async () => {
                  try {
                    const { data: created, error: ce } = await supabase
                      .from("support_tickets")
                      .insert({
                        user_id: userId,
                        contact_name: contactName,
                        contact_email: contactEmail,
                        channel: "live_chat",
                        subject: "Live chat",
                        status: "open",
                        last_activity_at: new Date().toISOString(),
                      })
                      .select("id,status,closed_at,subject")
                      .single();
                    if (ce) throw ce;
                    setTicketId(created.id);
                    setTicket(created as Ticket);
                    onTicketCreated(created.id);
                    setLoading(false);
                  } catch (e: any) {
                    setError(e?.message || "Could not start a new chat.");
                    setLoading(false);
                  }
                })();
              }, 50);
            }}
            style={{
              width: "100%",
              minHeight: 48,
              border: 0,
              borderRadius: 12,
              background: `linear-gradient(135deg,${GOLD},#d98e00)`,
              color: "#090909",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Start a new chat
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            padding: "12px 14px",
            paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
            background: "#050505",
            borderTop: "1px solid #141414",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              background: "#101010",
              border: "1px solid #222",
              borderRadius: 24,
              padding: "4px 4px 4px 16px",
              minHeight: 48,
            }}
          >
            <textarea
              ref={inputRef}
              className="ceo-sc-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Drop your question here"
              rows={1}
              autoComplete="off"
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: "transparent",
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                caretColor: GOLD,
                fontSize: 16,
                lineHeight: 1.4,
                padding: "10px 8px 10px 0",
                resize: "none",
                maxHeight: 120,
                overflowY: "auto",
              }}
            />
          </div>
          <button
            type="button"
            className="ceo-sc-send"
            disabled={sending || !text.trim()}
            onClick={() => void send()}
            aria-label="Send"
            style={{
              width: 48,
              height: 48,
              border: 0,
              borderRadius: "50%",
              background: `linear-gradient(135deg,${GOLD},#d98e00)`,
              color: "#090909",
              fontWeight: 800,
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 14px rgba(245,181,27,0.25)",
              transition: "transform 0.12s ease",
            }}
          >
            {sending ? "…" : "➤"}
          </button>
        </div>
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(ui, document.body);
  }
  return ui;
}
