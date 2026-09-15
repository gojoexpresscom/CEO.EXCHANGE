/**
 * Benefit row — clean, restrained, mobile-first.
 */

import React from "react";
import { CARD, BORDER, GOLD, TEXT, TEXT_DIM } from "./tokens";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  index?: number;
};

export default function PromotionFeature({
  icon,
  title,
  description,
  index = 0,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "15px 16px",
        background: `linear-gradient(145deg, ${CARD} 0%, #0d0d0d 100%)`,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        animation: `ceoPromoFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${1.7 + index * 0.1}s both`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(145deg, ${GOLD}28, ${GOLD}08)`,
          border: `1px solid ${GOLD}40`,
          color: GOLD,
          fontSize: 17,
          boxShadow: `inset 0 1px 0 ${GOLD}33`,
        }}
      >
        {icon ?? "◆"}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 650,
            color: TEXT,
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.42,
            color: TEXT_DIM,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}
