/**
 * Static promotional catalog for CEO EXCHANGE.
 *
 * SOURCE OF TRUTH — edit this file, add media under public/promotions/,
 * commit to GitHub, deploy via Vercel.
 *
 * No database. No Supabase. No runtime CMS writes.
 * Only items with published: true are shown to users.
 */

import type { PromoScene } from "./Promotion3DVisual";

export type PromoCategory =
  | "exchange"
  | "trading"
  | "p2p"
  | "security"
  | "verification"
  | "vip"
  | "community"
  | "feature";

export type PromoCardItem = {
  id: string;
  /** Shown only when true */
  published: boolean;
  category: PromoCategory;
  /** Optional 3D scene hint for future specialized cards */
  scene?: PromoScene;
  title: string;
  description: string;
  /** Path under public/, e.g. /promotions/images/markets.webp */
  image?: string;
  /** Path under public/, e.g. /promotions/videos/intro.mp4 */
  video?: string;
  /** Show the CSS 3D visual instead of / in addition to media */
  show3D?: boolean;
  ctaLabel?: string;
  /**
   * Destination for CTA:
   * - "markets" → open trade
   * - "p2p" → open P2P
   * - "close" → dismiss promo
   * - absolute URL (https://...) opens in same window
   * - path starting with / uses history
   */
  ctaHref?: string;
  /** Sort order, lower first */
  order?: number;
};

/**
 * Hero cinematic video shown at the top of the Experience/Promotions page.
 * Path is under public/, matches the committed file exactly.
 */
export const PROMOTIONS_HERO_VIDEO = "/promotions/videos/ceo-launch.mp4";

/**
 * Published promotional cards.
 * Keep claims limited to real product capabilities.
 */
export const PROMO_CARDS: PromoCardItem[] = [
  {
    id: "markets-clarity",
    published: true,
    category: "trading",
    scene: "trading",
    title: "Spot markets, mobile-first",
    description:
      "Trade listed pairs with live pricing and a clean order interface designed for phone portrait.",
    show3D: false,
    ctaLabel: "Open markets",
    ctaHref: "markets",
    order: 10,
  },
  {
    id: "p2p-escrow",
    published: true,
    category: "p2p",
    scene: "p2p",
    title: "P2P with structured offers",
    description:
      "Buy and sell with other users through clear offers and an escrow-backed flow.",
    show3D: false,
    ctaLabel: "Explore P2P",
    ctaHref: "p2p",
    order: 20,
  },
  {
    id: "security-controls",
    published: true,
    category: "security",
    scene: "security",
    title: "Account protection",
    description:
      "2FA, withdrawal locks, and security settings that keep control in your hands.",
    show3D: false,
    ctaLabel: undefined,
    ctaHref: undefined,
    order: 30,
  },
  {
    id: "kyc-trust",
    published: true,
    category: "verification",
    scene: "verification",
    title: "Identity verification",
    description:
      "Complete KYC when required to unlock higher limits and stronger trust signals.",
    show3D: false,
    order: 40,
  },
];

/** Published items only, sorted for display */
export function getPublishedPromoCards(): PromoCardItem[] {
  return PROMO_CARDS.filter((c) => c.published).sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  );
}

/** Full catalog for admin preview (includes unpublished) */
export function getAllPromoCards(): PromoCardItem[] {
  return [...PROMO_CARDS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
