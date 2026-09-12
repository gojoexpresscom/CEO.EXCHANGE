import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Transactions() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
              <th style={th}>TX ID</th>
              <th style={th}>Type</th>
              <th style={th}>Coin</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#555" }}>No transactions</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
                <td style={td}>{r.tx_id || r.id?.slice(0, 10)}</td>
                <td style={td}>{r.type}</td>
                <td style={td}>{r.coin}</td>
                <td style={td}>{Number(r.amount).toFixed(6)}</td>
                <td style={td}><StatusBadge status={r.status} /></td>
                <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "completed" || status === "success" ? "#22c55e" : status === "pending" ? "#f59e0b" : "#ef4444";
  return <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, background: `${color}22`, color }}>{status}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
