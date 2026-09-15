/**
 * Cinematic hero video block for CEO EXCHANGE Experience page.
 * Real launch footage — sits above the existing 3D hero as the lead visual.
 * Does not replace or alter the 3D visual, feature strip, cards, or CTA.
 */

import React, { useState } from "react";
import { BORDER, CARD } from "./tokens";

type Props = {
  src: string;
  poster?: string;
};

export default function PromotionVideoHero({ src, poster }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  return (
    <section
      style={{
        padding: "14px 16px 0",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          border: `1px solid ${BORDER}`,
          background: CARD,
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,181,27,0.06)",
          animation: "ceoHeroVideoIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <video
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          onError={() => setFailed(true)}
          style={{
            display: "block",
            width: "100%",
            maxHeight: "62vh",
            objectFit: "cover",
            background: "#000",
          }}
        />
      </div>

      <style>{`
        @keyframes ceoHeroVideoIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ceoHeroVideoIn"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
