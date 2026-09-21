import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  type MerchantReputation,
  type P2POrder,
  type P2PPaymentMethod,
  p2pTradeErrorMessage,
} from "../../lib/p2p-types";

type Props = {
  order: P2POrder;
  userId: string | null;
  onBack: () => void;
  onTradeCreated: (tradeId: string) => void;
  onOpenMerchant?: (merchantUserId: string) => void;
};

type InputMode = "fiat" | "crypto";

const css = `
.pbo-page{min-height:100vh;min-height:100dvh;background:#0a0a0a;color:#eaecef;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;padding-bottom:calc(88px + env(safe-area-inset-bottom,0px))}
.pbo-head{display:flex;align-items:center;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));gap:8px}
.pbo-back{width:36px;height:36px;border:0;background:transparent;color:#eaecef;font-size:20px;cursor:pointer}
.pbo-title{flex:1;text-align:center;font-size:16px;font-weight:700}
.pbo-sub{padding:0 16px 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#848e9c}
.pbo-price{color:#0ecb81;font-weight:600}
.pbo-shield{border:1px solid #1e3a2f;background:#0d1f18;color:#0ecb81;border-radius:12px;padding:4px 10px;font-size:11px;font-weight:600}
.pbo-body{flex:1;overflow-y:auto;padding:8px 12px 16px}
.pbo-card{background:#141414;border:1px solid #222;border-radius:14px;padding:14px 14px 12px;margin-bottom:10px}
.pbo-tabs{display:flex;gap:16px;margin-bottom:12px;align-items:center}
.pbo-tab{border:0;background:transparent;color:#5e6673;font-size:13px;font-weight:600;padding:0 0 6px;cursor:pointer;border-bottom:2px solid transparent}
.pbo-tab.on{color:#eaecef;border-bottom-color:#f0b90b}
.pbo-amt-row{display:flex;align-items:center;gap:8px}
.pbo-amt-input{flex:1;border:0;background:transparent;color:#eaecef;font-size:32px;font-weight:600;outline:none;min-width:0;width:100%}
.pbo-cur{color:#eaecef;font-weight:600;font-size:15px;white-space:nowrap}
.pbo-max{border:0;background:transparent;color:#f0b90b;font-weight:700;font-size:14px;cursor:pointer}
.pbo-limits{margin-top:10px;font-size:11px;color:#5e6673}
.pbo-recv{margin-top:6px;font-size:12px;color:#848e9c}
.pbo-recv b{color:#eaecef;font-weight:600}
.pbo-pay{display:flex;align-items:center;gap:8px;width:100%;border:1px solid #222;background:#141414;border-radius:12px;padding:12px 14px;color:#eaecef;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px;box-sizing:border-box;text-align:left}
.pbo-pay-dot{width:3px;height:14px;border-radius:2px;background:#f0b90b;flex-shrink:0}
.pbo-pay-count{margin-left:6px;opacity:.55;font-weight:500}
.pbo-merchant{display:flex;align-items:center;gap:10px;padding:8px 2px 12px;cursor:pointer}
.pbo-av{width:36px;height:36px;border-radius:50%;background:#1a160e;border:1px solid #3d3420;color:#f0b90b;display:grid;place-items:center;font-size:12px;font-weight:800;flex-shrink:0}
.pbo-mname{font-size:14px;font-weight:600}
.pbo-mstats{font-size:11px;color:#5e6673;margin-top:2px}
.pbo-rate{margin-left:auto;text-align:right;font-size:12px;color:#848e9c}
.pbo-terms-h{font-size:14px;font-weight:600;margin:8px 0 6px}
.pbo-terms{font-size:12px;color:#848e9c;line-height:1.55}
.pbo-terms strong{color:#f0b90b;font-weight:600}
.pbo-foot{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#0a0a0a;border-top:1px solid #1a1a1a;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:center}
.pbo-foot-in{width:100%;max-width:480px;display:flex;align-items:center;gap:12px}
.pbo-total{font-size:11px;color:#5e6673}
.pbo-total b{display:block;font-size:16px;color:#eaecef;font-weight:700}
.pbo-buy{flex:1;border:0;border-radius:24px;padding:14px;background:#f0b90b;color:#0a0a0a;font-weight:800;font-size:15px;cursor:pointer}
.pbo-buy:disabled{opacity:.4;cursor:not-allowed}
.pbo-sheet-bg{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.pbo-sheet{width:100%;max-width:480px;background:#121212;border-radius:16px 16px 0 0;border:1px solid #2a2a2a;border-bottom:0;padding:16px 16px 28px;box-sizing:border-box}
.pbo-sheet-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.pbo-sheet-t{font-size:16px;font-weight:700}
.pbo-sheet-x{border:0;background:transparent;color:#848e9c;font-size:20px;cursor:pointer}
.pbo-opt{width:100%;border:1px solid #2a2a2a;background:#141414;border-radius:10px;padding:14px;margin-bottom:8px;color:#eaecef;font-size:14px;font-weight:600;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;box-sizing:border-box}
.pbo-opt.on{border-color:#f0b90b}
.pbo-err{margin:8px 0;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:8px;padding:10px;font-size:12px}
`;

function fmt(v: number, d = 4): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}

function initials(name: string): string {
  return (name || "").trim().slice(0, 2).toUpperCase() || "P2";
}

function completionLabel(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(pct)}%`;
}

export default function P2PBuyOrder({
  order,
  userId,
  onBack,
  onTradeCreated,
  onOpenMerchant,
}: Props) {
  const isBuySide = order.side === "sell"; // user buys crypto from merchant sell ad
  const title = isBuySide
    ? `Buy ${order.asset}`
    : `Sell ${order.asset}`;

  const [mode, setMode] = useState<InputMode>("fiat");
  const [fiatStr, setFiatStr] = useState("");
  const [cryptoStr, setCryptoStr] = useState("");
  const [payMethod, setPayMethod] = useState(
    (order.payment_methods && order.payment_methods[0]) || "",
  );
  const [paySheet, setPaySheet] = useState(false);
  const [rep, setRep] = useState<MerchantReputation | null>(null);
  const [ownMethods, setOwnMethods] = useState<P2PPaymentMethod[] | null>(null);
  const [selectedOwnMethodId, setSelectedOwnMethodId] = useState<string | null>(
    null,
  );
  const [pmBank, setPmBank] = useState("");
  const [pmHolder, setPmHolder] = useState("");
  const [pmAccount, setPmAccount] = useState("");
  const [pmSaving, setPmSaving] = useState(false);
  const [pmError, setPmError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const price = Number(order.price) || 0;
  const minC = Number(order.min_limit) || 0;
  const maxC = Number(order.max_limit) || 0;
  const avail = Number(order.available_usdt) || 0;
  const maxCrypto = Math.min(maxC, avail);
  const minFiat = minC * price;
  const maxFiat = maxCrypto * price;

  useEffect(() => {
    void supabase
      .rpc("get_merchant_reputation", { p_merchant_user_id: order.user_id })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setRep(row as MerchantReputation);
      });
  }, [order.user_id]);

  const loadOwnMethods = useCallback(async () => {
    if (order.side !== "buy" || !userId) return;
    const { data } = await supabase
      .from("p2p_payment_methods")
      .select("id,bank_name,account_name,is_active")
      .eq("user_id", userId)
      .eq("is_active", true);
    const rows = (data || []) as P2PPaymentMethod[];
    setOwnMethods(rows);
    if (rows.length === 1) setSelectedOwnMethodId(rows[0].id);
  }, [order.side, userId]);

  // When fulfilling a merchant BUY ad, current user is seller and needs PM
  useEffect(() => {
    void loadOwnMethods();
  }, [loadOwnMethods]);

  const savePaymentMethod = async () => {
    if (!userId) return;
    setPmError("");
    const bank = pmBank.trim();
    const holder = pmHolder.trim();
    const acct = pmAccount.trim();
    if (!bank) {
      setPmError("Enter bank / payment method name (e.g. CBE, Telebirr).");
      return;
    }
    if (!holder) {
      setPmError("Enter account holder name.");
      return;
    }
    setPmSaving(true);
    const row: Record<string, unknown> = {
      user_id: userId,
      bank_name: bank,
      account_name: holder,
      is_active: true,
    };
    if (acct) row.account_number = acct;
    const { data, error: err } = await supabase
      .from("p2p_payment_methods")
      .insert(row)
      .select("id,bank_name,account_name,is_active")
      .maybeSingle();
    setPmSaving(false);
    if (err) {
      setPmError(err.message || "Could not save payment method.");
      return;
    }
    setPmBank("");
    setPmHolder("");
    setPmAccount("");
    await loadOwnMethods();
    if (data?.id) setSelectedOwnMethodId(String(data.id));
  };

  const setFromFiat = (raw: string) => {
    setFiatStr(raw);
    const f = Number(raw);
    if (!Number.isFinite(f) || f <= 0 || price <= 0) {
      setCryptoStr("");
      return;
    }
    setCryptoStr(String(Number((f / price).toFixed(8))));
  };

  const setFromCrypto = (raw: string) => {
    setCryptoStr(raw);
    const c = Number(raw);
    if (!Number.isFinite(c) || c <= 0 || price <= 0) {
      setFiatStr("");
      return;
    }
    setFiatStr(String(Number((c * price).toFixed(2))));
  };

  const cryptoAmt = Number(cryptoStr) || 0;
  const fiatAmt = Number(fiatStr) || 0;

  const valid = useMemo(() => {
    if (!Number.isFinite(cryptoAmt) || cryptoAmt <= 0) return false;
    if (cryptoAmt < minC - 1e-12) return false;
    if (cryptoAmt > maxCrypto + 1e-12) return false;
    if (order.side === "buy" && !selectedOwnMethodId) return false;
    if (order.side === "sell" && !(payMethod || "").trim()) return false;
    if (userId && order.user_id === userId) return false;
    return true;
  }, [
    cryptoAmt,
    minC,
    maxCrypto,
    order.side,
    order.user_id,
    payMethod,
    selectedOwnMethodId,
    userId,
  ]);

  const submit = async () => {
    if (!valid || submitting) return;
    setError("");
    setSubmitting(true);
    const { data, error: err } = await supabase.rpc(
      "create_p2p_trade_with_escrow",
      {
        p_order_id: order.id,
        p_crypto_amount: cryptoAmt,
        p_payment_method_id:
          order.side === "buy" ? selectedOwnMethodId : null,
      },
    );
    setSubmitting(false);
    if (err) {
      setError(p2pTradeErrorMessage(err.message, order.side));
      return;
    }
    onTradeCreated(String(data));
  };

  const methods = order.payment_methods || [];

  return (
    <div className="pbo-page">
      <style>{css}</style>
      <header className="pbo-head">
        <button type="button" className="pbo-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="pbo-title">{title}</div>
        <div style={{ width: 36 }} />
      </header>
      <div className="pbo-sub">
        <span>
          Price{" "}
          <span className="pbo-price">
            {fmt(price, 4)} {order.fiat_currency}
          </span>
        </span>
        <span className="pbo-shield">Security protection</span>
      </div>

      <div className="pbo-body">
        <div className="pbo-card">
          <div className="pbo-tabs">
            <button
              type="button"
              className={`pbo-tab ${mode === "fiat" ? "on" : ""}`}
              onClick={() => setMode("fiat")}
            >
              With Fiat
            </button>
            <button
              type="button"
              className={`pbo-tab ${mode === "crypto" ? "on" : ""}`}
              onClick={() => setMode("crypto")}
            >
              With Crypto
            </button>
            {order.avg_release_time_minutes != null && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#5e6673" }}>
                ~{Math.max(1, Math.round(order.avg_release_time_minutes))}m
              </span>
            )}
          </div>

          {mode === "fiat" ? (
            <div className="pbo-amt-row">
              <input
                className="pbo-amt-input"
                inputMode="decimal"
                placeholder="0"
                value={fiatStr}
                onChange={(e) => setFromFiat(e.target.value.replace(/[^\d.]/g, ""))}
              />
              <span className="pbo-cur">{order.fiat_currency}</span>
              <button
                type="button"
                className="pbo-max"
                onClick={() => setFromFiat(String(Number(maxFiat.toFixed(2))))}
              >
                Max
              </button>
            </div>
          ) : (
            <div className="pbo-amt-row">
              <input
                className="pbo-amt-input"
                inputMode="decimal"
                placeholder="0"
                value={cryptoStr}
                onChange={(e) =>
                  setFromCrypto(e.target.value.replace(/[^\d.]/g, ""))
                }
              />
              <span className="pbo-cur">{order.asset}</span>
              <button
                type="button"
                className="pbo-max"
                onClick={() => setFromCrypto(String(Number(maxCrypto.toFixed(8))))}
              >
                Max
              </button>
            </div>
          )}

          <div className="pbo-limits">
            Limits: {fmt(minFiat, 2)} – {fmt(maxFiat, 2)} {order.fiat_currency}
            {" · "}
            {fmt(minC)} – {fmt(maxCrypto)} {order.asset}
          </div>
          <div className="pbo-recv">
            {isBuySide ? "I will receive " : "I will sell "}
            <b>
              {cryptoAmt > 0 ? fmt(cryptoAmt, 6) : "—"} {order.asset}
            </b>
            {fiatAmt > 0 && (
              <>
                {" "}
                / <b>
                  {fmt(fiatAmt, 2)} {order.fiat_currency}
                </b>
              </>
            )}
          </div>
        </div>

        {/* Payment methods from ad */}
        {order.side === "sell" && (
          <button
            type="button"
            className="pbo-pay"
            onClick={() => setPaySheet(true)}
          >
            <span className="pbo-pay-dot" />
            {payMethod || "Select payment method"}
            {methods.length > 0 && (
              <span className="pbo-pay-count">{methods.length}</span>
            )}
            <span style={{ marginLeft: "auto", opacity: 0.5 }}>▼</span>
          </button>
        )}

        {order.side === "buy" && (
          <div className="pbo-card">
            <div style={{ fontSize: 12, color: "#848e9c", marginBottom: 8 }}>
              Receive payment into
            </div>
            {ownMethods === null ? (
              <div style={{ fontSize: 12, color: "#5e6673" }}>Loading…</div>
            ) : (
              <>
                {ownMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pbo-opt ${selectedOwnMethodId === m.id ? "on" : ""}`}
                    onClick={() => setSelectedOwnMethodId(m.id)}
                  >
                    <span className="pbo-pay-dot" />
                    {m.bank_name || "Payment method"}
                    {m.account_name ? ` — ${m.account_name}` : ""}
                  </button>
                ))}
                {ownMethods.length === 0 && (
                  <div style={{ fontSize: 12, color: "#848e9c", marginBottom: 8 }}>
                    You have no saved payment methods. Add where the merchant
                    should send fiat for this trade.
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#5e6673", margin: "8px 0 4px" }}>
                  {ownMethods.length === 0 ? "Add payment method" : "Add another"}
                </div>
                <input
                  className="pbo-amt-input"
                  style={{ fontSize: 14, marginBottom: 6 }}
                  placeholder="Bank / method (CBE, Telebirr…)"
                  value={pmBank}
                  onChange={(e) => setPmBank(e.target.value)}
                />
                <input
                  className="pbo-amt-input"
                  style={{ fontSize: 14, marginBottom: 6 }}
                  placeholder="Account holder name"
                  value={pmHolder}
                  onChange={(e) => setPmHolder(e.target.value)}
                />
                <input
                  className="pbo-amt-input"
                  style={{ fontSize: 14, marginBottom: 8 }}
                  placeholder="Account number (optional)"
                  value={pmAccount}
                  onChange={(e) => setPmAccount(e.target.value)}
                />
                {pmError && (
                  <div style={{ fontSize: 12, color: "#ff9aa6", marginBottom: 6 }}>
                    {pmError}
                  </div>
                )}
                <button
                  type="button"
                  className="pbo-max"
                  style={{
                    width: "100%",
                    textAlign: "center",
                    border: "1px solid #3d3420",
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 4,
                  }}
                  disabled={pmSaving}
                  onClick={() => void savePaymentMethod()}
                >
                  {pmSaving ? "Saving…" : "Save payment method"}
                </button>
              </>
            )}
          </div>
        )}

        <div
          className="pbo-merchant"
          onClick={() => onOpenMerchant?.(order.user_id)}
          role="button"
        >
          <div className="pbo-av">{initials(order.merchant_name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="pbo-mname">{order.merchant_name || "Merchant"}</div>
            <div className="pbo-mstats">
              Completion {completionLabel(order.completion_rate)}
              {rep && rep.review_count > 0
                ? ` · ${fmt(rep.avg_rating, 1)}★ (${rep.review_count})`
                : ""}
            </div>
          </div>
          <div className="pbo-rate">{completionLabel(order.completion_rate)}</div>
        </div>

        <div className="pbo-terms-h">Advertiser Terms</div>
        <div className="pbo-terms">
          Merchants may include additional terms for this advertisement. Please
          review carefully before placing an order. In the event of any conflict,{" "}
          <strong>CEO Exchange Platform Terms</strong> shall prevail. Complete
          payment only through the trade chat and confirmed payment details for
          this order.
        </div>

        {error && <div className="pbo-err">{error}</div>}
        {userId && order.user_id === userId && (
          <div className="pbo-err">You cannot trade against your own ad.</div>
        )}
      </div>

      <div className="pbo-foot">
        <div className="pbo-foot-in">
          <div className="pbo-total">
            Total payable
            <b>
              {fiatAmt > 0 ? fmt(fiatAmt, 2) : "0"} {order.fiat_currency}
            </b>
          </div>
          <button
            type="button"
            className="pbo-buy"
            disabled={!valid || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Creating…" : isBuySide ? "Buy" : "Sell"}
          </button>
        </div>
      </div>

      {paySheet && (
        <div className="pbo-sheet-bg" onClick={() => setPaySheet(false)}>
          <div className="pbo-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pbo-sheet-h">
              <div className="pbo-sheet-t">Select payment method</div>
              <button
                type="button"
                className="pbo-sheet-x"
                onClick={() => setPaySheet(false)}
              >
                ×
              </button>
            </div>
            {methods.length === 0 && (
              <div style={{ color: "#5e6673", fontSize: 13 }}>
                No payment methods listed on this ad.
              </div>
            )}
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                className={`pbo-opt ${payMethod === m ? "on" : ""}`}
                onClick={() => {
                  setPayMethod(m);
                  setPaySheet(false);
                }}
              >
                <span className="pbo-pay-dot" />
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

