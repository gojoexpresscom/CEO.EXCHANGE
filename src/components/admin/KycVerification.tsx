import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface KycRow {
  id: string;
  user_id: string;
  full_name: string | null;
  document_type: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  front_image_url: string | null;
  back_image_url: string | null;
  selfie_url: string | null;
  profiles?: { email: string; uid: string | null } | null;
}

export default function KycVerification() {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "VERIFIED" | "REJECTED">("ALL");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("kyc_submissions")
      .select("id, user_id, full_name, document_type, status, rejection_reason, created_at, front_image_url, back_image_url, selfie_url")
      .order("created_at", { ascending: false });

    if (filter !== "ALL") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      setMessage(error.message);
      setRows([]);
    } else {
      // fetch emails separately for display
      const list = (data as KycRow[]) ?? [];
      const userIds = [...new Set(list.map((r) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, uid")
          .in("id", userIds);
        const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        list.forEach((r) => {
          r.profiles = map.get(r.user_id) ?? null;
        });
      }
      setRows(list);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function review(id: string, decision: "VERIFIED" | "REJECTED") {
    const reason = decision === "REJECTED" ? window.prompt("Rejection reason:") : "";
    if (decision === "REJECTED" && reason === null) return;

    setBusy(id);
    setMessage("");

    const { error } = await supabase.rpc("admin_review_kyc", {
      p_submission_id: id,
      p_decision: decision,
      p_reason: reason || "",
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`${decision} applied`);
      await load();
    }
    setBusy(null);
  }

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["ALL", "PENDING", "VERIFIED", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: filter === f ? "rgba(245,181,27,0.2)" : "#151515",
              color: filter === f ? "#f5b51b" : "#999",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f} {f === "PENDING" && pendingCount > 0 ? `(${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#1a1a1a", color: "#f5b51b", fontSize: 13 }}>
          {message}
        </div>
      )}

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>User</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Full Name</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Document</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Status</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Submitted</th>
                <th style={{ textAlign: "right", padding: "12px 16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#555" }}>No KYC submissions</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ color: "#eee" }}>{r.profiles?.email || r.user_id.slice(0, 8)}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{r.profiles?.uid || ""}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#ccc" }}>{r.full_name || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "#aaa" }}>{r.document_type || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          background:
                            r.status === "VERIFIED" ? "rgba(34,197,94,0.15)" :
                            r.status === "PENDING" ? "rgba(245,158,11,0.15)" :
                            "rgba(239,68,68,0.15)",
                          color:
                            r.status === "VERIFIED" ? "#22c55e" :
                            r.status === "PENDING" ? "#f59e0b" : "#ef4444",
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#777", fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {r.status === "PENDING" && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            disabled={!!busy}
                            onClick={() => void review(r.id, "VERIFIED")}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "none",
                              background: "rgba(34,197,94,0.15)",
                              color: "#22c55e",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Approve
                          </button>
                          <button
                            disabled={!!busy}
                            onClick={() => void review(r.id, "REJECTED")}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "none",
                              background: "rgba(239,68,68,0.15)",
                              color: "#ef4444",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {r.status === "REJECTED" && r.rejection_reason && (
                        <span style={{ fontSize: 11, color: "#888" }}>{r.rejection_reason}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
