import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  formatTradeStatus,
  P2P_RPC,
  P2P_TABLE,
  p2pTradeErrorMessage,
  type P2PTrade,
  type P2PTradeMessage,
} from "../../lib/p2p-types";

type Props = {
  tradeId: string;
  userId: string | null;
  onBack: () => void;
};

function fmt(v: unknown, d = 4): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

function msgText(m: P2PTradeMessage): string {
  return String(m.body ?? m.content ?? m.message ?? "");
}

/**
 * Trade detail + lifecycle actions.
 * Reads p2p_trades + p2p_trade_messages under RLS.
 * Actions call candidate RPCs; backend remains authoritative.
 * Never fakes success if the RPC name/signature does not match the live backend.
 */
export default function P2PTradeDetail({ tradeId, userId, onBack }: Props) {
  const [trade, setTrade] = useState<P2PTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [messages, setMessages] = useState<P2PTradeMessage[]>([]);
  const [msgDraft, setMsgDraft] = useState("");
  const [msgError, setMsgError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadTrade = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from(P2P_TABLE.trades)
      .select("*")
      .eq("id", tradeId)
      .maybeSingle();

    setLoading(false);
    if (err) {
      setError(err.message);
      setTrade(null);
      return;
    }
    if (!data) {
      setError("Trade not found or you do not have access.");
      setTrade(null);
      return;
    }
    setTrade(data as P2PTrade);
  }, [tradeId]);

  const loadMessages = useCallback(async () => {
    const { data, error: err } = await supabase
      .from(P2P_TABLE.messages)
      .select("*")
      .eq("trade_id", tradeId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (err) {
      // Table may not exist yet under this name — soft-fail chat only
      setMsgError(err.message);
      setMessages([]);
      return;
    }
    setMsgError("");
    setMessages((data || []) as P2PTradeMessage[]);
  }, [tradeId]);

  useEffect(() => {
    void loadTrade();
    void loadMessages();
  }, [loadTrade, loadMessages]);

  useEffect(() => {
    const ch = supabase
      .channel(`p2p-trade-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: P2P_TABLE.trades,
          filter: `id=eq.${tradeId}`,
        },
        () => {
          void loadTrade();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: P2P_TABLE.messages,
          filter: `trade_id=eq.${tradeId}`,
        },
        () => {
          void loadMessages();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [tradeId, loadTrade, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const status = (trade?.status || "").toLowerCase();
  const isBuyer = !!(userId && trade?.buyer_id && String(trade.buyer_id) === userId);
  const isSeller = !!(userId && trade?.seller_id && String(trade.seller_id) === userId);

  // Heuristic eligibility — backend still enforces
  const canMarkPaid =
    isBuyer &&
    ["pending", "waiting_for_payment", "waiting payment", "open", "created"].some(
      (s) => status.includes(s.replace(/ /g, "_")) || status === s,
    );
  const canRelease =
    isSeller &&
    ["paid", "payment_submitted", "payment submitted", "waiting_release"].some(
      (s) => status.includes(s.replace(/ /g, "_")) || status === s,
    );
  const canCancel =
    !!userId &&
    !["completed", "cancelled", "canceled", "expired", "disputed", "resolved"].some(
      (s) => status.includes(s),
    );
  const canDispute =
    !!userId &&
    !["completed", "cancelled", "canceled", "expired"].some((s) => status.includes(s)) &&
    !status.includes("disputed");

  const runRpc = async (name: string, args: Record<string, unknown>) => {
    setActionBusy(true);
    setActionError("");
    const { error: err } = await supabase.rpc(name, args);
    setActionBusy(false);
    if (err) {
      setActionError(p2pTradeErrorMessage(err.message, "buy"));
      return false;
    }
    await loadTrade();
    return true;
  };

  const onMarkPaid = () =>
    void runRpc(P2P_RPC.markPaid, { p_trade_id: tradeId });
  const onRelease = () =>
    void runRpc(P2P_RPC.sellerRelease, { p_trade_id: tradeId });
  const onCancel = () =>
    void runRpc(P2P_RPC.cancelTrade, { p_trade_id: tradeId });
  const onDispute = () => {
    const reason = window.prompt("Dispute reason");
    if (reason == null || !reason.trim()) return;
    void runRpc(P2P_RPC.openDispute, {
      p_trade_id: tradeId,
      p_reason: reason.trim(),
    });
  };

  const sendMessage = async () => {
    const body = msgDraft.trim();
    if (!body || !userId) return;
    setMsgError("");
    // Prefer RPC if backend requires it; fall back to insert under RLS
    const { error: rpcErr } = await supabase.rpc(P2P_RPC.sendMessage, {
      p_trade_id: tradeId,
      p_message: body,
    });
    if (!rpcErr) {
      setMsgDraft("");
      await loadMessages();
      return;
    }
    // Fallback: direct insert (trade-scoped RLS must allow)
    const { error: insErr } = await supabase.from(P2P_TABLE.messages).insert({
      trade_id: tradeId,
      sender_id: userId,
      body,
    });
    if (insErr) {
      setMsgError(
        rpcErr.message + (insErr ? ` / ${insErr.message}` : ""),
      );
      return;
    }
    setMsgDraft("");
    await loadMessages();
  };

  return (
    <div className="p2p-page">
      <div className="p2p-shell">
        <header className="p2p-header">
          <button type="button" className="p2p-back" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div className="p2p-header-title">Trade</div>
          <div style={{ width: 36 }} />
        </header>

        {loading ? (
          <div className="p2p-loading">Loading trade…</div>
        ) : error ? (
          <div className="p2p-empty" style={{ padding: 24 }}>
            <div style={{ color: "#ff9aa6" }}>{error}</div>
          </div>
        ) : trade ? (
          <div style={{ padding: "12px 12px 80px", overflowY: "auto", flex: 1 }}>
            <div style={{ fontSize: 13, color: "#848e9c", marginBottom: 8 }}>
              Status
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {formatTradeStatus(trade.status)}
            </div>

            <div className="p2p-panel-row">
              <span>Trade ID</span>
              <b style={{ fontFamily: "monospace", fontSize: 11 }}>{trade.id}</b>
            </div>
            {trade.asset != null && (
              <div className="p2p-panel-row">
                <span>Asset</span>
                <b>{String(trade.asset)}</b>
              </div>
            )}
            {trade.crypto_amount != null && (
              <div className="p2p-panel-row">
                <span>Crypto</span>
                <b>
                  {fmt(trade.crypto_amount)} {String(trade.asset || "")}
                </b>
              </div>
            )}
            {trade.price != null && (
              <div className="p2p-panel-row">
                <span>Price</span>
                <b>
                  {fmt(trade.price, 4)} {String(trade.fiat_currency || "")}
                </b>
              </div>
            )}
            {trade.fiat_amount != null && (
              <div className="p2p-panel-row">
                <span>Fiat</span>
                <b>
                  {fmt(trade.fiat_amount, 2)} {String(trade.fiat_currency || "")}
                </b>
              </div>
            )}
            {trade.payment_method != null && (
              <div className="p2p-panel-row">
                <span>Payment</span>
                <b>{String(trade.payment_method)}</b>
              </div>
            )}
            {trade.expires_at != null && (
              <div className="p2p-panel-row">
                <span>Expires</span>
                <b>{new Date(String(trade.expires_at)).toLocaleString()}</b>
              </div>
            )}
            {isBuyer && (
              <div className="p2p-rep">You are the buyer on this trade.</div>
            )}
            {isSeller && (
              <div className="p2p-rep">You are the seller on this trade.</div>
            )}

            {actionError && (
              <div className="p2p-panel-error" style={{ marginTop: 12 }}>
                {actionError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              {canMarkPaid && (
                <button
                  type="button"
                  className="p2p-submit buy"
                  disabled={actionBusy}
                  onClick={onMarkPaid}
                >
                  {actionBusy ? "…" : "I have paid"}
                </button>
              )}
              {canRelease && (
                <button
                  type="button"
                  className="p2p-submit buy"
                  disabled={actionBusy}
                  onClick={onRelease}
                >
                  {actionBusy ? "…" : "Release crypto"}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  className="p2p-done-btn"
                  disabled={actionBusy}
                  onClick={onCancel}
                >
                  Cancel trade
                </button>
              )}
              {canDispute && (
                <button
                  type="button"
                  className="p2p-done-btn"
                  disabled={actionBusy}
                  onClick={onDispute}
                  style={{ color: "#f6465d" }}
                >
                  Open dispute
                </button>
              )}
            </div>

            {/* Trade-scoped chat */}
            <div style={{ marginTop: 24, borderTop: "1px solid #1a1a1a", paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Messages</div>
              {msgError && (
                <div className="p2p-rep" style={{ color: "#ff9aa6" }}>
                  Chat: {msgError}
                </div>
              )}
              <div
                style={{
                  maxHeight: 220,
                  overflowY: "auto",
                  background: "#0a0a0a",
                  borderRadius: 8,
                  padding: 8,
                  border: "1px solid #1a1a1a",
                }}
              >
                {!messages.length && !msgError && (
                  <div className="p2p-rep">No messages yet.</div>
                )}
                {messages.map((m) => {
                  const mine = userId && String(m.sender_id) === userId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: 8,
                        textAlign: mine ? "right" : "left",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          background: mine ? "#1a2a1a" : "#1a1a1a",
                          color: "#eaecef",
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontSize: 13,
                          maxWidth: "85%",
                        }}
                      >
                        {msgText(m)}
                      </span>
                      <div style={{ fontSize: 10, color: "#5e6673", marginTop: 2 }}>
                        {m.created_at
                          ? new Date(m.created_at).toLocaleTimeString()
                          : ""}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  className="p2p-input"
                  style={{ flex: 1 }}
                  value={msgDraft}
                  onChange={(e) => setMsgDraft(e.target.value)}
                  placeholder="Message (this trade only)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendMessage();
                  }}
                />
                <button
                  type="button"
                  className="p2p-sheet-ok"
                  style={{ border: 0, borderRadius: 8, padding: "0 14px", fontWeight: 700 }}
                  onClick={() => void sendMessage()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
