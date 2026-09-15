/**
 * Shared visual tokens for CEO EXCHANGE promotional system.
 * Sourced from existing brand identity (settingsStyles + app dark theme).
 * Do not invent a new palette.
 */

export const GOLD = "#f5b51b";
export const GOLD_LIGHT = "#ffd45a";
export const GOLD_DEEP = "#c48a00";
export const BG = "#050505";
export const BG_ELEVATED = "#0a0a0a";
export const CARD = "#101010";
export const CARD_ALT = "#0c0c0c";
export const BORDER = "#2a2110";
export const BORDER_SOFT = "#1a1a1a";
export const MUTED = "#777";
export const TEXT = "#f0f0f0";
export const TEXT_DIM = "#888";
export const TEXT_SOFT = "#bbb";

export const motionSafe = (css: string) =>
  `@media (prefers-reduced-motion: no-preference) { ${css} }`;
