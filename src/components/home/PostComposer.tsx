/**
 * CEO Exchange — Post Composer (full-screen)
 * Uses existing public.posts columns: user_id, content, image_url.
 * Extra fields composed into content so we never invent DB columns.
 */

import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffd45a";
const BG = "#050505";
const CARD = "#121212";
const BORDER = "#2a2a2a";

const TOPICS = ["BTC", "ETH", "Markets", "P2P", "CEO", "News", "Analysis"];
const COINS = ["BTC", "ETH", "USDT", "SOL", "BNB", "XRP"];
const SENTIMENTS = [
  { id: "bullish", label: "Bullish", color: "#39d98a" },
  { id: "bearish", label: "Bearish", color: "#ff6574" },
  { id: "neutral", label: "Neutral", color: "#888" },
] as const;

type Props = {
  onClose: () => void;
  onPublished: () => void;
};

export default function PostComposer({ onClose, onPublished }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [coin, setCoin] = useState<string | null>(null);
  const [mention, setMention] = useState("");
  const [sentiment, setSentiment] = useState<(typeof SENTIMENTS)[number]["id"] | null>(null);
  const [link, setLink] = useState("");
  const [panel, setPanel] = useState<"none" | "topic" | "coin" | "user" | "sentiment" | "link">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onPickImage = (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8 MB.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const toggleTopic = (t: string) => {
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 5)));
  };

  async function uploadImage(uid: string, file: File): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    for (const bucket of ["post-media", "posts", "avatars"]) {
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (!upErr) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl || path;
      }
    }
    return null;
  }

  async function publish() {
    const body = content.trim();
    const t = title.trim();
    if (!body && !t) {
      setError("Add a title or write something before publishing.");
      return;
    }
    if (body.length > 2000) {
      setError("Post is too long (max 2000 characters).");
      return;
    }
    if (link.trim() && !/^https?:\/\//i.test(link.trim())) {
      setError("Link must start with http:// or https://");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");

      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(uid, imageFile);
        if (!imageUrl) {
          throw new Error(
            "Could not upload image. Ask Cloud to enable a public post-media (or posts) storage bucket."
          );
        }
      }

      const parts: string[] = [];
      if (sentiment) {
        const s = SENTIMENTS.find((x) => x.id === sentiment);
        if (s) parts.push(`[${s.label}]`);
      }
      if (t) parts.push(t);
      if (body) parts.push(body);
      if (coin) parts.push(`$${coin}`);
      if (topics.length) parts.push(topics.map((x) => `#${x}`).join(" "));
      if (mention.trim()) parts.push(`@${mention.trim().replace(/^@/, "")}`);
      if (link.trim()) parts.push(link.trim());

      const finalContent = parts.join("\n\n").slice(0, 2000);

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: uid,
        content: finalContent,
        image_url: imageUrl,
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
      <header style={header}>
        <button type="button" style={iconBtn} onClick={onClose} disabled={busy} aria-label="Back">
          ←
        </button>
        <h2 style={titleStyle}>Post</h2>
        <button
          type="button"
          style={{
            ...publishBtn,
            opacity: busy || (!content.trim() && !title.trim()) ? 0.45 : 1,
          }}
          onClick={() => void publish()}
          disabled={busy || (!content.trim() && !title.trim())}
        >
          {busy ? "…" : "Publish"}
        </button>
      </header>

      <div style={body}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            onPickImage(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <button type="button" style={mediaBox} onClick={() => fileRef.current?.click()} disabled={busy}>
          {imagePreview ? (
            <img src={imagePreview} alt="Selected" style={mediaImg} />
          ) : (
            <span style={{ color: "#666", fontSize: 28, fontWeight: 300 }}>+</span>
          )}
        </button>
        {imagePreview && (
          <button type="button" style={removeMedia} onClick={() => onPickImage(null)}>
            Remove image
          </button>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder="Add a title"
          style={titleInput}
          disabled={busy}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 2000))}
          placeholder="Share your thoughts and opinions"
          style={textarea}
          disabled={busy}
        />
        <div style={charCount}>{content.length}/2000</div>

        {(topics.length > 0 || coin || mention || sentiment || link) && (
          <div style={chips}>
            {sentiment && (
              <span style={{ ...chip, color: SENTIMENTS.find((s) => s.id === sentiment)?.color }}>
                {SENTIMENTS.find((s) => s.id === sentiment)?.label}
              </span>
            )}
            {topics.map((t) => (
              <span key={t} style={chip}>
                #{t}
              </span>
            ))}
            {coin && <span style={chip}>${coin}</span>}
            {mention && <span style={chip}>@{mention.replace(/^@/, "")}</span>}
            {link && (
              <span style={{ ...chip, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                link
              </span>
            )}
          </div>
        )}

        <div style={toolbar}>
          <button type="button" style={toolBtn} onClick={() => setPanel(panel === "topic" ? "none" : "topic")}>
            # Topic
          </button>
          <button type="button" style={toolBtn} onClick={() => setPanel(panel === "coin" ? "none" : "coin")}>
            $ Coins
          </button>
          <button type="button" style={toolBtn} onClick={() => setPanel(panel === "user" ? "none" : "user")}>
            @ User
          </button>
          <button
            type="button"
            style={toolBtn}
            onClick={() => setPanel(panel === "sentiment" ? "none" : "sentiment")}
          >
            Market
          </button>
        </div>

        {panel === "topic" && (
          <div style={panelBox}>
            {TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                style={{ ...chipBtn, borderColor: topics.includes(t) ? GOLD : BORDER }}
                onClick={() => toggleTopic(t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        {panel === "coin" && (
          <div style={panelBox}>
            {COINS.map((c) => (
              <button
                key={c}
                type="button"
                style={{ ...chipBtn, borderColor: coin === c ? GOLD : BORDER }}
                onClick={() => setCoin(coin === c ? null : c)}
              >
                ${c}
              </button>
            ))}
          </div>
        )}
        {panel === "user" && (
          <div style={panelBox}>
            <input
              value={mention}
              onChange={(e) => setMention(e.target.value.replace(/\s/g, "").slice(0, 32))}
              placeholder="username"
              style={inlineInput}
            />
          </div>
        )}
        {panel === "sentiment" && (
          <div style={panelBox}>
            {SENTIMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                style={{ ...chipBtn, borderColor: sentiment === s.id ? s.color : BORDER, color: s.color }}
                onClick={() => setSentiment(sentiment === s.id ? null : s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {panel === "link" && (
          <div style={panelBox}>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value.slice(0, 300))}
              placeholder="https://"
              style={inlineInput}
            />
          </div>
        )}

        <button type="button" style={linkRow} onClick={() => setPanel(panel === "link" ? "none" : "link")}>
          <span>Add Link</span>
          <span style={{ color: "#666" }}>›</span>
        </button>

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
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
};
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  paddingTop: "calc(12px + env(safe-area-inset-top))",
  borderBottom: "1px solid #1a1a1a",
};
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 800, color: "#f5f5f5" };
const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: "#eee",
  fontSize: 20,
  cursor: "pointer",
};
const publishBtn: React.CSSProperties = {
  minHeight: 36,
  padding: "0 16px",
  border: 0,
  borderRadius: 20,
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};
const body: React.CSSProperties = {
  flex: 1,
  padding: "16px 14px calc(24px + env(safe-area-inset-bottom))",
  overflowY: "auto",
};
const mediaBox: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 14,
  border: `1px solid ${BORDER}`,
  background: CARD,
  display: "grid",
  placeItems: "center",
  marginBottom: 10,
  padding: 0,
  cursor: "pointer",
  overflow: "hidden",
};
const mediaImg: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const removeMedia: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: GOLD_LIGHT,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
  cursor: "pointer",
  padding: 0,
};
const titleInput: React.CSSProperties = {
  width: "100%",
  border: 0,
  background: "transparent",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
  outline: "none",
  marginBottom: 8,
  padding: "4px 0",
};
const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 140,
  border: 0,
  background: "transparent",
  color: "#ddd",
  fontSize: 15,
  lineHeight: 1.5,
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
};
const charCount: React.CSSProperties = { textAlign: "right", fontSize: 11, color: "#555", marginBottom: 12 };
const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 };
const chip: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 99,
  background: "#1a1a1a",
  border: `1px solid ${BORDER}`,
  color: GOLD_LIGHT,
  fontSize: 12,
  fontWeight: 700,
};
const toolbar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 10,
};
const toolBtn: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 99,
  padding: "8px 12px",
  background: CARD,
  color: "#ddd",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const panelBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  background: CARD,
  border: `1px solid ${BORDER}`,
};
const chipBtn: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 99,
  padding: "8px 12px",
  background: "#0d0d0d",
  color: "#eee",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const inlineInput: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  minHeight: 40,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  background: "#0d0d0d",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
};
const linkRow: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 4px",
  border: 0,
  borderTop: `1px solid ${BORDER}`,
  background: "transparent",
  color: "#ddd",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 8,
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
