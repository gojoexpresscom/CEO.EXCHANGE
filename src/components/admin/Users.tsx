import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface ProfileRow {
  id: string;
  email: string;
  role: string;
  kyc_status: string | null;
  is_banned: boolean;
  usdt_balance: number | null;
  uid: string | null;
  nickname: string | null;
  created_at: string;
  warning_count: number | null;
}

export default function Users() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, kyc_status, is_banned, usdt_balance, uid, nickname, created_at, warning_count")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setUsers((data as ProfileRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function penalize(userId: string, action: "BAN" | "UNBAN" | "WARN") {
    const reason = window.prompt(`Reason for ${action}:`);
    if (reason === null) return;

    setActionLoading(userId + action);
    setMessage("");

    const { error } = await supabase.rpc("admin_penalize_user", {
      p_target_user_id: userId,
      p_action: action,
      p_reason: reason || "",
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`${action} successful`);
      await loadUsers();
    }
    setActionLoading(null);
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.uid || "").toLowerCase().includes(q) ||
      (u.nickname || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          style={{
            flex: 1,
            minWidth: 200,
            background: "#111",
            border: "1px solid #2a2a2a",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#fff",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={() => void loadUsers()}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #2a2a2a",
            background: "#151515",
            color: "#ccc",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#1a1a1a", color: "#f5b51b", fontSize: 13 }}>
          {message}
        </div>
      )}

      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500 }}>User</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500 }}>UID</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500 }}>Role</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500 }}>KYC</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 500 }}>USDT</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500 }}>Joined</th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#555" }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#555" }}>
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #151515" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 500, color: "#eee" }}>{u.nickname || u.email}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{u.email}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#999" }}>{u.uid || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          background: u.role === "owner" || u.role === "admin" ? "rgba(245,181,27,0.15)" : "#1a1a1a",
                          color: u.role === "owner" || u.role === "admin" ? "#f5b51b" : "#aaa",
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          background:
                            u.kyc_status === "VERIFIED"
                              ? "rgba(34,197,94,0.15)"
                              : u.kyc_status === "PENDING"
                              ? "rgba(245,158,11,0.15)"
                              : u.kyc_status === "REJECTED"
                              ? "rgba(239,68,68,0.15)"
                              : "#1a1a1a",
                          color:
                            u.kyc_status === "VERIFIED"
                              ? "#22c55e"
                              : u.kyc_status === "PENDING"
                              ? "#f59e0b"
                              : u.kyc_status === "REJECTED"
                              ? "#ef4444"
                              : "#888",
                        }}
                      >
                        {u.kyc_status || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {u.is_banned ? (
                        <span style={{ color: "#ef4444", fontSize: 12 }}>Banned</span>
                      ) : (
                        <span style={{ color: "#22c55e", fontSize: 12 }}>Active</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#ccc" }}>
                      ${Number(u.usdt_balance || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#777", fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {!u.is_banned ? (
                          <button
                            disabled={!!actionLoading}
                            onClick={() => void penalize(u.id, "BAN")}
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
                            Ban
                          </button>
                        ) : (
                          <button
                            disabled={!!actionLoading}
                            onClick={() => void penalize(u.id, "UNBAN")}
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
                            Unban
                          </button>
                        )}
                        <button
                          disabled={!!actionLoading}
                          onClick={() => void penalize(u.id, "WARN")}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "none",
                            background: "rgba(245,158,11,0.15)",
                            color: "#f59e0b",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Warn
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1a1a1a", color: "#666", fontSize: 12 }}>
          Showing {filtered.length} of {users.length} users
        </div>
      </div>
    </div>
  );
}
