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

const MESSAGE_TABLES = [
  P2P_TABLE.messages, // p2p_messages
] as const;

const css = `
.ptd-page{min-height:100vh;min-height:100dvh;background:#0a0a0a;color:#eaecef;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}
.ptd-head{display:flex;align-items:center;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));gap:8px;flex-shrink:0}
.ptd-back{width:36px;height:36px;border:0;background:transparent;color:#eaecef;font-size:20px;cursor:pointer}
.ptd-title{flex:1;font-size:17px;font-weight:700}
.ptd-link{border:0;background:transparent;color:#848e9c;font-size:13px;cursor:pointer}
.ptd-body{flex:1;overflow-y:auto;padding:8px 14px;padding-bottom:calc(100px + env(safe-area-inset-bottom,0px))}
.ptd-hint{font-size:12px;color:#848e9c;margin-bottom:10px}
.ptd-hint em{color:#f6465d;font-style:normal;font-weight:600}
.ptd-merchant{display:flex;align-items:center;gap:10px;background:#141414;border:1px solid #222;border-radius:12px;padding:10px 12px;margin-bottom:14px}
.ptd-av{width:32px;height:32px;border-radius:50%;background:#1a160e;border:1px solid #3d3420;color:#f0b90b;display:grid;place-items:center;font-size:11px;font-weight:800}
.ptd-mname{font-size:13px;font-weight:600;flex:1;min-width:0}
.ptd-contact{border:0;border-radius:20px;background:#f0b90b;color:#0a0a0a;font-weight:700;font-size:12px;padding:8px 14px;cursor:pointer;flex-shrink:0}
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
.ptd-banner{background:#2a2410;border:1px solid #3d3420;color:#f0b90b;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;margin-bottom:12px}
/* Chat full-screen layout */
.chat-page{min-height:100vh;min-height:100dvh;background:#0a0a0a;color:#eaecef;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}
.chat-head{display:flex;align-items:center;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));gap:8px;flex-shrink:0;border-bottom:1px solid #1a1a1a}
.chat-msgs{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-height:0}
.chat-empty{flex:1;display:flex;align-items:center;justify-content:center;color:#5e6673;font-size:13px;text-align:center;padding:24px}
.chat-bubble{max-width:82%;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.45;word-break:break-word}
.chat-bubble.me{align-self:flex-end;background:#1a2a1a;border-bottom-right-radius:4px}
.chat-bubble.them{align-self:flex-start;background:#1a1a1a;border-bottom-left-radius:4px}
.chat-ts{font-size:10px;color:#5e6673;margin-top:4px}
.chat-composer{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #1a1a1a;background:#0a0a0a}
.chat-plus{width:36px;height:36px;border-radius:50%;border:1px solid #2a2a2a;background:#141414;color:#eaecef;font-size:20px;font-weight:500;cursor:pointer;display:grid;place-items:center;flex-shrink:0}
.chat-input{flex:1;border:1px solid #2a2a2a;background:#141414;border-radius:20px;padding:10px 14px;color:#eaecef;font-size:14px;outline:none;min-width:0}
.chat-send{width:36px;height:36px;border-radius:50%;border:0;background:#f0b90b;color:#0a0a0a;font-size:16px;font-weight:800;cursor:pointer;flex-shrink:0}
.chat-send:disabled{opacity:.4}
.chat-opt{width:100%;border:1px solid #2a2a2a;background:#141414;border-radius:10px;padding:14px;margin-bottom:8px;color:#eaecef;font-size:14px;font-weight:600;text-align:left;cursor:pointer}
.pay-box{background:#141414;border:1px solid #222;border-radius:12px;padding:12px;margin:10px 0}
.pay-box h4{margin:0 0 8px;font-size:13px;color:#f0b90b}
`;

function fmt(v: unknown, d = 4): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

function msgText(m: P2PTradeMessage): string {
  return String(m.body ?? m.content ?? m.message ?? "");
}

function field(t: P2PTrade, ...keys: string[]): string | null {
  const anyT = t as Record<string, unknown>;
  for (const k of keys) {
    const v = anyT[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

export default function P2PTradeDetail({
  tradeId,
  userId,
  onBack,
  onOpenMerchant,
}: Props) {
  const [trade, setTrade] = useState<P2PTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<
    "order" | "chat" | "cancelWarn" | "cancelReason"
  >("order");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAck, setCancelAck] = useState(false);
  const [messages, setMessages] = useState<P2PTradeMessage[]>([]);
  const [msgTable, setMsgTable] = useState<string | null>(null);
  const [msgAvailable, setMsgAvailable] = useState<boolean | null>(null);
  const [msgDraft, setMsgDraft] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [proofNote, setProofNote] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
    for (const table of MESSAGE_TABLES) {
      const { data, error: err } = await supabase
        .from(table)
        .select("*")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true })
        .limit(200);
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
        () => void loadTrade(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [tradeId, loadTrade]);

  useEffect(() => {
    if (!msgTable) return;
    const ch = supabase
      .channel(`p2p-msg-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: msgTable,
          filter: `trade_id=eq.${tradeId}`,
        },
        () => void loadMessages(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [tradeId, msgTable, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, view]);

  const status = (trade?.status || "").toLowerCase();
  const isBuyer = !!(
    userId &&
    trade?.buyer_id &&
    String(trade.buyer_id) === userId
  );
  const isSeller = !!(
    userId &&
    trade?.seller_id &&
    String(trade.seller_id) === userId
  );
  const merchantId = isBuyer
    ? trade?.seller_id
    : isSeller
      ? trade?.buyer_id
      : trade?.seller_id || trade?.buyer_id;
  const canSubmitProof =
    isBuyer &&
    /pending|waiting|open|created|payment/.test(status) &&
    !/paid|completed|cancel|disput|expir|proof/.test(status);
  const canRelease =
    isSeller && /paid|submitted|waiting_release|release|proof/.test(status);
  const canCancel = !!userId && !/completed|cancel|expir|resolved/.test(status);
  const canDispute =
    !!userId && !/completed|cancel|expir/.test(status) && !/disput/.test(status);
  const cancelled = /cancel/.test(status);

  const countdown = useMemo(() => {
    const exp = trade?.expires_at
      ? new Date(String(trade.expires_at)).getTime()
      : null;
    if (!exp || !Number.isFinite(exp)) return null;
    const left = Math.max(0, Math.floor((exp - now) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  }, [trade?.expires_at, now]);

  const runRpc = async (name: string, args: Record<string, unknown>) => {
    setBusy(true);
    setActionError("");
    const { error: err } = await supabase.rpc(name, args);
    setBusy(false);
    if (err) {
      setActionError(err.message || "Action failed");
      return false;
    }
    await loadTrade();
    return true;
  };

  const submitPaymentProof = async (extra?: {
    path?: string;
    reference?: string;
  }) => {
    setBusy(true);
    setActionError("");
    // Contract: submit_p2p_payment_proof(trade_id, path, reference)
    const args: Record<string, unknown> = {
      trade_id: tradeId,
      path: extra?.path ?? null,
      reference: extra?.reference ?? null,
    };
    let { error: err } = await supabase.rpc(P2P_RPC.submitPaymentProof, args);
    if (err && /argument|parameter|could not find/i.test(err.message)) {
      const alt = await supabase.rpc(P2P_RPC.submitPaymentProof, {
        p_trade_id: tradeId,
        p_path: extra?.path ?? null,
        p_reference: extra?.reference ?? null,
      });
      err = alt.error;
    }
    setBusy(false);
    if (err) {
      setActionError(err.message || "Could not submit payment proof");
      return false;
    }
    await loadTrade();
    return true;
  };

  const sendMessage = async () => {
    const body = msgDraft.trim();
    if (!body || !userId || msgSending) return;
    setMsgSending(true);
    setActionError("");
    // Real contract: direct insert into p2p_messages (no send_p2p_trade_message RPC)
    const table = msgTable || P2P_TABLE.messages;
    const row: Record<string, unknown> = {
      trade_id: tradeId,
      order_id: trade?.order_id ?? null,
      sender_id: userId,
      message: body,
    };
    const { error: insErr } = await supabase.from(table).insert(row);
    setMsgSending(false);
    if (insErr) {
      setActionError(insErr.message || "Could not send message");
      return;
    }
    setMsgDraft("");
    await loadMessages();
  };

  const uploadProofFile = async (file: File) => {
    if (!userId) return;
    setBusy(true);
    setActionError("");
    // Storage path: p2p-proofs/{buyer_id}/{trade_id}/<file>
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const path = `${userId}/${tradeId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("p2p-proofs")
      .upload(path, file, { upsert: false });
    if (upErr) {
      setBusy(false);
      setActionError(
        upErr.message ||
          "Could not upload proof. Ensure storage bucket is configured.",
      );
      return;
    }
    setProofUrl(path);
    const ok = await submitPaymentProof({
      path,
      reference: proofNote || safeName,
    });
    setBusy(false);
    if (ok) {
      setAttachOpen(false);
      setView("order");
    }
  };

  const confirmCancel = async () => {
    if (!cancelReason || !cancelAck) return;
    setBusy(true);
    setActionError("");
    let { error: err } = await supabase.rpc(P2P_RPC.cancelTrade, {
      p_trade_id: tradeId,
      p_reason: cancelReason,
    });
    if (err && /argument|parameter|could not find/i.test(err.message)) {
      const alt = await supabase.rpc(P2P_RPC.cancelTrade, {
        trade_id: tradeId,
        reason: cancelReason,
      });
      err = alt.error;
    }
    setBusy(false);
    if (err) {
      setActionError(err.message || "Cancel failed");
      return;
    }
    await loadTrade();
    setView("order");
  };

  if (loading) {
    return (
      <div className="ptd-page">
        <style>{css}</style>
        <div className="ptd-head">
          <button type="button" className="ptd-back" onClick={onBack}>
            ←
          </button>
          <div className="ptd-title">Order</div>
        </div>
        <div style={{ padding: 24, color: "#5e6673", textAlign: "center" }}>
          Loading order…
        </div>
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="ptd-page">
        <style>{css}</style>
        <div className="ptd-head">
          <button type="button" className="ptd-back" onClick={onBack}>
            ←
          </button>
          <div className="ptd-title">Order</div>
        </div>
        <div className="ptd-err" style={{ margin: 16 }}>
          {error || "Order unavailable"}
        </div>
      </div>
    );
  }

  const asset = String(trade.asset || "—");
  const fiat = String(trade.fiat_currency || "");
  const statusLabel = formatTradeStatus(trade.status);
  const counterpartyName =
    field(trade, "merchant_name", "counterparty_name", "seller_name", "buyer_name") ||
    "Counterparty";
  const payMethod =
    field(trade, "payment_method", "payment_method_name", "pay_method") ||
    null;
  const bankName = field(trade, "bank_name", "payment_bank", "bank");
  const accountName = field(
    trade,
    "account_name",
    "account_holder",
    "holder_name",
    "full_name",
  );
  const accountNumber = field(
    trade,
    "account_number",
    "bank_account",
    "account_no",
  );

  // ——— CHAT VIEW ———
  if (view === "chat") {
    return (
      <div className="chat-page">
        <style>{css}</style>
        <div className="chat-head">
          <button type="button" className="ptd-back" onClick={() => setView("order")}>
            ←
          </button>
          <div className="ptd-title">Trade chat</div>
        </div>
        <div className="chat-msgs">
          {msgAvailable === false && (
            <div className="ptd-banner">
              Trade messaging is not available on this environment yet.
            </div>
          )}
          {msgAvailable && messages.length === 0 && (
            <div className="chat-empty">No messages yet</div>
          )}
          {messages.map((m) => {
            const mine = !!(userId && String(m.sender_id) === userId);
            return (
              <div
                key={m.id}
                className={`chat-bubble ${mine ? "me" : "them"}`}
              >
                {msgText(m)}
                {m.created_at && (
                  <div className="chat-ts">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {actionError && (
          <div className="ptd-err" style={{ margin: "0 12px 8px" }}>
            {actionError}
          </div>
        )}
        <div className="chat-composer">
          <button
            type="button"
            className="chat-plus"
            onClick={() => setAttachOpen(true)}
            aria-label="Attachments"
          >
            +
          </button>
          <input
            className="chat-input"
            value={msgDraft}
            onChange={(e) => setMsgDraft(e.target.value)}
            placeholder="Enter your message"
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendMessage();
            }}
          />
          <button
            type="button"
            className="chat-send"
            disabled={msgSending || !msgDraft.trim()}
            onClick={() => void sendMessage()}
          >
            ➤
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadProofFile(f);
            e.target.value = "";
          }}
        />
        {attachOpen && (
          <div className="ptd-sheet-bg" onClick={() => setAttachOpen(false)}>
            <div className="ptd-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="ptd-sheet-h">
                <div className="ptd-sheet-t">Attachments</div>
                <button
                  type="button"
                  className="ptd-link"
                  onClick={() => setAttachOpen(false)}
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                className="chat-opt"
                onClick={() => fileRef.current?.click()}
              >
                Upload payment proof
              </button>
              <button
                type="button"
                className="chat-opt"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.setAttribute("capture", "environment");
                    fileRef.current.click();
                  }
                }}
              >
                Camera / image
              </button>
              <button
                type="button"
                className="chat-opt"
                onClick={() => setAttachOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === "cancelReason") {
    return (
      <div className="ptd-page">
        <style>{css}</style>
        <div className="ptd-head">
          <button
            type="button"
            className="ptd-back"
            onClick={() => setView("cancelWarn")}
          >
            ←
          </button>
          <div className="ptd-title">Cancel Order</div>
        </div>
        <div className="ptd-body">
          <div className="ptd-banner">
            The cancellation reason can only be selected once. It may affect
            completion statistics.
          </div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Please select a reason for cancellation.
          </div>
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="ptd-radio">
              <input
                type="radio"
                name="cr"
                checked={cancelReason === r}
                onChange={() => setCancelReason(r)}
              />
              <span>{r}</span>
            </label>
          ))}
          <label className="ptd-radio" style={{ borderBottom: 0, marginTop: 12 }}>
            <input
              type="checkbox"
              checked={cancelAck}
              onChange={(e) => setCancelAck(e.target.checked)}
            />
            <span>
              I have not paid the seller / have received seller&apos;s refund
            </span>
          </label>
          {actionError && <div className="ptd-err">{actionError}</div>}
        </div>
        <div className="ptd-foot">
          <div className="ptd-foot-in">
            <button
              type="button"
              className="ptd-primary"
              disabled={!cancelReason || !cancelAck || busy}
              onClick={() => void confirmCancel()}
            >
              {busy ? "…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ptd-page">
      <style>{css}</style>
      <div className="ptd-head">
        <button type="button" className="ptd-back" onClick={onBack}>
          ←
        </button>
        <div className="ptd-title">{statusLabel}</div>
        {canCancel && !cancelled && (
          <button
            type="button"
            className="ptd-link"
            onClick={() => setView("cancelWarn")}
          >
            Cancel Order
          </button>
        )}
      </div>
      <div className="ptd-body">
        {!cancelled && countdown && (
          <div className="ptd-hint">
            Complete this step in time or the order may be canceled.{" "}
            <em>{countdown}</em>
          </div>
        )}
        {cancelled && (
          <div className="ptd-banner">
            This order has concluded. Assets are no longer locked by escrow.
          </div>
        )}
        <div className="ptd-merchant">
          <div
            className="ptd-av"
            onClick={() => merchantId && onOpenMerchant?.(String(merchantId))}
            role="button"
          >
            {(counterpartyName || "ME").slice(0, 2).toUpperCase()}
          </div>
          <div
            className="ptd-mname"
            onClick={() => merchantId && onOpenMerchant?.(String(merchantId))}
            role="button"
          >
            {counterpartyName}
          </div>
          <button
            type="button"
            className="ptd-contact"
            onClick={() => setView("chat")}
          >
            Contact Seller
          </button>
        </div>
        <div className="ptd-pair">
          {isBuyer ? "Buy" : isSeller ? "Sell" : "Trade"} {asset}
          {fiat ? `/${fiat}` : ""}
        </div>
        <div className="ptd-row">
          <span>Amount</span>
          <b>
            {fmt(
              trade.fiat_amount ??
                (Number(trade.crypto_amount) || 0) * (Number(trade.price) || 0),
              2,
            )}{" "}
            {fiat}
          </b>
        </div>
        <div className="ptd-row">
          <span>Price</span>
          <b>
            {fmt(trade.price, 4)} {fiat}
          </b>
        </div>
        <div className="ptd-row">
          <span>Total Quantity</span>
          <b>
            {fmt(trade.crypto_amount, 6)} {asset}
          </b>
        </div>
        <div className="ptd-row">
          <span>Order No.</span>
          <b style={{ fontFamily: "monospace", fontSize: 11 }}>{trade.id}</b>
        </div>
        <div className="ptd-row">
          <span>Order Time</span>
          <b>
            {trade.created_at
              ? new Date(String(trade.created_at)).toLocaleString()
              : "—"}
          </b>
        </div>
        <div className="ptd-sep" />
        <div className="pay-box">
          <h4>Payment details</h4>
          <div className="ptd-row">
            <span>Method</span>
            <b>{payMethod || "Available after verification"}</b>
          </div>
          <div className="ptd-row">
            <span>Account holder</span>
            <b>{accountName || "Not provided"}</b>
          </div>
          <div className="ptd-row">
            <span>Bank</span>
            <b>{bankName || "Not provided"}</b>
          </div>
          <div className="ptd-row">
            <span>Account number</span>
            <b>{accountNumber || "Not provided"}</b>
          </div>
          <div className="ptd-row">
            <span>Currency</span>
            <b>{fiat || "—"}</b>
          </div>
        </div>
        {actionError && <div className="ptd-err">{actionError}</div>}
      </div>
      <div className="ptd-foot">
        <div className="ptd-foot-in">
          {canSubmitProof && (
            <button
              type="button"
              className="ptd-primary"
              disabled={busy}
              onClick={() => void submitPaymentProof({ path: proofUrl || undefined, reference: proofNote || undefined })}
            >
              {busy ? "…" : "Payment sent"}
            </button>
          )}
          {canRelease && (
            <button
              type="button"
              className="ptd-primary"
              disabled={busy}
              onClick={() =>
                void runRpc(P2P_RPC.sellerRelease, { p_trade_id: tradeId })
              }
            >
              {busy ? "…" : "Release crypto"}
            </button>
          )}
          {canDispute && (
            <button
              type="button"
              className={cancelled ? "ptd-ghost" : "ptd-textbtn"}
              onClick={() => {
                const reason = window.prompt("Dispute reason");
                if (!reason?.trim()) return;
                void runRpc(P2P_RPC.openDispute, {
                  p_trade_id: tradeId,
                  p_reason: reason.trim(),
                });
              }}
            >
              {cancelled ? "Order Dispute?" : "Open dispute"}
            </button>
          )}
          <button
            type="button"
            className="ptd-textbtn"
            onClick={() => setView("chat")}
          >
            I have a question
          </button>
        </div>
      </div>
      {view === "cancelWarn" && (
        <div className="ptd-sheet-bg" onClick={() => setView("order")}>
          <div className="ptd-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ptd-sheet-h">
              <div className="ptd-sheet-t">Cancel Order</div>
              <button
                type="button"
                className="ptd-link"
                onClick={() => setView("order")}
              >
                ×
              </button>
            </div>
            <div className="ptd-dos">
              <div className="ptd-dont">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Don&apos;ts</div>
                <div>• Don&apos;t cancel after you have already paid</div>
                <div>• Don&apos;t pay if payment details look wrong</div>
                <div>• Don&apos;t trust off-platform promises</div>
              </div>
              <div className="ptd-do">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Dos</div>
                <div>• Select the correct cancellation reason</div>
                <div>• Communicate only in the order chat</div>
                <div>• Understand the process before trading</div>
              </div>
            </div>
            <button
              type="button"
              className="ptd-primary"
              style={{ width: "100%" }}
              onClick={() => {
                setCancelReason("");
                setCancelAck(false);
                setView("cancelReason");
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
