/**
 * CEO EXCHANGE Experience — premium landing-style showcase.
 * Inspired by cinematic product pages (dark stage, 3D focal, floating stats).
 * Content from content.ts + public/promotions/{images,videos}.
 */

import React, { useEffect, useMemo, useState } from "react";
import Promotion3DVisual from "./Promotion3DVisual";
import PromotionCard from "./PromotionCard";
import PromotionCTA from "./PromotionCTA";
import {
  getPublishedPromoCards,
  PROMOTIONS_HERO_IMAGE,
  PROMOTIONS_HERO_VIDEO,
  PROMOTIONS_HERO_TITLE,
  PROMOTIONS_HERO_SUBTITLE,
  type PromoCardItem,
} from "./content";
import {
  BG,
  GOLD,
  GOLD_LIGHT,
  TEXT,
  TEXT_DIM,
  BORDER_SOFT,
  CARD,
  BORDER,
} from "./tokens";

type Props = {
  onBack: () => void;
  onTrade?: (symbol?: string) => void;
  onP2P?: () => void;
};

export default function PromotionsPage({ onBack, onTrade, onP2P }: Props) {
  const cards = useMemo(() => getPublishedPromoCards(), []);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const featured = cards[0];
  const rest = cards.slice(1);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  function handleCardCta(item: PromoCardItem) {
    const href = item.ctaHref;
    if (!href) return;
    if (href === "markets") {
      onTrade?.("BTCUSDT");
      return;
    }
    if (href === "p2p") {
      onP2P?.();
      return;
    }
    if (href === "close") {
      onBack();
      return;
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.location.href = href;
      return;
    }
    if (href.startsWith("/")) {
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  const titleLines = PROMOTIONS_HERO_TITLE.split("\n");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BG,
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          paddingTop: "calc(10px + env(safe-area-inset-top))",
          borderBottom: `1px solid ${BORDER_SOFT}`,
          background: "rgba(5,5,5,0.82)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 44,
            height: 44,
            border: 0,
            borderRadius: 12,
            background: "transparent",
            color: GOLD,
            fontSize: 22,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            CEO EXCHANGE
          </div>
        </div>
        <div style={{ width: 44 }} />
      </header>

      <main
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(36px + env(safe-area-inset-bottom))",
        }}
      >
        {/* ═══════ CINEMATIC HERO (landing style) ═══════ */}
        <section
          style={{
            position: "relative",
            minHeight: "min(78vh, 640px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 20px 40px",
            overflow: "hidden",
            background: `
              radial-gradient(ellipse 80% 60% at 50% 35%, rgba(245,181,27,0.14) 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 80% 80%, rgba(60,80,160,0.12) 0%, transparent 50%),
              radial-gradient(ellipse 40% 30% at 15% 70%, rgba(180,100,40,0.08) 0%, transparent 45%),
              #050505
            `,
          }}
        >
          {/* Optional hero video/image backdrop */}
          {PROMOTIONS_HERO_VIDEO && (
            <video
              src={PROMOTIONS_HERO_VIDEO}
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.35,
                pointerEvents: "none",
              }}
            />
          )}
          {!PROMOTIONS_HERO_VIDEO && PROMOTIONS_HERO_IMAGE && (
            <img
              src={PROMOTIONS_HERO_IMAGE}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.3,
                pointerEvents: "none",
              }}
            />
          )}

          {/* soft vignette */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 70% 70% at 50% 45%, transparent 30%, #050505 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Headline */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              maxWidth: 420,
              marginBottom: 8,
              animation: "ceoPromoFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 650,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: GOLD,
                marginBottom: 14,
              }}
            >
              Experience
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 8vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.12,
                color: "#fff",
              }}
            >
              {titleLines.map((line, i) => (
                <span key={i} style={{ display: "block" }}>
                  {line}
                </span>
              ))}
            </h1>
            <p
              style={{
                margin: "14px auto 0",
                fontSize: 14,
                lineHeight: 1.5,
                color: TEXT_DIM,
                maxWidth: 320,
              }}
            >
              {PROMOTIONS_HERO_SUBTITLE}
            </p>
          </div>

          {/* 3D focal object */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              margin: "20px 0 8px",
              animation: "ceoPromoFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.15s both",
            }}
          >
            <div
              style={{
                filter: "drop-shadow(0 24px 48px rgba(245,181,27,0.2))",
              }}
            >
              <Promotion3DVisual
                size={200}
                scene="exchange"
                autoRotate
                entrance
              />
            </div>
          </div>

          {/* Floating stat chips (landing style) */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
              maxWidth: 400,
              marginTop: 12,
              animation: "ceoPromoFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.35s both",
            }}
          >
            <StatChip label="Markets" value="Spot" />
            <StatChip label="P2P" value="Escrow" />
            <StatChip label="Security" value="2FA" />
          </div>

          {/* Primary CTAs */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: "100%",
              maxWidth: 320,
              marginTop: 28,
              animation: "ceoPromoFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.45s both",
            }}
          >
            {onTrade && (
              <button
                type="button"
                onClick={() => onTrade("BTCUSDT")}
                style={{
                  padding: "14px 24px",
                  borderRadius: 999,
                  border: 0,
                  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
                  color: "#0a0800",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 10px 32px rgba(245,181,27,0.3)",
                }}
              >
                Open markets
              </button>
            )}
            {onP2P && (
              <button
                type="button"
                onClick={onP2P}
                style={{
                  padding: "14px 24px",
                  borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.04)",
                  color: TEXT,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Explore P2P
              </button>
            )}
          </div>
        </section>

        {/* ═══════ SHOWCASE (catalog: text + image + video) ═══════ */}
        {cards.length > 0 && (
          <section
            style={{
              padding: "8px 16px 24px",
              maxWidth: 480,
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 11,
                fontWeight: 650,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: TEXT_DIM,
              }}
            >
              Showcase
            </h2>

            {featured && (
              <div style={{ marginBottom: 16 }}>
                <PromotionCard
                  item={featured}
                  index={0}
                  featured
                  mediaPriority
                  onCta={handleCardCta}
                  activeVideoId={activeVideoId}
                  onVideoPlay={setActiveVideoId}
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rest.map((item, i) => (
                <PromotionCard
                  key={item.id}
                  item={item}
                  index={i + 1}
                  onCta={handleCardCta}
                  activeVideoId={activeVideoId}
                  onVideoPlay={setActiveVideoId}
                />
              ))}
            </div>
          </section>
        )}

        {cards.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: TEXT_DIM,
              fontSize: 14,
              padding: 32,
            }}
          >
            Promotional content is being prepared.
          </p>
        )}

        {/* Final band */}
        <section
          style={{
            padding: "12px 16px 8px",
            maxWidth: 480,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: `linear-gradient(160deg, ${CARD} 0%, #0a0a0a 100%)`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: "24px 18px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 650,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: GOLD,
                marginBottom: 10,
              }}
            >
              Ready when you are
            </div>
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 700,
                color: TEXT,
              }}
            >
              Trade with clarity
            </h2>
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 13,
                color: TEXT_DIM,
                lineHeight: 1.45,
              }}
            >
              Markets and P2P in one focused mobile experience.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {onTrade && (
                <PromotionCTA
                  label="Open markets"
                  onClick={() => onTrade("BTCUSDT")}
                />
              )}
              {onP2P && (
                <PromotionCTA label="Explore P2P" secondary onClick={onP2P} />
              )}
              <button
                type="button"
                onClick={onBack}
                style={{
                  marginTop: 4,
                  padding: "12px",
                  border: 0,
                  background: "transparent",
                  color: TEXT_DIM,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Back to home
              </button>
            </div>
          </div>
        </section>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: TEXT_DIM,
            padding: "20px 24px 8px",
            margin: 0,
            letterSpacing: "0.1em",
          }}
        >
          CEO EXCHANGE
        </p>
      </main>

      <style>{`
        @keyframes ceoPromoFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ceoPromoFadeUp"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 14px",
        borderRadius: 14,
        background: "rgba(16,16,16,0.85)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        minWidth: 96,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: TEXT_DIM,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{value}</span>
    </div>
  );
}
