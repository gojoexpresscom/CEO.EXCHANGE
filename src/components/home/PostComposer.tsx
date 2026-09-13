/**
 * CEO Exchange — Post Composer
 * Full-screen create post (text + optional image URL for now).
 *
 * Wire in Home.tsx:
 *   import PostComposer from "./PostComposer";
 *   ...
 *   {modal === "post" && (
 *     <PostComposer
 *       onClose={closeModal}
 *       onPublished={() => {
 *         closeModal();
 *         if (userId) void loadPosts(userId, feedTab);
 *       }}
 *     />
 *   )}
 *
 * And add a floating / section button that does setModal("post").
 */

import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";
const BG = "#050505";
const CARD = "#101010";
const BORDER = "#2a2110";

const MOTION = `
@keyframes pcIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

type Props = {
  onClose: () => void;
  onPublished: () => void;
};

export default function PostComposer({ onClose, onPublished }: Props) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    const text = content.trim();
    if (text.length < 1) {
      setError("Write something first.");
      return;
    }
    if (text.length > 2000) {
      setError("Post is too long (max 2000 characters).");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: uid,
        content: text,
        image_url: imageUrl.trim() || null,
      });

      if (insertError) throw insertError;

      onPublished();
    } catch (e: any) {
      setError(e?.message || "Could not publish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <style>{MOTION}</style>

      <header style={header}>
        <button type="button" style={ghostBtn} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <h2 style={title}>New post</h2>
        <button
          type="button"
          style={{
            ...publishBtn,
            opacity: busy || content.trim().length < 1 ? 0.5 : 1,
          }}
          onClick={() => void publish()}
          disabled={busy || content.trim().length < 1}
        >
          {busy ? "…" : "Publish"}
        </button>
      </header>

      <div style={{ ...body, animation: "pcIn 0.3s ease-out both" }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an update with the CEO community…"
          autoFocus
          maxLength={2000}
          style={textarea}
        />

        <div style={charCount}>{content.length}/2000</div>

        <label style={label}>
          <span style={{ color: "#888", fontSize: 12, fontWeight: 600 }}>
            Image URL (optional)
          </span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            style={input}
          />
        </label>

        {error && <div style={errorBox}>{error}</div>}
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 95,
  background: BG,
  display: "flex",
  flexDirection: "column",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  paddingTop: "calc(12px + env(safe-area-inset-top))",
  borderBottom: "1px solid #1a1a1a",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#f5f5f5",
};

const ghostBtn: React.CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
  border: 0,
  borderRadius: 10,
  background: "transparent",
  color: "#aaa",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const publishBtn: React.CSSProperties = {
  minHeight: 36,
  padding: "0 16px",
  border: 0,
  borderRadius: 10,
  background: `linear-gradient(135deg,${GOLD},#d98e00)`,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const body: React.CSSProperties = {
  flex: 1,
  padding: "16px 14px",
  overflowY: "auto",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 160,
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: "14px 14px",
  color: "#fff",
  fontSize: 16,
  lineHeight: 1.5,
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
};

const charCount: React.CSSProperties = {
  textAlign: "right",
  fontSize: 11,
  color: "#666",
  marginTop: 6,
  marginBottom: 16,
};

const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "0 14px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const errorBox: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 12,
  background: "#1d0c0e",
  border: "1px solid #4c2025",
  color: "#ff9aa3",
  fontSize: 13,
};
