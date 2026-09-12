import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rates, setRates] = useState<any[]>([]);
  const [buyRate, setBuyRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [currency, setCurrency] = useState("ETB");

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from("platform_settings").select("key, value"),
        supabase.from("platform_exchange_rates").select("*"),
      ]);
      const map: Record<string, string> = {};
      (s ?? []).forEach((row: any) => { map[row.key] = row.value; });
      setSettings(map);
      setRates(r ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  async function updateRate() {
    if (!buyRate || !sellRate) return;
    const { error } = await supabase.rpc("update_exchange_rate", {
      p_currency: currency,
      p_buy_rate: Number(buyRate),
      p_sell_rate: Number(sellRate),
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Rate updated");
      const { data } = await supabase.from("platform_exchange_rates").select("*");
      setRates(data ?? []);
    }
  }

  if (loading) return <div style={{ color: "#666", padding: 40, textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 700 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#fff" }}>Exchange Rates</h3>
        {rates.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 13, color: "#ccc" }}>
            <span style={{ fontWeight: 600 }}>{r.currency_code}</span>
            <span>Buy: {r.buy_rate}</span>
            <span>Sell: {r.sell_rate}</span>
            <span style={{ color: "#666" }}>{new Date(r.updated_at).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Currency" style={inputStyle} />
          <input value={buyRate} onChange={(e) => setBuyRate(e.target.value)} placeholder="Buy rate" style={inputStyle} />
          <input value={sellRate} onChange={(e) => setSellRate(e.target.value)} placeholder="Sell rate" style={inputStyle} />
          <button onClick={() => void updateRate()} style={btnStyle}>Update Rate</button>
        </div>
        {message && <div style={{ marginTop: 10, color: "#f5b51b", fontSize: 13 }}>{message}</div>}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#fff" }}>Platform Settings (key/value)</h3>
        {Object.keys(settings).length === 0 ? (
          <div style={{ color: "#555", fontSize: 13 }}>No settings stored yet</div>
        ) : (
          Object.entries(settings).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #151515", fontSize: 13 }}>
              <span style={{ color: "#999" }}>{k}</span>
              <span style={{ color: "#ddd" }}>{v}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#111", border: "1px solid #2a2a2a", borderRadius: 8,
  padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none", width: 120,
};
const btnStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 8, border: "none",
  background: "#f5b51b", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: 13,
};
