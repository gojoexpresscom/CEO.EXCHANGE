/**
 * Admin-only promotional content panel.
 *
 * STATIC WORKFLOW — no database, no Supabase writes.
 * Content lives in src/components/promotion/content.ts
 * Media lives in public/promotions/{images,videos}/
 * Update via GitHub commit → Vercel deploy.
 */

import type { CSSProperties } from "react";
import { getAllPromoCards, type PromoCardItem } from "../promotion/content";
import { GOLD, GOLD_LIGHT } from "../promotion/tokens";

const inputReadonly: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #222",
  background: "#0c0c0c",
  color: "#aaa",
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export default function Promotions() {
  const items = getAllPromoCards();
  const published = items.filter((i) => i.published);
  const draft = items.filter((i) => !i.published);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#fff", fontWeight: 700 }}>
          Promotions
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#888", lineHeight: 1.45 }}>
          Static promotional catalog. No live CMS. Edit code + assets, commit to GitHub,
          deploy on Vercel.
        </p>
      </div>

      {/* Workflow guide */}
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 14, color: GOLD, fontWeight: 650 }}>
          How to update promotional content
        </h3>
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            color: "#ccc",
            fontSize: 13,
            lineHeight: 1.65,
          }}
        >
          <li>
            Add media under{" "}
            <code style={code}>public/promotions/images/</code> or{" "}
            <code style={code}>public/promotions/videos/</code>
          </li>
          <li>
            Edit{" "}
            <code style={code}>src/components/promotion/content.ts</code> — set{" "}
            <code style={code}>title</code>, <code style={code}>description</code>,{" "}
            <code style={code}>image</code> / <code style={code}>video</code>,{" "}
            <code style={code}>ctaLabel</code>, <code style={code}>ctaHref</code>,{" "}
            <code style={code}>published</code>
          </li>
          <li>
            Commit to GitHub → Vercel rebuilds. Users only see items with{" "}
            <code style={code}>published: true</code>
          </li>
        </ol>
        <p style={{ margin: "14px 0 0", fontSize: 12, color: "#666", lineHeight: 1.4 }}>
          CTA destinations: <code style={code}>markets</code>,{" "}
          <code style={code}>p2p</code>, <code style={code}>close</code>,{" "}
          <code style={code}>/path</code>, or full <code style={code}>https://…</code>
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Stat label="Published" value={String(published.length)} />
        <Stat label="Unpublished" value={String(draft.length)} />
        <Stat label="Total" value={String(items.length)} />
      </div>

      {/* Catalog list */}
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1a1a1a",
            fontSize: 13,
            fontWeight: 650,
            color: "#eee",
          }}
        >
          Catalog (from content.ts)
        </div>
        {items.length === 0 ? (
          <div style={{ padding: 24, color: "#666", fontSize: 13 }}>
            No items in the static catalog yet.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item) => (
              <PromoRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>

      {/* Path reference */}
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Source file</div>
        <input
          readOnly
          value="src/components/promotion/content.ts"
          style={inputReadonly}
        />
        <div style={{ fontSize: 12, color: "#888", margin: "12px 0 8px" }}>
          Media folders
        </div>
        <input
          readOnly
          value="public/promotions/images/  ·  public/promotions/videos/"
          style={inputReadonly}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: "1 1 100px",
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: GOLD_LIGHT }}>{value}</div>
    </div>
  );
}

function PromoRow({ item }: { item: PromoCardItem }) {
  return (
    <li
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid #141414",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 2,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "3px 8px",
          borderRadius: 6,
          background: item.published ? "rgba(245,181,27,0.15)" : "#1a1a1a",
          color: item.published ? GOLD : "#666",
          border: item.published ? `1px solid ${GOLD}44` : "1px solid #222",
        }}
      >
        {item.published ? "Live" : "Off"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: "#eee" }}>{item.title}</div>
        <div style={{ fontSize: 12, color: "#777", marginTop: 3, lineHeight: 1.4 }}>
          {item.description}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "#555",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {item.id} · {item.category}
          {item.ctaHref ? ` · cta→${item.ctaHref}` : ""}
          {item.image ? ` · img` : ""}
          {item.video ? ` · video` : ""}
        </div>
      </div>
    </li>
  );
}

const code: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: GOLD,
  background: "rgba(245,181,27,0.08)",
  padding: "1px 5px",
  borderRadius: 4,
};
