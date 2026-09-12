import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Tickets() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setMessage(error.message);
    else {
      setMessage(`Ticket marked ${status}`);
      await load();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {message && <div style={{ color: "#f5b51b", fontSize: 13 }}>{message}</div>}
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
              <th style={th}>Subject</th>
              <th style={th}>Status</th>
              <th style={th}>Updated</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#555" }}>No tickets</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
                <td style={td}>
                  <div style={{ color: "#eee" }}>{r.subject}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.message?.slice(0, 80)}
                  </div>
                </td>
                <td style={td}><StatusBadge status={r.status} /></td>
                <td style={td}>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {r.status !== "resolved" && r.status !== "closed" && (
                    <>
                      <button onClick={() => void updateStatus(r.id, "in_progress")} style={btn("#3b82f6")}>In Progress</button>
                      <button onClick={() => void updateStatus(r.id, "resolved")} style={{ ...btn("#22c55e"), marginLeft: 6 }}>Resolve</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "open" ? "#ef4444" : status === "in_progress" ? "#3b82f6" : status === "resolved" ? "#22c55e" : "#888";
  return <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, background: `${color}22`, color }}>{status}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
function btn(color: string): React.CSSProperties {
  return { padding: "4px 10px", borderRadius: 6, border: "none", background: `${color}22`, color, fontSize: 11, cursor: "pointer" };
}
