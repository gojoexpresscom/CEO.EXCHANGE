import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { P2P_RPC, P2P_TABLE, type P2POrder } from "../../lib/p2p-types";

type Props = {
  userId: string | null;
};

const css = `
.ads-page{padding:12px 12px 24px}
.ads-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.ads-title{font-size:15px;font-weight:700;color:#eaecef}
.ads-post{border:0;border-radius:20px;background:#f0b90b;color:#0a0a0a;font-weight:800;font-size:13px;padding:8px 14px;cursor:pointer}
.ads-card{background:#141414;border:1px solid #222;border-radius:12px;padding:12px;margin-bottom:10px}
.ads-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#848e9c;padding:3px 0}
.ads-row b{color:#eaecef;font-weight:600}
.ads-empty{text-align:center;color:#5e6673;font-size:13px;padding:32px 12px}
.ads-err{border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:8px;padding:10px;font-size:12px;margin-bottom:10px}
.ads-form{background:#121212;border:1px solid #222;border-radius:14px;padding:14px;margin-bottom:14px}
.ads-form h3{margin:0 0 12px;font-size:15px;color:#eaecef}
.ads-label{display:block;font-size:11px;color:#848e9c;margin:10px 0 4px}
.ads-input,.ads-select{width:100%;box-sizing:border-box;border:1px solid #2a2a2a;background:#0a0a0a;border-radius:8px;padding:10px 12px;color:#eaecef;font-size:13px}
.ads-side{display:flex;gap:8px;margin-bottom:4px}
.ads-side button{flex:1;border:1px solid #2a2a2a;background:#141414;color:#848e9c;border-radius:8px;padding:10px;font-weight:700;cursor:pointer}
.ads-side button.on{border-color:#f0b90b;color:#f0b90b;background:#1a160e}
.ads-actions{display:flex;gap:8px;margin-top:14px}
.ads-actions button{flex:1;border:0;border-radius:20px;padding:12px;font-weight:800;cursor:pointer}
.ads-save{background:#f0b90b;color:#0a0a0a}
.ads-cancel{background:#1a1a1a;color:#eaecef}
.ads-save:disabled{opacity:.45}
`;

function fmt(v: unknown, d = 4): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function P2PAdsPanel({ userId }: Props) {
  const [ads, setAds] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [asset, setAsset] = useState("USDT");
  const [fiat, setFiat] = useState("ETB");
  const [price, setPrice] = useState("");
  const [minLimit, setMinLimit] = useState("");
  const [maxLimit, setMaxLimit] = useState("");
  const [available, setAvailable] = useState("");
  const [payMethod, setPayMethod] = useState("Bank Transfer");
  const [fullName, setFullName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [terms, setTerms] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setAds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from(P2P_TABLE.orders)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (err) {
      setError(err.message);
      setAds([]);
      return;
    }
    setAds((data || []) as P2POrder[]);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAd = async () => {
    if (!userId) return;
    setFormErr("");
    const p = Number(price);
    const minL = Number(minLimit);
    const maxL = Number(maxLimit);
    const avail = Number(available);
    if (!Number.isFinite(p) || p <= 0) {
      setFormErr("Enter a valid price.");
      return;
    }
    if (!Number.isFinite(minL) || !Number.isFinite(maxL) || minL <= 0 || maxL < minL) {
      setFormErr("Enter valid min/max limits.");
      return;
    }
    if (!Number.isFinite(avail) || avail <= 0) {
      setFormErr("Enter available amount.");
      return;
    }
    if (!(payMethod || "").trim()) {
      setFormErr("Payment method is required.");
      return;
    }

    setSaving(true);
    // Prefer update_p2p_order RPC (create/upsert per backend)
    const payload: Record<string, unknown> = {
      p_side: side,
      p_asset: asset,
      p_fiat_currency: fiat,
      p_price: p,
      p_min_limit: minL,
      p_max_limit: maxL,
      p_available_usdt: avail,
      p_payment_methods: [payMethod.trim()],
      p_terms: terms || null,
      p_account_name: accountHolder || fullName || null,
      p_bank_name: bankName || null,
      p_account_number: accountNumber || null,
      p_full_name: fullName || null,
    };

    let { error: err } = await supabase.rpc(P2P_RPC.updateOrder, payload);
    if (err && /argument|parameter|could not find/i.test(err.message)) {
      // Try insert path via table if RPC arg shape differs
      const row = {
        user_id: userId,
        merchant_name: fullName || accountHolder || "Merchant",
        side,
        asset,
        fiat_currency: fiat,
        price: p,
        min_limit: minL,
        max_limit: maxL,
        available_usdt: avail,
        payment_methods: [payMethod.trim()],
        is_active: true,
        status: "active",
      };
      const ins = await supabase.from(P2P_TABLE.orders).insert(row).select("id").maybeSingle();
      err = ins.error;
      // Optionally attach payment method row
      if (!err && (accountHolder || bankName || accountNumber)) {
        await supabase.from(P2P_TABLE.paymentMethods).insert({
          user_id: userId,
          bank_name: bankName || payMethod,
          account_name: accountHolder || fullName,
          account_number: accountNumber || null,
          is_active: true,
        } as Record<string, unknown>);
      }
    }
    setSaving(false);
    if (err) {
      setFormErr(err.message || "Could not create advertisement");
      return;
    }
    setShowForm(false);
    setPrice("");
    setMinLimit("");
    setMaxLimit("");
    setAvailable("");
    await load();
  };

  if (!userId) {
    return (
      <div className="ads-page">
        <style>{css}</style>
        <div className="ads-empty">Sign in to manage your advertisements.</div>
      </div>
    );
  }

  return (
    <div className="ads-page">
      <style>{css}</style>
      <div className="ads-top">
        <div className="ads-title">My Ads</div>
        <button
          type="button"
          className="ads-post"
          onClick={() => {
            setShowForm((v) => !v);
            setFormErr("");
          }}
        >
          {showForm ? "Close" : "+ Post Ad"}
        </button>
      </div>

      {showForm && (
        <div className="ads-form">
          <h3>Post advertisement</h3>
          <div className="ads-side">
            <button
              type="button"
              className={side === "buy" ? "on" : ""}
              onClick={() => setSide("buy")}
            >
              Buy
            </button>
            <button
              type="button"
              className={side === "sell" ? "on" : ""}
              onClick={() => setSide("sell")}
            >
              Sell
            </button>
          </div>
          <label className="ads-label">Asset</label>
          <input className="ads-input" value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} />
          <label className="ads-label">Fiat</label>
          <input className="ads-input" value={fiat} onChange={(e) => setFiat(e.target.value.toUpperCase())} />
          <label className="ads-label">Price ({fiat})</label>
          <input className="ads-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <label className="ads-label">Min limit ({asset})</label>
          <input className="ads-input" inputMode="decimal" value={minLimit} onChange={(e) => setMinLimit(e.target.value)} />
          <label className="ads-label">Max limit ({asset})</label>
          <input className="ads-input" inputMode="decimal" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)} />
          <label className="ads-label">Available ({asset})</label>
          <input className="ads-input" inputMode="decimal" value={available} onChange={(e) => setAvailable(e.target.value)} />
          <label className="ads-label">Payment method</label>
          <input className="ads-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="Bank Transfer" />
          <label className="ads-label">Full name</label>
          <input className="ads-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <label className="ads-label">Account holder name</label>
          <input className="ads-input" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          <label className="ads-label">Bank name</label>
          <input className="ads-input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <label className="ads-label">Account number</label>
          <input className="ads-input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          <label className="ads-label">Terms (optional)</label>
          <input className="ads-input" value={terms} onChange={(e) => setTerms(e.target.value)} />
          {formErr && <div className="ads-err">{formErr}</div>}
          <div className="ads-actions">
            <button type="button" className="ads-cancel" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="button" className="ads-save" disabled={saving} onClick={() => void submitAd()}>
              {saving ? "Saving…" : "Publish"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="ads-err">{error}</div>}
      {loading && <div className="ads-empty">Loading…</div>}
      {!loading && ads.length === 0 && !showForm && (
        <div className="ads-empty">No advertisements yet. Tap + Post Ad to create one.</div>
      )}
      {ads.map((o) => (
        <div key={o.id} className="ads-card">
          <div className="ads-row">
            <span>{o.side === "buy" ? "Buy" : "Sell"} {o.asset}</span>
            <b>
              {fmt(o.price, 4)} {o.fiat_currency}
            </b>
          </div>
          <div className="ads-row">
            <span>Limits</span>
            <b>
              {fmt(o.min_limit)} – {fmt(o.max_limit)} {o.asset}
            </b>
          </div>
          <div className="ads-row">
            <span>Available</span>
            <b>
              {fmt(o.available_usdt)} {o.asset}
            </b>
          </div>
          <div className="ads-row">
            <span>Methods</span>
            <b>{(o.payment_methods || []).join(", ") || "—"}</b>
          </div>
          <div className="ads-row">
            <span>Status</span>
            <b>{o.is_active ? "Active" : o.status || "Inactive"}</b>
          </div>
        </div>
      ))}
    </div>
  );
}
