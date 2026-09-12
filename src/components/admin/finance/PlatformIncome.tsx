import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import StatCard from "../shared/StatCard";

export default function PlatformIncome() {
  const [revenue, setRevenue] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [asset, setAsset] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("exchange_revenue").select("*"),
      supabase.from("platform_payouts").select("*").order("requested_at", { ascending: false }),
    ]);
    setRevenue(r ?? []);
    setPayouts(p ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function withdraw() {
    if (!amount || Number(amount) <= 0 || !destination.trim()) return;
    setBusy(true);
    setMessage("");
    const idempotency = crypto.randomUUID();
    const { error } = await supabase.rpc("owner_withdraw_platform_income", {
      p_asset: asset,
      p_amount: Number(amount),
      p_method: method,
      p_destination: destination.trim(),
      p_idempotency_key: idempotency,
      p_notes: "",
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Withdrawal requested");
      setAmount("");
      setDestination("");
      await load();
    }
    setBusy(false);
  }

  if (loading) return <div style={{ color: "#666", padding: 40, textAlign: "center" }}>Loading…</div>;

  const totalCollected = revenue.reduce((s, r) => s + Number(r.total_collected || 0), 0);
  const totalWithdrawn = revenue.reduce((s, r) => s + Number(r.total_withdrawn || 0), 0);
  const available = totalCollected - totalWithdrawn;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard label="Total Collected" value={`$${totalCollected.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="#22c55e" />
        <StatCard label="Total Withdrawn" value={`$${totalWithdrawn.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="#ef4444" />
        <StatCard label="Available Balance" value={`$${available.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="#f5b51b" />
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20, maxWidth: 500 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#fff" }}>Withdraw Platform Income</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="Asset" style={inputStyle} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" type="number" style={inputStyle} />
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Method" style={inputStyle} />
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" style={inputStyle} />
          <button
            onClick={() => void withdraw()}
            disabled={busy}
            style={{
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: "#f5b51b",
              color: "#000",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {busy ? "Processing…" : "Withdraw Now"}
          </button>
          {message && <div style={{ color: "#f5b51b", fontSize: 13 }}>{message}</div>}
        </div>
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        <h3 style={{ margin: 0, padding: "16px 20px", fontSize: 15, color: "#fff", borderBottom: "1px solid #1a1a1a" }}>
          Payout History
        </h3>
        {payouts.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#555" }}>No payouts yet</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={th}>Asset</th>
                <th style={th}>Amount</th>
                <th style={th}>Method</th>
                <th style={th}>Status</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={td}>{p.asset}</td>
                  <td style={td}>{Number(p.amount).toFixed(2)}</td>
                  <td style={td}>{p.method}</td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>{new Date(p.requested_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#111", border: "1px solid #2a2a2a", borderRadius: 10,
  padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none",
};
const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
