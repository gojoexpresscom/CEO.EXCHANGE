import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  MerchantReputation,
  P2POrder,
  P2POrderSide,
  P2PPaymentMethod,
  p2pTradeErrorMessage,
} from "../../lib/p2p-types";

type Props = { onBack?: () => void };

// All data on this page comes straight from Supabase (p2p_orders,
// p2p_payment_methods, get_merchant_reputation, create_p2p_trade_with_escrow).
// Nothing here is mocked, and every action maps to a real, already-hardened
// RPC or table read governed by existing RLS. Direct UPDATE on p2p_orders is
// never used — table-wide UPDATE is revoked for authenticated users, and the
// only mutation this page performs is via create_p2p_trade_with_escrow.
const css = `
.p2p-page{min-height:100vh;background:#050505;color:#eee;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding-bottom:40px}
.p2p-shell{width:min(760px,100%);margin:auto;padding:10px 14px 26px;box-sizing:border-box}
.p2p-top{display:flex;align-items:center;gap:10px;min-height:48px}
.p2p-back{width:38px;height:38px;border:1px solid #232323;border-radius:10px;background:#0a0a0a;color:#f4c542;cursor:pointer;font-size:18px;display:grid;place-items:center;flex-shrink:0}
.p2p-title{font-size:17px;font-weight:700}
.p2p-spacer{flex:1}
.p2p-tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid #232323;border-radius:9px;overflow:hidden;margin:14px 0}
.p2p-tab{border:0;background:#0a0a0a;color:#888;padding:11px;font-weight:700;cursor:pointer;font-size:13.5px}
.p2p-tab.buy.active{background:#087e50;color:#fff}
.p2p-tab.sell.active{background:#b82034;color:#fff}
.p2p-error{margin:0 0 12px;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:10px;font-size:12.5px}
.p2p-loading{padding:60px 0;text-align:center;color:#f4c542;font-size:13px}
.p2p-empty{padding:60px 20px;text-align:center;color:#666;font-size:12.5px;line-height:1.6}
.p2p-card{border:1px solid #202020;background:#070707;border-radius:13px;padding:14px;margin-bottom:10px;cursor:pointer;text-align:left;width:100%;color:inherit;font:inherit}
.p2p-card:hover{border-color:#3a3a3a}
.p2p-card-top{display:flex;align-items:center;gap:10px}
.p2p-avatar{width:34px;height:34px;border-radius:999px;background:linear-gradient(145deg,#2a2a2a,#141414);border:1px solid #2e2e2e;display:grid;place-items:center;font-size:12px;font-weight:700;color:#eee;flex-shrink:0}
.p2p-merchant{font-weight:700;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p2p-rep{color:#888;font-size:11px;margin-top:2px}
.p2p-card-spacer{flex:1}
.p2p-price{font-size:17px;font-weight:800;color:#f4c542;text-align:right;white-space:nowrap}
.p2p-price-unit{font-size:11px;color:#888;font-weight:500}
.p2p-card-row{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:12px;color:#999}
.p2p-methods{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.p2p-chip{border:1px solid #2a2a2a;background:#121212;color:#aaa;border-radius:999px;padding:3px 9px;font-size:10.5px}
.p2p-overlay{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(6px)}
.p2p-sheet{width:min(620px,100%);max-height:92vh;overflow-y:auto;background:#0b0b0b;border:1px solid #232323;border-radius:20px 20px 0 0;padding:16px 16px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -24px 80px rgba(0,0,0,.65)}
.p2p-sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.p2p-sheet-head h2{margin:0;font-size:17px}
.p2p-close{border:0;background:transparent;color:#aaa;font-size:20px;cursor:pointer;padding:4px}
.p2p-detail-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #171717;font-size:13px}
.p2p-detail-row span:first-child{color:#888}
.p2p-label{display:flex;justify-content:space-between;color:#999;font-size:12px;margin:14px 0 6px}
.p2p-input-wrap{border:1px solid #232323;border-radius:10px;background:#0a0a0a}
.p2p-input-wrap:focus-within{border-color:#d9a927}
.p2p-input{width:100%;box-sizing:border-box;background:none;color:#eee;border:0;padding:12px;font-size:15px;outline:none}
.p2p-methods-pick{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.p2p-method-btn{width:100%;text-align:left;border:1px solid #232323;border-radius:10px;background:#0a0a0a;color:#ddd;padding:11px 12px;cursor:pointer;font-size:13px}
.p2p-method-btn.active{border-color:#d9a927;color:#f4c542}
.p2p-no-methods{margin-top:8px;border:1px solid #5c4b1b;background:#171307;color:#d2bd73;border-radius:9px;padding:10px;font-size:12px;line-height:1.5}
.p2p-panel-error{margin-top:12px;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:10px;font-size:12.5px}
.p2p-submit{width:100%;border:0;border-radius:10px;padding:13px;margin-top:16px;color:#fff;font-weight:800;font-size:15px;cursor:pointer}
.p2p-submit.buy{background:#08a96b}
.p2p-submit.sell{background:#e52d45}
.p2p-submit:disabled{background:#242424;color:#666;cursor:not-allowed}
.p2p-result{text-align:center;padding:20px 6px}
.p2p-result-icon{width:52px;height:52px;border-radius:999px;background:#08a96b;color:#fff;display:grid;place-items:center;margin:0 auto 14px;font-size:26px}
.p2p-result-id{font-family:monospace;font-size:12px;color:#888;margin-top:8px;word-break:break-all}
.p2p-result-note{color:#999;font-size:12.5px;margin-top:12px;line-height:1.6}
.p2p-done-btn{width:100%;border:0;border-radius:10px;padding:12px;margin-top:16px;background:#1a1a1a;color:#eee;font-weight:700;cursor:pointer}
`;

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}

function initials(name: string): string {
  return (name || "").trim().slice(0, 2).toUpperCase() || "P2";
}

export default function P2PMarketplace({ onBack }: Props) {
  // "side" here means what the CURRENT USER wants to do. To buy crypto, we
  // show orders posted with side='sell' (merchants selling); to sell crypto,
  // we show orders posted with side='buy' (merchants buying) — this mirrors
  // exactly how create_p2p_trade_with_escrow assigns buyer_id/seller_id.
  const [side, setSide] = useState<P2POrderSide>("buy");
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [selected, setSelected] = useState<P2POrder | null>(null);
  const [amount, setAmount] = useState("");
  const [reputation, setReputation] = useState<MerchantReputation | null>(null);
  const [ownMethods, setOwnMethods] = useState<P2PPaymentMethod[] | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tradeId: string } | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    // Orders posted by merchants who want to do the opposite of what the
    // current user wants to do — that's who they can trade against.
    const orderSide: P2POrderSide = side === "buy" ? "sell" : "buy";
    const { data, error: err } = await supabase
      .from("p2p_orders")
      .select(
        "id,user_id,merchant_name,side,asset,fiat_currency,price,min_limit,max_limit,available_usdt,payment_methods,completion_rate,avg_release_time_minutes,is_active,status,created_at"
      )
      .eq("status", "active")
      .eq("is_active", true)
      .eq("side", orderSide)
      // Buying: cheapest offers first. Selling: highest offers first.
      .order("price", { ascending: side === "buy" })
      .limit(50);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOrders((data || []) as P2POrder[]);
  }, [side]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Realtime: p2p_orders is in the supabase_realtime publication, and RLS
  // still applies per-subscriber, so this only ever reflects rows the
  // current user is already allowed to see (active orders, or their own).
  useEffect(() => {
    const ch = supabase
      .channel("p2p-marketplace-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "p2p_orders" }, () => {
        void loadOrders();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadOrders]);

  const openOrder = async (order: P2POrder) => {
    setSelected(order);
    setAmount("");
    setPanelError("");
    setResult(null);
    setReputation(null);
    setOwnMethods(null);
    setSelectedMethodId(null);

    void supabase
      .rpc("get_merchant_reputation", { p_merchant_user_id: order.user_id })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setReputation(row as MerchantReputation);
      });

    // Fulfilling a 'buy' order makes the current user the seller, who must
    // supply their own payment method for create_p2p_trade_with_escrow.
    if (order.side === "buy") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("p2p_payment_methods")
        .select("id,bank_name,account_name,is_active")
        .eq("user_id", user.id)
        .eq("is_active", true);
      setOwnMethods((data || []) as P2PPaymentMethod[]);
    }
  };

  const closePanel = () => {
    setSelected(null);
    setResult(null);
  };

  const submitTrade = async () => {
    if (!selected) return;
    setPanelError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPanelError("Enter a valid amount.");
      return;
    }
    if (amt < selected.min_limit || amt > selected.max_limit) {
      setPanelError(`Amount must be between ${fmt(selected.min_limit, 8)} and ${fmt(selected.max_limit, 8)} ${selected.asset}.`);
      return;
    }
    if (amt > selected.available_usdt) {
      setPanelError("This order doesn't have enough liquidity remaining. Try a smaller amount.");
      return;
    }
    if (selected.side === "buy" && !selectedMethodId) {
      setPanelError("Select a payment method to receive payment into.");
      return;
    }

    setSubmitting(true);
    const { data, error: err } = await supabase.rpc("create_p2p_trade_with_escrow", {
      p_order_id: selected.id,
      p_crypto_amount: amt,
      p_payment_method_id: selected.side === "buy" ? selectedMethodId : null,
    });
    setSubmitting(false);
    if (err) {
      setPanelError(p2pTradeErrorMessage(err.message, selected.side));
      return;
    }
    setResult({ tradeId: String(data) });
    void loadOrders();
  };

  const myTurnToBuy = selected ? selected.side === "sell" : side === "buy";

  return (
    <div className="p2p-page">
      <style>{css}</style>
      <div className="p2p-shell">
        <header className="p2p-top">
          <button className="p2p-back" onClick={onBack || (() => window.history.back())} aria-label="Back">←</button>
          <div className="p2p-title">P2P Marketplace</div>
          <div className="p2p-spacer" />
        </header>

        <div className="p2p-tabs">
          <button className={`p2p-tab buy ${side === "buy" ? "active" : ""}`} onClick={() => setSide("buy")}>Buy</button>
          <button className={`p2p-tab sell ${side === "sell" ? "active" : ""}`} onClick={() => setSide("sell")}>Sell</button>
        </div>

        {error && <div className="p2p-error">{error}</div>}

        {loading ? (
          <div className="p2p-loading">Loading real P2P orders…</div>
        ) : !orders.length ? (
          <div className="p2p-empty">
            No active {side === "buy" ? "sell" : "buy"} orders right now.
            <br />
            Check back shortly, or try the other tab.
          </div>
        ) : (
          orders.map((o) => (
            <button key={o.id} className="p2p-card" onClick={() => void openOrder(o)}>
              <div className="p2p-card-top">
                <div className="p2p-avatar">{initials(o.merchant_name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="p2p-merchant">{o.merchant_name}</div>
                  <div className="p2p-rep">
                    {fmt(o.completion_rate, 1)}% completion
                    {o.avg_release_time_minutes != null ? ` · ~${o.avg_release_time_minutes}m release` : ""}
                  </div>
                </div>
                <div className="p2p-card-spacer" />
                <div>
                  <div className="p2p-price">{fmt(o.price, 4)}</div>
                  <div className="p2p-price-unit" style={{ textAlign: "right" }}>{o.fiat_currency} / {o.asset}</div>
                </div>
              </div>
              <div className="p2p-card-row">
                <span>Limits: {fmt(o.min_limit, 4)} – {fmt(o.max_limit, 4)} {o.asset}</span>
                <span>Available: {fmt(o.available_usdt, 4)} {o.asset}</span>
              </div>
              {!!o.payment_methods?.length && (
                <div className="p2p-methods">
                  {o.payment_methods.map((m) => (
                    <span key={m} className="p2p-chip">{m}</span>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="p2p-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="p2p-sheet">
            <div className="p2p-sheet-head">
              <h2>{result ? "Trade created" : myTurnToBuy ? "Buy" : "Sell"} {selected.asset}</h2>
              <button className="p2p-close" onClick={closePanel} aria-label="Close">×</button>
            </div>

            {result ? (
              <div className="p2p-result">
                <div className="p2p-result-icon">✓</div>
                <div>Your trade was created and escrow has been locked.</div>
                <div className="p2p-result-id">Trade ID: {result.tradeId}</div>
                <div className="p2p-result-note">
                  Payment and chat screens for this trade are coming next — this trade is live in the
                  database and will show up there once built.
                </div>
                <button className="p2p-done-btn" onClick={closePanel}>Done</button>
              </div>
            ) : (
              <>
                <div className="p2p-detail-row"><span>Merchant</span><span>{selected.merchant_name}</span></div>
                <div className="p2p-detail-row"><span>Price</span><span>{fmt(selected.price, 4)} {selected.fiat_currency} / {selected.asset}</span></div>
                <div className="p2p-detail-row"><span>Limits</span><span>{fmt(selected.min_limit, 8)} – {fmt(selected.max_limit, 8)} {selected.asset}</span></div>
                <div className="p2p-detail-row"><span>Available</span><span>{fmt(selected.available_usdt, 8)} {selected.asset}</span></div>
                {reputation && (
                  <div className="p2p-detail-row">
                    <span>Reviews</span>
                    <span>
                      {reputation.review_count > 0
                        ? `${fmt(reputation.avg_rating, 1)}★ (${reputation.review_count})`
                        : "No reviews yet"}
                    </span>
                  </div>
                )}

                <div className="p2p-label"><span>Amount</span><span>{selected.asset}</span></div>
                <div className="p2p-input-wrap">
                  <input
                    className="p2p-input"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`${fmt(selected.min_limit, 4)} – ${fmt(selected.max_limit, 4)}`}
                  />
                </div>

                {selected.side === "buy" && (
                  <>
                    <div className="p2p-label"><span>Receive payment into</span><span /></div>
                    {ownMethods === null ? (
                      <div className="p2p-rep">Loading your payment methods…</div>
                    ) : ownMethods.length === 0 ? (
                      <div className="p2p-no-methods">
                        You don't have an active payment method on file yet. Adding one is coming in a later
                        update — you can't fulfil a buy order until then.
                      </div>
                    ) : (
                      <div className="p2p-methods-pick">
                        {ownMethods.map((m) => (
                          <button
                            key={m.id}
                            className={`p2p-method-btn ${selectedMethodId === m.id ? "active" : ""}`}
                            onClick={() => setSelectedMethodId(m.id)}
                          >
                            {m.bank_name || "Payment method"} — {m.account_name || ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {panelError && <div className="p2p-panel-error">{panelError}</div>}

                <button
                  className={`p2p-submit ${myTurnToBuy ? "buy" : "sell"}`}
                  disabled={submitting || (selected.side === "buy" && !ownMethods?.length)}
                  onClick={() => void submitTrade()}
                >
                  {submitting ? "Creating trade…" : `${myTurnToBuy ? "Buy" : "Sell"} ${selected.asset}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
         }
