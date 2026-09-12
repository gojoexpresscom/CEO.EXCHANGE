import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function P2PDisputes() {
  const [tradeId, setTradeId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function release() {
    if (!tradeId.trim()) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("admin_force_release_p2p_escrow", {
      p_trade_id: tradeId.trim(),
      p_admin_notes: notes || "",
    });
    if (error) setMessage(error.message);
    else setMessage("Escrow released to buyer");
    setBusy(false);
  }

  async function refund() {
    if (!tradeId.trim()) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("admin_refund_p2p_escrow", {
      p_trade_id: tradeId.trim(),
      p_admin_notes: notes || "",
    });
    if (error) setMessage(error.message);
    else setMessage("Escrow refunded to seller");
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 24 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#fff" }}>P2P Dispute Resolution</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
          Resolve disputed P2P trades by releasing escrow to the buyer or refunding it to the seller.
        </p>

        <label style={{ display: "block", fontSize: 12, color: "#777", marginBottom: 6 }}>Trade ID</label>
        <input
          value={tradeId}
          onChange={(e) => setTradeId(e.target.value)}
          placeholder="UUID of the disputed trade"
          style={inputStyle}
        />

        <label style={{ display: "block", fontSize: 12, color: "#777", margin: "14px 0 6px" }}>Admin Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            onClick={() => void release()}
            disabled={busy}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: "rgba(34,197,94,0.2)",
              color: "#22c55e",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Release to Buyer
          </button>
          <button
            onClick={() => void refund()}
            disabled={busy}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: "rgba(239,68,68,0.2)",
              color: "#ef4444",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Refund to Seller
          </button>
        </div>

        {message && (
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "#151515", color: "#f5b51b", fontSize: 13 }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
