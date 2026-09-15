/**
 * Premium CSS-3D scene for CEO EXCHANGE promotions.
 * Original geometry — not a copy of any reference video.
 * Multi-layer depth, controlled gold lighting, light sweep, soft atmosphere.
 * GPU-composited transforms only. Mobile-safe. Respects reduced-motion.
 *
 * Architecture ready for scene variants:
 *   scene?: "exchange" | "trading" | "p2p" | "security" | "verification" | "vip" | "community"
 */

import React, { useEffect, useState } from "react";
import { GOLD, GOLD_LIGHT, GOLD_DEEP } from "./tokens";

export type PromoScene =
  | "exchange"
  | "trading"
  | "p2p"
  | "security"
  | "verification"
  | "vip"
  | "community";

type Props = {
  size?: number;
  /** Scene variant — currently exchange is fully polished; others share core language */
  scene?: PromoScene;
  /** Slow continuous rotation after entrance */
  autoRotate?: boolean;
  /** Play entrance sequence (emerge + light sweep) */
  entrance?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export default function Promotion3DVisual({
  size = 200,
  scene = "exchange",
  autoRotate = true,
  entrance = true,
  className,
  style,
}: Props) {
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<"idle" | "enter" | "live">("idle");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduced || !entrance) {
      setPhase("live");
      return;
    }
    setPhase("enter");
    const t = window.setTimeout(() => setPhase("live"), 2200);
    return () => window.clearTimeout(t);
  }, [reduced, entrance]);

  const s = size;
  const half = s * 0.5;
  const isLive = phase === "live";
  const isEnter = phase === "enter";

  // Core object scale/opacity for entrance
  const coreEnterStyle: React.CSSProperties =
    reduced || !entrance
      ? {}
      : isEnter
        ? {
            animation: "ceoCoreEmerge 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
          }
        : {};

  return (
    <div
      className={className}
      data-scene={scene}
      style={{
        width: s,
        height: s * 1.05,
        perspective: s * 2.8,
        perspectiveOrigin: "50% 42%",
        position: "relative",
        ...style,
      }}
    >
      {/* Atmospheric stage — depth fog + gold bloom */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 55% 45% at 50% 42%, ${GOLD}22 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at 50% 70%, #0a0804 0%, transparent 70%)
          `,
          opacity: isEnter ? 0 : 1,
          transition: reduced ? undefined : "opacity 1.2s ease-out",
          animation:
            isEnter && !reduced
              ? "ceoAmbFade 1.6s ease-out forwards"
              : undefined,
        }}
      />

      {/* Soft floor reflection plane */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "18%",
          right: "18%",
          bottom: "6%",
          height: "22%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${GOLD}18 0%, transparent 70%)`,
          filter: "blur(12px)",
          opacity: isLive ? 0.85 : 0,
          transition: reduced ? undefined : "opacity 1s ease 0.8s",
          transform: "rotateX(70deg) translateZ(-20px)",
          pointerEvents: "none",
        }}
      />

      {/* Main 3D scene root */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: isLive && autoRotate && !reduced ? undefined : "rotateX(8deg)",
          animation:
            isLive && autoRotate && !reduced
              ? "ceoPromoOrbitY 18s linear infinite"
              : undefined,
          ...coreEnterStyle,
        }}
      >
        {/* Back glow disc */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            width: s * 0.72,
            height: s * 0.72,
            marginLeft: -(s * 0.36),
            marginTop: -(s * 0.36),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${GOLD}28 0%, ${GOLD}08 40%, transparent 68%)`,
            filter: "blur(10px)",
            transform: "translateZ(-48px)",
            pointerEvents: "none",
          }}
        />

        {/* Outer ring (subtle orbital frame) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            width: s * 0.78,
            height: s * 0.78,
            marginLeft: -(s * 0.39),
            marginTop: -(s * 0.39),
            borderRadius: "50%",
            border: `1px solid ${GOLD}22`,
            boxShadow: `inset 0 0 24px ${GOLD}12, 0 0 20px ${GOLD}10`,
            transform: "rotateX(68deg) translateZ(-12px)",
            opacity: isLive ? 0.7 : 0,
            transition: reduced ? undefined : "opacity 1s ease 0.6s",
            pointerEvents: "none",
          }}
        />

        {/* === CORE OBJECT: layered bevel diamond === */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            width: s * 0.48,
            height: s * 0.48,
            marginLeft: -(s * 0.24),
            marginTop: -(s * 0.24),
            transformStyle: "preserve-3d",
            transform: "rotateX(56deg) rotateZ(45deg) translateZ(12px)",
          }}
        >
          {/* Deep shadow plate */}
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 8,
              background: "rgba(0,0,0,0.55)",
              transform: "translateZ(-10px)",
              filter: "blur(6px)",
            }}
          />

          {/* Bevel side (thickness) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 7,
              background: `linear-gradient(155deg, #6b4e00 0%, ${GOLD_DEEP} 45%, #3d2a00 100%)`,
              transform: "translateZ(0px)",
              boxShadow: `0 0 0 1px #2a1c00`,
            }}
          />

          {/* Main face — metallic gold */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 7,
              background: `
                linear-gradient(152deg,
                  ${GOLD_LIGHT} 0%,
                  ${GOLD} 28%,
                  #e0a010 52%,
                  ${GOLD_DEEP} 78%,
                  #8a6200 100%
                )
              `,
              boxShadow: `
                0 0 0 1px ${GOLD}66,
                inset 0 1px 0 ${GOLD_LIGHT}aa,
                inset 0 -2px 6px rgba(0,0,0,0.35),
                0 14px 32px rgba(0,0,0,0.5)
              `,
              transform: "translateZ(9px)",
              overflow: "hidden",
            }}
          >
            {/* Specular highlight band */}
            <div
              style={{
                position: "absolute",
                top: "-20%",
                left: "-30%",
                width: "80%",
                height: "55%",
                background:
                  "linear-gradient(125deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)",
                borderRadius: "40%",
                pointerEvents: "none",
              }}
            />

            {/* Animated light sweep */}
            {!reduced && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(105deg, transparent 30%, rgba(255,240,180,0.55) 48%, transparent 62%)",
                  transform: "translateX(-120%)",
                  animation:
                    isLive || isEnter
                      ? "ceoLightSweep 3.8s ease-in-out 1.1s infinite"
                      : undefined,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Center mark — original abstract glyph */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "36%",
                height: "36%",
                marginLeft: "-18%",
                marginTop: "-18%",
                border: `2px solid rgba(10,8,0,0.35)`,
                borderRadius: 4,
                transform: "rotate(-45deg)",
                boxShadow: `inset 0 0 8px rgba(0,0,0,0.25)`,
              }}
            />
          </div>
        </div>

        {/* Floating lower chevron bars (depth layers) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "62%",
            width: s * 0.42,
            height: 11,
            marginLeft: -(s * 0.21),
            borderRadius: 6,
            background: `linear-gradient(90deg, transparent 0%, ${GOLD}bb 20%, ${GOLD_LIGHT} 50%, ${GOLD}bb 80%, transparent 100%)`,
            boxShadow: `0 0 20px ${GOLD}44, 0 4px 12px rgba(0,0,0,0.4)`,
            transform: "translateZ(34px) rotateX(-18deg)",
            opacity: isLive ? 0.9 : 0,
            transition: reduced ? undefined : "opacity 0.9s ease 0.9s",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "68%",
            width: s * 0.28,
            height: 7,
            marginLeft: -(s * 0.14),
            borderRadius: 4,
            background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}99, transparent)`,
            boxShadow: `0 0 12px ${GOLD}33`,
            transform: "translateZ(42px) rotateX(-12deg)",
            opacity: isLive ? 0.75 : 0,
            transition: reduced ? undefined : "opacity 0.9s ease 1.05s",
          }}
        />

        {/* Orbiting micro particles */}
        {!reduced && isLive && (
          <>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "48%",
                width: 5,
                height: 5,
                marginLeft: -2.5,
                marginTop: -2.5,
                borderRadius: "50%",
                background: GOLD_LIGHT,
                boxShadow: `0 0 12px ${GOLD}, 0 0 4px #fff8`,
                animation: "ceoParticleA 10s linear infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "48%",
                width: 3.5,
                height: 3.5,
                marginLeft: -1.75,
                marginTop: -1.75,
                borderRadius: "50%",
                background: GOLD,
                boxShadow: `0 0 8px ${GOLD}`,
                animation: "ceoParticleB 13s linear infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "48%",
                width: 3,
                height: 3,
                marginLeft: -1.5,
                marginTop: -1.5,
                borderRadius: "50%",
                background: GOLD_LIGHT,
                opacity: 0.7,
                boxShadow: `0 0 6px ${GOLD}`,
                animation: "ceoParticleC 16s linear infinite reverse",
              }}
            />
          </>
        )}
      </div>

      <style>{`
        @keyframes ceoCoreEmerge {
          0% {
            opacity: 0;
            transform: rotateX(18deg) scale(0.72) translateZ(-80px);
            filter: blur(6px);
          }
          55% {
            opacity: 1;
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: rotateX(8deg) scale(1) translateZ(0);
            filter: blur(0);
          }
        }
        @keyframes ceoAmbFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ceoPromoOrbitY {
          from { transform: rotateY(0deg) rotateX(8deg); }
          to   { transform: rotateY(360deg) rotateX(8deg); }
        }
        @keyframes ceoLightSweep {
          0%, 100% { transform: translateX(-130%); opacity: 0; }
          12% { opacity: 1; }
          45% { transform: translateX(130%); opacity: 0.9; }
          50%, 100% { opacity: 0; }
        }
        @keyframes ceoParticleA {
          from { transform: rotateY(0deg) rotateX(12deg) translateZ(${half * 0.78}px); }
          to   { transform: rotateY(360deg) rotateX(12deg) translateZ(${half * 0.78}px); }
        }
        @keyframes ceoParticleB {
          from { transform: rotateY(90deg) rotateX(-8deg) translateZ(${half * 0.62}px); }
          to   { transform: rotateY(450deg) rotateX(-8deg) translateZ(${half * 0.62}px); }
        }
        @keyframes ceoParticleC {
          from { transform: rotateY(200deg) rotateX(20deg) translateZ(${half * 0.55}px); }
          to   { transform: rotateY(560deg) rotateX(20deg) translateZ(${half * 0.55}px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-scene] * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
