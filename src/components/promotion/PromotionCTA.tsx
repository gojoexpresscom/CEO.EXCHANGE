/**
 * Primary action for promotional experiences.
 */

import React from "react";
import { GOLD, GOLD_LIGHT, GOLD_DEEP } from "./tokens";

type Props = {
  label: string;
  onClick?: () => void;
  secondary?: boolean;
  fullWidth?: boolean;
};

export default function PromotionCTA({
  label,
  onClick,
  secondary = false,
  fullWidth = true,
}: Props) {
  if (secondary) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: fullWidth ? "100%" : "auto",
          padding: "13px 20px",
          borderRadius: 13,
          border: `1px solid ${GOLD}55`,
          background: "rgba(245,181,27,0.06)",
          color: GOLD,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: fullWidth ? "100%" : "auto",
        padding: "15px 22px",
        borderRadius: 13,
        border: 0,
        background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 42%, ${GOLD_DEEP} 100%)`,
        color: "#0a0800",
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "0.015em",
        cursor: "pointer",
        boxShadow: `0 6px 28px ${GOLD}40, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
    >
      {label}
    </button>
  );
}
