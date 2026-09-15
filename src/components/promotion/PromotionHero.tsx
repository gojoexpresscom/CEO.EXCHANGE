/**
 * Cinematic opening block for CEO EXCHANGE promotions.
 * 3D object first, then restrained typography.
 */

import React from "react";
import Promotion3DVisual, { type PromoScene } from "./Promotion3DVisual";
import { GOLD, TEXT, TEXT_DIM } from "./tokens";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  scene?: PromoScene;
  children?: React.ReactNode;
  size?: number;
  /** Stagger text after 3D entrance */
  delayText?: boolean;
};

export default function PromotionHero({
  title,
  subtitle,
  eyebrow = "CEO EXCHANGE",
  scene = "exchange",
  children,
  size = 200,
  delayText = true,
}: Props) {
  return (
    <section
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "20px 20px 8px",
        overflow: "hidden",
        minHeight: size + 120,
      }}
    >
      {/* Deep stage gradient */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 50% at 50% 30%, ${GOLD}14 0%, transparent 58%),
            linear-gradient(180deg, transparent 40%, #050505 100%)
          `,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginBottom: 10,
          width: size,
          maxWidth: "88vw",
        }}
      >
        <Promotion3DVisual
          size={size}
          scene={scene}
          autoRotate
          entrance
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          animation: delayText
            ? "ceoTextIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) 1.35s both"
            : undefined,
        }}
      >
        {eyebrow && (
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            {eyebrow}
          </p>
        )}

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(21px, 5.8vw, 27px)",
            fontWeight: 720,
            lineHeight: 1.18,
            color: TEXT,
            letterSpacing: "-0.025em",
            maxWidth: 300,
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 13.5,
              lineHeight: 1.45,
              color: TEXT_DIM,
              maxWidth: 290,
            }}
          >
            {subtitle}
          </p>
        )}

        {children}
      </div>

      <style>{`
        @keyframes ceoTextIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ceoTextIn"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
