/**
 * CEO EXCHANGE promotional showcase — exchange scene + static promo cards.
 * Cinematic opening → product message → benefits → cards → CTA.
 * No invented financial claims. No fake social engagement.
 */

import React, { useEffect, useMemo } from "react";
import PromotionHero from "./PromotionHero";
import PromotionFeature from "./PromotionFeature";
import PromotionCTA from "./PromotionCTA";
import PromotionCard from "./PromotionCard";
import { getPublishedPromoCards, type PromoCardItem } from "./content";
import { BG, GOLD, TEXT_DIM, BORDER_SOFT, TEXT } from "./tokens";

type Props = {
  onClose: () => void;
  onTrade?: () => void;
  onP2P?: () => void;
};

export default function ExchangePromo({ onClose, onTrade, onP2P }: Props) {
  const cards = useMemo(() => getPublishedPromoCards(), []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function handleCardCta(item: PromoCardItem) {
    const href = item.ctaHref;
    if (!href) return;

    if (href === "markets") {
      onClose();
      onTrade?.();
      return;
    }
    if (href === "p2p") {
      onClose();
      onP2P?.();
      return;
    }
    if (href === "close") {
      onClose();
      return;
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.location.href = href;
      return;
    }
    if (href.startsWith("/")) {
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CEO Exchange introduction"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          paddingTop: "calc(10px + env(safe-area-inset-top))",
          borderBottom: `1px solid ${BORDER_SOFT}`,
          flexShrink: 0,
          background: "rgba(5,5,5,0.92)",
          backdropFilter: "blur(8px)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 40,
            height: 40,
            border: 0,
            borderRadius: 12,
            background: "transparent",
            color: GOLD,
            fontSize: 20,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <span
          style={{
            fontSize: 11,
            fontWeight: 650,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: TEXT_DIM,
          }}
        >
          Experience
        </span>
        <div style={{ width: 40 }} />
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
        }}
      >
        <PromotionHero
          scene="exchange"
          size={210}
          title="Premium exchange. Built for clarity."
          subtitle="Trading, P2P, security and verification — in one focused mobile experience."
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 11,
            padding: "4px 16px 18px",
            maxWidth: 420,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <PromotionFeature
            index={0}
            icon="◈"
            title="Spot markets"
            description="Listed pairs, live pricing, and a clean mobile order flow."
          />
          <PromotionFeature
            index={1}
            icon="⇄"
            title="P2P marketplace"
            description="Structured offers and escrow-backed peer trading."
          />
          <PromotionFeature
            index={2}
            icon="🛡"
            title="Account protection"
            description="2FA, withdrawal locks, and security controls you control."
          />
          <PromotionFeature
            index={3}
            icon="✓"
            title="Identity verification"
            description="KYC when required — higher limits and stronger trust."
          />
        </div>

        {/* Static promotional cards */}
        {cards.length > 0 && (
          <section
            style={{
              padding: "8px 16px 12px",
              maxWidth: 420,
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 650,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: TEXT_DIM,
              }}
            >
              Showcase
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {cards.map((item, i) => (
                <PromotionCard
                  key={item.id}
                  item={item}
                  index={i}
                  onCta={handleCardCta}
                />
              ))}
            </div>
          </section>
        )}

        <div
          style={{
            padding: "16px 16px 20px",
            maxWidth: 420,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            animation:
              "ceoPromoFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) 2.15s both",
          }}
        >
          {onTrade && (
            <PromotionCTA
              label="Open markets"
              onClick={() => {
                onClose();
                onTrade();
              }}
            />
          )}
          {onP2P && (
            <PromotionCTA
              label="Explore P2P"
              secondary
              onClick={() => {
                onClose();
                onP2P();
              }}
            />
          )}
          {!onTrade && !onP2P && (
            <PromotionCTA label="Continue" onClick={onClose} />
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: TEXT_DIM,
            padding: "4px 24px 16px",
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          CEO EXCHANGE
        </p>
      </div>

      <style>{`
        @keyframes ceoPromoFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ceoPromoFadeUp"],
          [style*="ceoTextIn"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
