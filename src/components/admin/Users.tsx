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

type PenalizeAction = "BAN" | "UNBAN" | "WARN";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";

const MOTION = `
@keyframes usersFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes usersModalIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
`;

export default function Users() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Professional reason modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<PenalizeAction>("BAN");
  const [modalUser, setModalUser] = useState<ProfileRow | null>(null);
  const [reason, setReason] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, role, kyc_status, is_banned, usdt_balance, uid, nickname, created_at, warning_count"
      )
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

  function openModal(user: ProfileRow, action: PenalizeAction) {
    setModalUser(user);
    setModalAction(action);
    setReason("");
    setModalError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (modalBusy) return;
    setModalOpen(false);
    setModalUser(null);
    setReason("");
    setModalError("");
  }

  async function confirmPenalize() {
    if (!modalUser) return;

    const trimmed = reason.trim();
    if (modalAction !== "UNBAN" && trimmed.length < 3) {
      setModalError("Please enter a clear reason (at least 3 characters).");
      return;
    }

    setModalBusy(true);
    setModalError("");
    setActionLoading(modalUser.id + modalAction);
    setMessage("");

    try {
      const { error } = await supabase.rpc("admin_penalize_user", {
        p_target_user_id: modalUser.id,
        p_action: modalAction,
        p_reason: trimmed || (modalAction === "UNBAN" ? "Ban lifted by admin" : ""),
      });

      if (error) throw error;

      setMessage(
        modalAction === "BAN"
          ? `User banned successfully.`
          : modalAction === "UNBAN"
          ? `User unbanned.`
          : `Warning issued.`
      );
      closeModal();
      await loadUsers();
    } catch (e: any) {
      setModalError(e?.message || "Action failed. Try again.");
    } finally {
      setModalBusy(false);
      setActionLoading(null);
    }
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

  const actionLabel =
    modalAction === "BAN" ? "Ban user" : modalAction === "UNBAN" ? "Lift ban" : "Issue warning";
  const actionColor =
    modalAction === "BAN" ? "#ef4444" : modalAction === "UNBAN" ? "#22c55e" : "#f59e0b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "usersFadeIn 0.3s ease-out both" }}>
      <style>{MOTION}</style>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, UID or nickname…"
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
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "#1a1508",
            border: `1px solid #2a2110`,
            color: GOLD_LIGHT,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
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
                      <div style={{ fontWeight: 600, color: "#eee" }}>{u.nickname || u.email}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{u.email}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#999" }}>{u.uid || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            u.role === "owner" || u.role === "admin" ? "rgba(245,181,27,0.15)" : "#1a1a1a",
                          color: u.role === "owner" || u.role === "admin" ? GOLD : "#aaa",
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
                          fontWeight: 600,
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
                        <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>Banned</span>
                      ) : (
                        <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>Active</span>
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
                            onClick={() => openModal(u, "BAN")}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: "rgba(239,68,68,0.15)",
                              color: "#ef4444",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Ban
                          </button>
                        ) : (
                          <button
                            disabled={!!actionLoading}
                            onClick={() => openModal(u, "UNBAN")}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: "rgba(34,197,94,0.15)",
                              color: "#22c55e",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Unban
                          </button>
                        )}
                        <button
                          disabled={!!actionLoading}
                          onClick={() => openModal(u, "WARN")}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "rgba(245,158,11,0.15)",
                            color: "#f59e0b",
                            fontSize: 12,
                            fontWeight: 700,
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

      {/* Professional reason modal */}
      {modalOpen && modalUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#0c0c0c",
              border: "1px solid #2a2110",
              borderRadius: 16,
              padding: "22px 20px",
              animation: "usersModalIn 0.28s ease-out both",
              boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>{actionLabel}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#999" }}>
                  {modalUser.nickname || modalUser.email}
                  {modalUser.uid ? ` · ${modalUser.uid}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "transparent",
                  color: "#888",
                  fontSize: 18,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>
                {modalAction === "UNBAN" ? "Note (optional)" : "Reason (required)"}
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  modalAction === "BAN"
                    ? "e.g. Multiple policy violations, chargeback abuse…"
                    : modalAction === "WARN"
                    ? "e.g. First warning for spam messages…"
                    : "Optional note for the record"
                }
                rows={4}
                autoFocus
                style={{
                  width: "100%",
                  background: "#111",
                  border: "1px solid #2a2110",
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.45,
                }}
              />
            </label>

            {modalError && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#1d0c0e",
                  border: "1px solid #4c2025",
                  color: "#ff9aa3",
                  fontSize: 13,
                }}
              >
                {modalError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={modalBusy}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 12,
                  border: "1px solid #333",
                  background: "transparent",
                  color: "#ccc",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmPenalize()}
                disabled={modalBusy}
                style={{
                  flex: 1.3,
                  minHeight: 46,
                  borderRadius: 12,
                  border: "none",
                  background: actionColor,
                  color: "#0a0a0a",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: modalBusy ? 0.7 : 1,
                }}
              >
                {modalBusy ? "Processing…" : actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
