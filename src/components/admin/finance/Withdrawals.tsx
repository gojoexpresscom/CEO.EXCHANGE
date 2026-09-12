import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function Withdrawals() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function process(id: string, decision: "APPROVED" | "REJECTED") {
    const notes = window.prompt(`Notes for ${decision}:`) ?? "";
    setBusy(id);
    setMessage("");
    const { error } = await supabase.rpc("owner_process_withdrawal", {
      p_withdrawal_id: id,
      p_decision: decision,
      p_notes: notes,
    });
    if (error) setMessage(error.message);
    else {
      setMessage(`${decision} applied`);
      await load();
    }
    setBusy(null);
  }

  async function refund(id: string) {
    const reason = window.prompt("Refund reason:") ?? "";
    setBusy(id);
    const { error } = await supabase.rpc("admin_refund_failed_withdrawal", {
      p_withdrawal_id: id,
      p_reason: reason,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Refund processed");
      await load();
    }
    setBusy(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {message && <div style={{ color: "#f5b51b", fontSize: 13 }}>{message}</div>}
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
              <th style={th}>Asset</th>
              <th style={th}>Amount</th>
              <th style={th}>Fee</th>
              <th style={th}>Net</th>
              <th style={th}>Network</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#555" }}>No withdrawals</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
                <td style={td}>{r.asset}</td>
                <td style={td}>{Number(r.amount).toFixed(6)}</td>
                <td style={td}>{Number(r.fee || 0).toFixed(6)}</td>
                <td style={td}>{Number(r.net_amount || 0).toFixed(6)}</td>
                <td style={td}>{r.network}</td>
                <td style={td}><StatusBadge status={r.status} /></td>
                <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {r.status === "pending" && (
                    <>
                      <button disabled={!!busy} onClick={() => void process(r.id, "APPROVED")} style={btn("#22c55e")}>Approve</button>
                      <button disabled={!!busy} onClick={() => void process(r.id, "REJECTED")} style={{ ...btn("#ef4444"), marginLeft: 6 }}>Reject</button>
                    </>
                  )}
                  {r.status === "failed" && (
                    <button disabled={!!busy} onClick={() => void refund(r.id)} style={btn("#f59e0b")}>Refund</button>
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
  const color = status === "completed" || status === "approved" ? "#22c55e" : status === "pending" ? "#f59e0b" : "#ef4444";
  return <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, background: `${color}22`, color }}>{status}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 16px", color: "#ccc" };
function btn(color: string): React.CSSProperties {
  return { padding: "4px 10px", borderRadius: 6, border: "none", background: `${color}22`, color, fontSize: 11, cursor: "pointer" };
}
