import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Logs() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("admin_activity_log")
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
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
            <th style={th}>Time</th>
            <th style={th}>Event</th>
            <th style={th}>Description</th>
            <th style={th}>Actor</th>
            <th style={th}>Target</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#555" }}>No logs yet</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
              <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
              <td style={td}>{r.event_type}</td>
              <td style={td}>{r.description}</td>
              <td style={td}>{r.actor_id?.slice(0, 8) || "—"}</td>
              <td style={td}>{r.target_id?.slice(0, 8) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
