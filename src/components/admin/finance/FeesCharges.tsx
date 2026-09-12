import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import StatCard from "../shared/StatCard";

export default function FeesCharges() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: n }, { data: l }] = await Promise.all([
        supabase.from("fee_schedules").select("*"),
        supabase.from("fee_schedules_networks").select("*"),
        supabase.from("platform_fees_log").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      setSchedules(s ?? []);
      setNetworks(n ?? []);
      setLog(l ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const totalFees = log.reduce((s, r) => s + Number(r.fee_amount || 0), 0);

  if (loading) return <div style={{ color: "#666", padding: 40, textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StatCard label="Total Fees Collected (recent log)" value={`$${totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#fff" }}>Fee Schedules</h3>
        {schedules.length === 0 ? <div style={{ color: "#555" }}>No schedules</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={th}>Type</th>
                <th style={th}>Maker</th>
                <th style={th}>Taker</th>
                <th style={th}>Fixed</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={td}>{s.fee_type}</td>
                  <td style={td}>{s.maker_fee_rate}</td>
                  <td style={td}>{s.taker_fee_rate}</td>
                  <td style={td}>{s.fixed_fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#fff" }}>Network Fees</h3>
        {networks.length === 0 ? <div style={{ color: "#555" }}>No network fees</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={th}>Currency</th>
                <th style={th}>Network</th>
                <th style={th}>Min Deposit</th>
                <th style={th}>Min Withdrawal</th>
                <th style={th}>Platform %</th>
                <th style={th}>Flat</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.id} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={td}>{n.currency}</td>
                  <td style={td}>{n.network}</td>
                  <td style={td}>{n.min_deposit}</td>
                  <td style={td}>{n.min_withdrawal}</td>
                  <td style={td}>{n.platform_fee_percent}</td>
                  <td style={td}>{n.platform_fee_flat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px", color: "#ccc" };
