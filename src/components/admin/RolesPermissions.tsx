import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function RolesPermissions() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("admin_roles").select("*"),
        supabase.from("admin_permissions").select("*"),
      ]);
      setRoles(r ?? []);
      setPermissions(p ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <div style={{ color: "#666", padding: 40, textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#fff" }}>Admin Roles</h3>
        {roles.length === 0 ? (
          <div style={{ color: "#555", fontSize: 13 }}>No roles defined</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f", color: "#777" }}>
                <th style={th}>Role</th>
                <th style={th}>Description</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={td}>{r.role_name}</td>
                  <td style={td}>{r.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#fff" }}>Permissions</h3>
        {permissions.length === 0 ? (
          <div style={{ color: "#555", fontSize: 13 }}>No permissions defined yet (fine-grained system is available but mostly empty)</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {permissions.map((p) => (
              <span key={p.id} style={{ padding: "4px 10px", borderRadius: 6, background: "#151515", fontSize: 12, color: "#aaa" }}>
                {p.permission_name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px", color: "#ccc" };
