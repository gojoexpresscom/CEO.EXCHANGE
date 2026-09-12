import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Announcements() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    if (!title.trim() || !body.trim()) return;
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      posted_by: session?.user?.id,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Announcement created");
      setTitle("");
      setBody("");
      await load();
    }
    setCreating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#fff" }}>Create Announcement</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          style={inputStyle}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
          rows={3}
          style={{ ...inputStyle, marginTop: 10, resize: "vertical" }}
        />
        <button
          onClick={() => void create()}
          disabled={creating}
          style={{
            marginTop: 12,
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "#f5b51b",
            color: "#000",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {creating ? "Posting…" : "Post Announcement"}
        </button>
        {message && <div style={{ marginTop: 10, color: "#f5b51b", fontSize: 13 }}>{message}</div>}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#555" }}>No announcements</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((r) => (
              <div key={r.id} style={{ padding: "16px 20px", borderBottom: "1px solid #151515" }}>
                <div style={{ fontWeight: 600, color: "#eee", marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 13, color: "#999", whiteSpace: "pre-wrap" }}>{r.body}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
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
