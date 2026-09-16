/**
 * Static promotional catalog — SOURCE OF TRUTH
 *
 * HOW TO PUBLISH MEDIA (GitHub + Vercel only):
 * 1. Put files in:
 *      public/promotions/images/   → .jpg .png .webp
 *      public/promotions/videos/   → .mp4 .webm
 * 2. Reference them BELOW with paths starting with /promotions/...
 *      image: "/promotions/images/my-shot.webp"
 *      video: "/promotions/videos/launch.mp4"
 * 3. Set published: true, commit, deploy.
 *
 * Uploading a file without a matching entry here will NOT show it.
 * Only published: true items appear on Experience.
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
  published: boolean;
  category: PromoCategory;
  scene?: PromoScene;
  title: string;
  description: string;
  /** e.g. "/promotions/images/markets.webp" */
  image?: string;
  /** e.g. "/promotions/videos/intro.mp4" */
  video?: string;
  /** CSS 3D visual when no image/video */
  show3D?: boolean;
  ctaLabel?: string;
  /** markets | p2p | close | /path | https://... */
  ctaHref?: string;
  order?: number;
};

/** Optional full-bleed hero video (path under public/) */
export const PROMOTIONS_HERO_VIDEO: string | undefined = undefined;
// Example when you upload: "/promotions/videos/ceo-launch.mp4"

/** Optional hero background image */
export const PROMOTIONS_HERO_IMAGE: string | undefined = undefined;
// Example: "/promotions/images/hero.webp"

/** Landing headline */
export const PROMOTIONS_HERO_TITLE = "Elevate Your\nTrading Experience";
export const PROMOTIONS_HERO_SUBTITLE =
  "Premium markets, P2P, and account protection — built for clarity on mobile.";

/**
 * Add a card per image / video / text block you want on Experience.
 * Copy an entry, change id/title/paths, set published: true.
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
    // image: "/promotions/images/markets.webp",
    // video: "/promotions/videos/markets.mp4",
    show3D: true,
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
    // image: "/promotions/images/p2p.webp",
    show3D: true,
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
    show3D: true,
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
    show3D: true,
    order: 40,
  },
];

export function getPublishedPromoCards(): PromoCardItem[] {
  return PROMO_CARDS.filter((c) => c.published).sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  );
}

export function getAllPromoCards(): PromoCardItem[] {
  return [...PROMO_CARDS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
