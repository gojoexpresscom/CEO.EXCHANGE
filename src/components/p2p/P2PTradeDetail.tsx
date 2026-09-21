import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onOpenMerchant?: (merchantUserId: string) => void;
};

const CANCEL_REASONS = [
  "I no longer want to trade.",
  "I do not meet the counterparty's trading requirements.",
  "I do not want to provide personal information to the seller.",
  "Verification failed.",
  "The seller made additional requests.",
  "The seller has a poor service attitude.",
  "Other reasons.",
] as const;

const MESSAGE_TABLES = [P2P_TABLE.messages, "p2p_messages", "trade_messages"] as const;

const css = `
.ptd-page{min-height:100vh;min-height:100dvh;background:#0a0a0a;color:#eaecef;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}
.ptd-head{display:flex;align-items:center;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));gap:8px}
.ptd-back{width:36px;height:36px;border:0;background:transparent;color:#eaecef;font-size:20px;cursor:pointer}
.ptd-title{flex:1;font-size:17px;font-weight:700}
.ptd-link{border:0;background:transparent;color:#848e9c;font-size:13px;cursor:pointer}
.ptd-body{flex:1;overflow-y:auto;padding:8px 14px 110px}
.ptd-hint{font-size:12px;color:#848e9c;margin-bottom:10px}
.ptd-hint em{color:#f6465d;font-style:normal;font-weight:600}
.ptd-merchant{display:flex;align-items:center;gap:10px;background:#141414;border:1px solid #222;border-radius:12px;padding:10px 12px;margin-bottom:14px}
.ptd-av{width:32px;height:32px;border-radius:50%;background:#1a160e;border:1px solid #3d3420;color:#f0b90b;display:grid;place-items:center;font-size:11px;font-weight:800}
.ptd-mname{font-size:13px;font-weight:600;flex:1}
.ptd-contact{border:0;border-radius:20px;background:#f0b90b;color:#0a0a0a;font-weight:700;font-size:12px;padding:8px 14px;cursor:pointer}
.ptd-pair{font-weight:700;margin-bottom:10px}
.ptd-row{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:6px 0;color:#848e9c}
.ptd-row b{color:#eaecef;font-weight:600;text-align:right;word-break:break-all}
.ptd-sep{height:1px;background:#1a1a1a;margin:8px 0}
.ptd-terms{font-size:12px;color:#5e6673;line-height:1.55;margin-top:12px}
.ptd-foot{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#0a0a0a;border-top:1px solid #1a1a1a;padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:flex;justify-content:center}
.ptd-foot-in{width:100%;max-width:480px;display:flex;flex-direction:column;gap:8px}
.ptd-primary{border:0;border-radius:24px;padding:14px;background:#f0b90b;color:#0a0a0a;font-weight:800;font-size:15px;cursor:pointer}
.ptd-primary:disabled{opacity:.45;cursor:not-allowed}
.ptd-ghost{border:1px solid #2a2a2a;border-radius:24px;padding:12px;background:transparent;color:#eaecef;font-weight:600;font-size:14px;cursor:pointer}
.ptd-textbtn{border:0;background:transparent;color:#f0b90b;font-size:12px;cursor:pointer;padding:4px}
.ptd-err{border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:8px;padding:10px;font-size:12px;margin:8px 0}
.ptd-sheet-bg{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.ptd-sheet{width:100%;max-width:480px;background:#121212;border-radius:16px 16px 0 0;border:1px solid #2a2a2a;border-bottom:0;padding:16px 16px 24px;max-height:85vh;overflow-y:auto;box-sizing:border-box}
.ptd-sheet-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.ptd-sheet-t{font-size:16px;font-weight:700}
.ptd-dos{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.ptd-dont,.ptd-do{border-radius:10px;padding:12px;font-size:11px;line-height:1.45}
.ptd-dont{background:#2a1216;color:#ff9aa6}
.ptd-do{background:#0d1f18;color:#0ecb81}
.ptd-radio{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid #1a1a1a;cursor:pointer;font-size:13px}
.ptd-bubble{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.45;margin-bottom:8px}
.ptd-bubble.me{margin-left:auto;background:#1a2a1a}
.ptd-bubble.them{margin-right:auto;background:#1a1a1a}
.ptd-inputbar{display:flex;gap:8px;align-items:center;padding-top:8px;border-top:1px solid #1a1a1a}
.ptd-input{flex:1;border:1px solid #2a2a2a;background:#141414;border-radius:20px;padding:10px 14px;color:#eaecef;font-size:13px}
.ptd-send{border:0;width:40px;height:40px;border-radius:50%;background:#f0b90b;color:#0a0a0a;font-weight:800;cursor:pointer}
.ptd-banner{background:#2a2410;border:1px solid #3d3420;color:#f0b90b;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;margin-bottom:12px}
`;

function fmt(v: unknown, d = 4): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}
function msgText(m: P2PTradeMessage): string {
  return String(m.body ?? m.content ?? m.message ?? "");
}

export default function P2PTradeDetail({ tradeId, userId, onBack, onOpenMerchant }: Props) {
  const [trade, setTrade] = useState<P2PTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"order" | "chat" | "cancelWarn" | "cancelReason">("order");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAck, setCancelAck] = useState(false);
  const [messages, setMessages] = useState<P2PTradeMessage[]>([]);
  const [msgTable, setMsgTable] = useState<string | null>(null);
  const [msgAvailable, setMsgAvailable] = useState<boolean | null>(null);
  const [msgDraft, setMsgDraft] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadTrade = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.from(P2P_TABLE.trades).select("*").eq("id", tradeId).maybeSingle();
    setLoading(false);
    if (err) { setError(err.message); setTrade(null); return; }
    if (!data) { setError("Trade not found or you do not have access."); setTrade(null); return; }
    setTrade(data as P2PTrade);
  }, [tradeId]);

  const loadMessages = useCallback(async () => {
    for (const table of MESSAGE_TABLES) {
      const { data, error: err } = await supabase.from(table).select("*").eq("trade_id", tradeId).order("created_at", { ascending: true }).limit(200);
      if (!err) {
        setMsgTable(table);
        setMsgAvailable(true);
        setMessages((data || []) as P2PTradeMessage[]);
        return;
      }
    }
    setMsgAvailable(false);
    setMessages([]);
  }, [tradeId]);

  useEffect(() => { void loadTrade(); void loadMessages(); }, [loadTrade, loadMessages]);

  useEffect(() => {
    const ch = supabase.channel(`p2p-trade-${tradeId}`).on("postgres_changes", { event: "*", schema: "public", table: P2P_TABLE.trades, filter: `id=eq.${tradeId}` }, () => void loadTrade()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tradeId, loadTrade]);

  useEffect(() => {
    if (!msgTable) return;
    const ch = supabase.channel(`p2p-msg-${tradeId}`).on("postgres_changes", { event: "*", schema: "public", table: msgTable, filter: `trade_id=eq.${tradeId}` }, () => void loadMessages()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tradeId, msgTable, loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, view]);

  const status = (trade?.status || "").toLowerCase();
  const isBuyer = !!(userId && trade?.buyer_id && String(trade.buyer_id) === userId);
  const isSeller = !!(userId && trade?.seller_id && String(trade.seller_id) === userId);
  const merchantId = isBuyer ? trade?.seller_id : isSeller ? trade?.buyer_id : trade?.seller_id || trade?.buyer_id;
  const canMarkPaid = isBuyer && /pending|waiting|open|created|payment/.test(status) && !/paid|completed|cancel|disput|expir/.test(status);
  const canRelease = isSeller && /paid|submitted|waiting_release|release/.test(status);
  const canCancel = !!userId && !/completed|cancel|expir|resolved/.test(status);
  const canDispute = !!userId && !/completed|cancel|expir/.test(status) && !/disput/.test(status);
  const cancelled = /cancel/.test(status);

  const countdown = useMemo(() => {
    const exp = trade?.expires_at ? new Date(String(trade.expires_at)).getTime() : null;
    if (!exp || !Number.isFinite(exp)) return null;
    const left = Math.max(0, Math.floor((exp - now) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  }, [trade?.expires_at, now]);

  const runRpc = async (name: string, args: Record<string, unknown>) => {
    setBusy(true); setActionError("");
    const { error: err } = await supabase.rpc(name, args);
    setBusy(false);
    if (err) { setActionError(p2pTradeErrorMessage(err.message, "buy")); return false; }
    await loadTrade();
    return true;
  };

  const sendMessage = async () => {
    const body = msgDraft.trim();
    if (!body || !userId || msgSending) return;
    setMsgSending(true); setActionError("");
    const { error: rpcErr } = await supabase.rpc(P2P_RPC.sendMessage, { p_trade_id: tradeId, p_message: body });
    if (!rpcErr) { setMsgDraft(""); setMsgSending(false); await loadMessages(); return; }
    if (msgTable) {
      const { error: insErr } = await supabase.from(msgTable).insert({ trade_id: tradeId, sender_id: userId, body });
      setMsgSending(false);
      if (insErr) { setActionError("Could not send message. Please try again."); return; }
      setMsgDraft(""); await loadMessages(); return;
    }
    setMsgSending(false);
    setActionError("Trade chat is not available for this order yet.");
  };

  const confirmCancel = async () => {
    if (!cancelReason || !cancelAck) return;
    const ok = await runRpc(P2P_RPC.cancelTrade, { p_trade_id: tradeId, p_reason: cancelReason });
    if (ok) setView("order");
  };

  if (loading) {
    return (<div className="ptd-page"><style>{css}</style><div className="ptd-head"><button type="button" className="ptd-back" onClick={onBack}>←</button><div className="ptd-title">Order</div></div><div style={{ padding: 24, color: "#5e6673", textAlign: "center" }}>Loading order…</div></div>);
  }
  if (error || !trade) {
    return (<div className="ptd-page"><style>{css}</style><div className="ptd-head"><button type="button" className="ptd-back" onClick={onBack}>←</button><div className="ptd-title">Order</div></div><div className="ptd-err" style={{ margin: 16 }}>{error || "Order unavailable"}</div></div>);
  }

  const asset = String(trade.asset || "—");
  const fiat = String(trade.fiat_currency || "");
  const statusLabel = formatTradeStatus(trade.status);

  if (view === "chat") {
    return (
      <div className="ptd-page"><style>{css}</style>
        <div className="ptd-head"><button type="button" className="ptd-back" onClick={() => setView("order")}>←</button><div className="ptd-title">Trade chat</div></div>
        <div className="ptd-body">
          {msgAvailable === false && <div className="ptd-banner">Trade chat is not available on this environment yet. Order actions still work from the order screen.</div>}
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {msgAvailable && messages.length === 0 && <div style={{ color: "#5e6673", fontSize: 13, textAlign: "center" }}>No messages yet.</div>}
            {messages.map((m) => {
              const mine = !!(userId && String(m.sender_id) === userId);
              return (<div key={m.id}><div className={`ptd-bubble ${mine ? "me" : "them"}`}>{msgText(m)}</div></div>);
            })}
            <div ref={bottomRef} />
          </div>
          {actionError && <div className="ptd-err">{actionError}</div>}
          <div className="ptd-inputbar">
            <input className="ptd-input" value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} placeholder="Enter your message" onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(); }} />
            <button type="button" className="ptd-send" disabled={msgSending || !msgDraft.trim()} onClick={() => void sendMessage()}>➤</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "cancelReason") {
    return (
      <div className="ptd-page"><style>{css}</style>
        <div className="ptd-head"><button type="button" className="ptd-back" onClick={() => setView("cancelWarn")}>←</button><div className="ptd-title">Cancel Order</div></div>
        <div className="ptd-body">
          <div className="ptd-banner">The cancellation reason can only be selected once. It may affect completion statistics.</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Please select a reason for cancellation.</div>
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="ptd-radio"><input type="radio" name="cr" checked={cancelReason === r} onChange={() => setCancelReason(r)} /><span>{r}</span></label>
          ))}
          <label className="ptd-radio" style={{ borderBottom: 0, marginTop: 12 }}>
            <input type="checkbox" checked={cancelAck} onChange={(e) => setCancelAck(e.target.checked)} />
            <span>I have not paid the seller / have received seller&apos;s refund</span>
          </label>
          {actionError && <div className="ptd-err">{actionError}</div>}
        </div>
        <div className="ptd-foot"><div className="ptd-foot-in">
          <button type="button" className="ptd-primary" disabled={!cancelReason || !cancelAck || busy} onClick={() => void confirmCancel()}>{busy ? "…" : "Confirm"}</button>
        </div></div>
      </div>
    );
  }

  return (
    <div className="ptd-page"><style>{css}</style>
      <div className="ptd-head">
        <button type="button" className="ptd-back" onClick={onBack}>←</button>
        <div className="ptd-title">{statusLabel}</div>
        {canCancel && !cancelled && <button type="button" className="ptd-link" onClick={() => setView("cancelWarn")}>Cancel Order</button>}
      </div>
      <div className="ptd-body">
        {!cancelled && countdown && <div className="ptd-hint">Complete this step in time or the order may be canceled. <em>{countdown}</em></div>}
        {cancelled && <div className="ptd-banner">This order has concluded. Assets are no longer locked by escrow.</div>}
        <div className="ptd-merchant">
          <div className="ptd-av" onClick={() => merchantId && onOpenMerchant?.(String(merchantId))} role="button">ME</div>
          <div className="ptd-mname" onClick={() => merchantId && onOpenMerchant?.(String(merchantId))} role="button">Counterparty</div>
          <button type="button" className="ptd-contact" onClick={() => setView("chat")}>Contact Seller</button>
        </div>
        <div className="ptd-pair">{isBuyer ? "Buy" : isSeller ? "Sell" : "Trade"} {asset}{fiat ? `/${fiat}` : ""}</div>
        <div className="ptd-row"><span>Amount</span><b>{fmt(trade.fiat_amount ?? (Number(trade.crypto_amount) || 0) * (Number(trade.price) || 0), 2)} {fiat}</b></div>
        <div className="ptd-row"><span>Price</span><b>{fmt(trade.price, 4)} {fiat}</b></div>
        <div className="ptd-row"><span>Total Quantity</span><b>{fmt(trade.crypto_amount, 6)} {asset}</b></div>
        <div className="ptd-row"><span>Transaction Fees</span><b>0 {asset}</b></div>
        <div className="ptd-row"><span>Order No.</span><b style={{ fontFamily: "monospace", fontSize: 11 }}>{trade.id}</b></div>
        <div className="ptd-row"><span>Order Time</span><b>{trade.created_at ? new Date(String(trade.created_at)).toLocaleString() : "—"}</b></div>
        <div className="ptd-sep" />
        <div className="ptd-row"><span>Payment Method</span><b>{trade.payment_method ? String(trade.payment_method) : /paid|completed/.test(status) ? "—" : "Display after verification"}</b></div>
        <div className="ptd-terms"><div style={{ fontWeight: 600, color: "#eaecef", marginBottom: 4 }}>Advertiser Terms</div>Keep all payment communication inside this order. Only release crypto or mark paid after you have verified the real transfer for this trade.</div>
        {actionError && <div className="ptd-err">{actionError}</div>}
      </div>
      <div className="ptd-foot"><div className="ptd-foot-in">
        {canMarkPaid && <button type="button" className="ptd-primary" disabled={busy} onClick={() => void runRpc(P2P_RPC.markPaid, { p_trade_id: tradeId })}>{busy ? "…" : "Payment sent"}</button>}
        {canRelease && <button type="button" className="ptd-primary" disabled={busy} onClick={() => void runRpc(P2P_RPC.sellerRelease, { p_trade_id: tradeId })}>{busy ? "…" : "Release crypto"}</button>}
        {canDispute && <button type="button" className={cancelled ? "ptd-ghost" : "ptd-textbtn"} onClick={() => { const reason = window.prompt("Dispute reason"); if (!reason?.trim()) return; void runRpc(P2P_RPC.openDispute, { p_trade_id: tradeId, p_reason: reason.trim() }); }}>{cancelled ? "Order Dispute?" : "Open dispute"}</button>}
        <button type="button" className="ptd-textbtn" onClick={() => setView("chat")}>I have a question</button>
      </div></div>
      {view === "cancelWarn" && (
        <div className="ptd-sheet-bg" onClick={() => setView("order")}>
          <div className="ptd-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ptd-sheet-h"><div className="ptd-sheet-t">Cancel Order</div><button type="button" className="ptd-link" onClick={() => setView("order")}>×</button></div>
            <div className="ptd-dos">
              <div className="ptd-dont"><div style={{ fontWeight: 700, marginBottom: 6 }}>Don&apos;ts</div><div>• Don&apos;t cancel after you have already paid</div><div>• Don&apos;t pay if payment details look wrong</div><div>• Don&apos;t trust off-platform promises</div></div>
              <div className="ptd-do"><div style={{ fontWeight: 700, marginBottom: 6 }}>Dos</div><div>• Select the correct cancellation reason</div><div>• Communicate only in the order chat</div><div>• Understand the process before trading</div></div>
            </div>
            <div style={{ fontSize: 12, color: "#848e9c", marginBottom: 12 }}>Repeated cancellations may affect your ability to place new P2P orders under platform rules.</div>
            <button type="button" className="ptd-primary" style={{ width: "100%" }} onClick={() => { setCancelReason(""); setCancelAck(false); setView("cancelReason"); }}>Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}
