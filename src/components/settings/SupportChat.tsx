import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT, BORDER } from "./settingsStyles";
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

  const shortId = ticketId ? ticketId.replace(/-/g, "").slice(0, 8).toUpperCase() : "—";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: "#050505",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Force visible text in inputs (fixes iOS/Android autofill / dark-mode fill) */}
      <style>{`
        .ceo-chat-input, .ceo-chat-input::placeholder {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: ${GOLD};
        }
        .ceo-chat-input::placeholder {
          color: #777 !important;
          -webkit-text-fill-color: #777 !important;
          opacity: 1;
        }
        .ceo-chat-bubble-mine { color: #fff !important; }
        .ceo-chat-bubble-other { color: #f0f0f0 !important; }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          borderBottom: "1px solid #1a1a1a",
          flexShrink: 0,
          background: "#0a0a0a",
        }}
      >
        <button
          type="button"
          style={{ ...s.headerBtn, color: GOLD }}
          onClick={onClose}
          aria-label="Back"
        >
          <SIcon name="back" size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>CEO Exchange Support</div>
          <div style={{ color: "#888", fontSize: 11 }}>
            {closed ? "Chat ended" : "Live Support"} · Ticket #{shortId}
          </div>
        </div>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: closed ? "#666" : "#39d98a",
            flexShrink: 0,
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 8px",
          WebkitOverflowScrolling: "touch",
          background: "#050505",
        }}
      >
        {loading && <p style={{ color: "#777", textAlign: "center" }}>Opening chat…</p>}
        {error && <div style={s.errorBox}>{error}</div>}

        {!loading && messages.length === 0 && !closed && (
          <div style={{ ...s.infoBox, textAlign: "center" as const }}>
            Waiting for an agent… You can send a message anytime.
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
                marginBottom: 10,
              }}
            >
              <div
                className={mine ? "ceo-chat-bubble-mine" : "ceo-chat-bubble-other"}
                style={{
                  maxWidth: "82%",
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: mine ? "#1a1508" : "#161616",
                  border: mine ? `1px solid ${GOLD}` : "1px solid #2a2a2a",
                  color: "#fff",
                  fontSize: 14,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap" as const,
                  wordBreak: "break-word" as const,
                }}
              >
                {m.message}
                <div style={{ color: "#888", fontSize: 10, marginTop: 6 }}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div style={{ padding: 14, paddingBottom: "calc(14px + env(safe-area-inset-bottom))", background: "#0a0a0a" }}>
          <div style={s.infoBox}>This conversation has ended.</div>
          <button
            type="button"
            style={s.primaryBtn}
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
          >
            Start a new chat
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            padding: "10px 12px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
            borderTop: "1px solid #1a1a1a",
            background: "#0a0a0a",
          }}
        >
          <textarea
            ref={inputRef}
            className="ceo-chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write your message…"
            rows={1}
            autoComplete="off"
            autoCorrect="on"
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 140,
              resize: "none",
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              background: "#101010",
              color: "#ffffff",
              WebkitTextFillColor: "#ffffff",
              caretColor: GOLD,
              padding: "12px 14px",
              fontSize: 16,
              lineHeight: 1.4,
              outline: 0,
              overflowY: "auto",
            }}
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={() => void send()}
            style={{
              width: 48,
              height: 44,
              border: 0,
              borderRadius: 12,
              background: `linear-gradient(135deg,${GOLD},#d98e00)`,
              color: "#090909",
              fontWeight: 800,
              cursor: sending || !text.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
              opacity: sending || !text.trim() ? 0.45 : 1,
              fontSize: 18,
            }}
            aria-label="Send"
          >
            {sending ? "…" : "➤"}
          </button>
        </div>
      )}
    </div>
  );
}
