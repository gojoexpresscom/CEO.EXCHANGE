import { useState, type CSSProperties } from "react";
import { iconUrl } from "../../lib/format";

type Props = {
  symbol: string;
  size?: number;
  /** Prefer assets.icon_url from backend when available */
  iconUrlProp?: string | null;
};

/**
 * Token icon: assets.icon_url → CDN cryptocurrency-icons → initials fallback.
 * Does not use exchange brand logos.
 */
export default function MarketIcon({
  symbol,
  size = 32,
  iconUrlProp,
}: Props) {
  const [failed, setFailed] = useState(false);
  const base = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const initials = base.slice(0, 2) || "?";
  const backend = (iconUrlProp || "").trim();
  const src = backend || (base ? iconUrl(base) : "");

  if (failed || !src || !base) {
    return (
      <div
        style={{
          ...styles.fallback,
          width: size,
          height: size,
          fontSize: size * 0.32,
        }}
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ ...styles.img, width: size, height: size }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

const styles: Record<string, CSSProperties> = {
  img: {
    borderRadius: "50%",
    objectFit: "cover",
    background: "#1a1a1a",
    flexShrink: 0,
  },
  fallback: {
    borderRadius: "50%",
    background: "linear-gradient(145deg, #2a2110 0%, #1a1a1a 100%)",
    color: "#c9a227",
    fontWeight: 800,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    letterSpacing: "-0.02em",
  },
};
