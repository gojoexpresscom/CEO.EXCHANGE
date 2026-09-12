import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Merchants() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "requests">("list");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("merchant_requests").select("*").order("requested_at", { ascending: false }),
    ]);
    setMerchants(m ?? []);
    setRequests(r ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateRequest(id: string, status: string) {
    const { error } = await supabase
      .from("merchant_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setMessage(error.message);
    else {
      setMessage(`Request ${status}`);
      await load();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTab("list")} style={tabBtn(tab === "list")}>Merchants ({merchants.length})</button>
        <button onClick={() => setTab("requests")} style={tabBtn(tab === "requests")}>Requests ({requests.length})</button>
        <button onClick={() => void load()} style={{ marginLeft: "auto", ...tabBtn(false) }}>Refresh</button>
      </div>
      {message && <div style={{ color: "#f5b51b", fontSize: 13 }}>{message}</div>}

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</div>
        ) : tab === "list" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={th}>Business</th>
                <th style={th}>Status</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {merchants.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "#555" }}>No merchants</td></tr>
              ) : merchants.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={td}>{m.business_name}</td>
                  <td style={td}><StatusBadge status={m.status} /></td>
                  <td style={td}>{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={th}>Business</th>
                <th style={th}>Status</th>
                <th style={th}>Requested</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#555" }}>No requests</td></tr>
              ) : requests.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={td}>{r.business_name}</td>
                  <td style={td}><StatusBadge status={r.status} /></td>
                  <td style={td}>{new Date(r.requested_at).toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => void updateRequest(r.id, "approved")} style={actionBtn("#22c55e")}>Approve</button>
                        <button onClick={() => void updateRequest(r.id, "rejected")} style={{ ...actionBtn("#ef4444"), marginLeft: 6 }}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "approved" || status === "active" ? "#22c55e" : status === "pending" ? "#f59e0b" : "#ef4444";
  return <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, background: `${color}22`, color }}>{status}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8, border: "none",
    background: active ? "rgba(245,181,27,0.2)" : "#151515",
    color: active ? "#f5b51b" : "#999", cursor: "pointer", fontSize: 13,
  };
}
function actionBtn(color: string): React.CSSProperties {
  return { padding: "4px 10px", borderRadius: 6, border: "none", background: `${color}22`, color, fontSize: 11, cursor: "pointer" };
}
