/**
 * CEO EXCHANGE — dedicated Promotions / Experience page.
 * Premium product showcase. Static catalog only. Mobile-first.
 */

import React, { useEffect, useMemo, useState } from "react";
import PromotionHero from "./PromotionHero";
import PromotionFeature from "./PromotionFeature";
import PromotionCTA from "./PromotionCTA";
import PromotionCard from "./PromotionCard";
import PromotionVideoHero from "./PromotionVideoHero";
import {
  getPublishedPromoCards,
  PROMOTIONS_HERO_VIDEO,
  type PromoCardItem,
  type PromoCategory,
} from "./content";
import {
  BG,
  GOLD,
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

const CATEGORY_LABEL: Partial<Record<PromoCategory, string>> = {
  trading: "Markets",
  p2p: "P2P",
  security: "Security",
  verification: "Verification",
  exchange: "Exchange",
  vip: "VIP",
  community: "Community",
  feature: "New",
};

export default function PromotionsPage({ onBack, onTrade, onP2P }: Props) {
  const cards = useMemo(() => getPublishedPromoCards(), []);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

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

  // Group by category for visual rhythm (preserve order within)
  const groups = useMemo(() => {
    const map = new Map<string, PromoCardItem[]>();
    for (const c of cards) {
      const key = c.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  }, [cards]);

  const featured = cards[0];
  const restGroups = useMemo(() => {
    if (!featured) return groups;
    return groups
      .map(([cat, items]) => [cat, items.filter((i) => i.id !== featured.id)] as const)
      .filter(([, items]) => items.length > 0);
  }, [groups, featured]);

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
      {/* Premium header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          paddingTop: "calc(10px + env(safe-area-inset-top))",
          borderBottom: `1px solid ${BORDER_SOFT}`,
          background: "rgba(5,5,5,0.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
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
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            CEO EXCHANGE
          </div>
          <div
            style={{
              fontSize: 12,
              color: TEXT_DIM,
              marginTop: 2,
              letterSpacing: "0.06em",
            }}
          >
            Experience
          </div>
        </div>
        <div style={{ width: 44 }} />
      </header>

      <main
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
        }}
      >
        {/* Cinematic launch video — real hero media, above the 3D hero */}
        <PromotionVideoHero src={PROMOTIONS_HERO_VIDEO} />

        {/* HERO */}
        <PromotionHero
          scene="exchange"
          size={220}
          title="Premium exchange. Built for clarity."
          subtitle="Trading, P2P, security and verification — one focused mobile experience."
        />

        {/* Feature strip */}
        <section
          style={{
            padding: "4px 16px 20px",
            maxWidth: 480,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PromotionFeature
              index={0}
              icon="◈"
              title="Spot markets"
              description="Listed pairs, live pricing, clean mobile order flow."
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
              description="2FA, withdrawal locks, controls you own."
            />
            <PromotionFeature
              index={3}
              icon="✓"
              title="Identity verification"
              description="KYC when required — higher limits, stronger trust."
            />
          </div>
        </section>

        {/* Featured card */}
        {featured && (
          <section
            style={{
              padding: "8px 16px 20px",
              maxWidth: 480,
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <SectionLabel>Featured</SectionLabel>
            <PromotionCard
              item={featured}
              index={0}
              onCta={handleCardCta}
              mediaPriority
              activeVideoId={activeVideoId}
              onVideoPlay={setActiveVideoId}
            />
          </section>
        )}

        {/* Catalog by category */}
        {restGroups.map(([category, items], gi) => (
          <section
            key={category}
            style={{
              padding: "4px 16px 20px",
              maxWidth: 480,
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <SectionLabel>
              {CATEGORY_LABEL[category as PromoCategory] ?? category}
            </SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {items.map((item, i) => (
                <PromotionCard
                  key={item.id}
                  item={item}
                  index={i + gi}
                  onCta={handleCardCta}
                  activeVideoId={activeVideoId}
                  onVideoPlay={setActiveVideoId}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Empty state if no cards */}
        {cards.length === 0 && (
          <section
            style={{
              padding: "24px 16px",
              maxWidth: 480,
              margin: "0 auto",
              textAlign: "center",
              color: TEXT_DIM,
              fontSize: 14,
            }}
          >
            Promotional showcase is being prepared.
          </section>
        )}

        {/* Final CTA band */}
        <section
          style={{
            padding: "28px 16px 12px",
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
              borderRadius: 18,
              padding: "24px 18px",
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
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
                letterSpacing: "-0.02em",
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
              Open markets or explore P2P — same premium experience on mobile.
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
            padding: "16px 24px 8px",
            margin: 0,
            letterSpacing: "0.08em",
          }}
        >
          CEO EXCHANGE
        </p>
      </main>

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 12px",
        fontSize: 11,
        fontWeight: 650,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: TEXT_DIM,
      }}
    >
      {children}
    </h2>
  );
}
