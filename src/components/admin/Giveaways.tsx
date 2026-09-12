import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Giveaways() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("giveaways")
        .select("*")
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
            <th style={th}>Title</th>
            <th style={th}>Prize</th>
            <th style={th}>Status</th>
            <th style={th}>Starts</th>
            <th style={th}>Ends</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#555" }}>No giveaways</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
              <td style={td}>
                <div style={{ color: "#eee" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{r.description?.slice(0, 60)}</div>
              </td>
              <td style={td}>{r.prize_amount}</td>
              <td style={td}><StatusBadge status={r.status} /></td>
              <td style={td}>{r.starts_at ? new Date(r.starts_at).toLocaleDateString() : "—"}</td>
              <td style={td}>{r.ends_at ? new Date(r.ends_at).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "active" ? "#22c55e" : status === "upcoming" ? "#3b82f6" : "#888";
  return <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, background: `${color}22`, color }}>{status}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
