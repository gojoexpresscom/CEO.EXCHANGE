/**
 * Premium promotional media card — image / video / 3D / text.
 * Paths come from content.ts. No fake engagement.
 */

import React, { useEffect, useRef, useState } from "react";
import type { PromoCardItem } from "./content";
import Promotion3DVisual from "./Promotion3DVisual";
import { CARD, BORDER, GOLD, GOLD_LIGHT, TEXT, TEXT_DIM } from "./tokens";

type Props = {
  item: PromoCardItem;
  index?: number;
  onCta?: (item: PromoCardItem) => void;
  mediaPriority?: boolean;
  activeVideoId?: string | null;
  onVideoPlay?: (id: string | null) => void;
  /** Larger cinematic layout for featured */
  featured?: boolean;
};

export default function PromotionCard({
  item,
  index = 0,
  onCta,
  mediaPriority = false,
  activeVideoId = null,
  onVideoPlay,
  featured = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const hasVideo = Boolean(item.video) && !mediaError;
  const hasImage = Boolean(item.image) && !mediaError;
  const showMedia = hasVideo || hasImage || item.show3D;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !hasVideo) return;
    if (activeVideoId && activeVideoId !== item.id) el.pause();
  }, [activeVideoId, item.id, hasVideo]);

  useEffect(() => {
    if (!mediaPriority || !hasVideo) return;
    const el = videoRef.current;
    if (!el) return;
    void (async () => {
      try {
        el.muted = true;
        await el.play();
        onVideoPlay?.(item.id);
      } catch {
        /* autoplay blocked */
      }
    })();
  }, [mediaPriority, hasVideo, item.id, onVideoPlay]);

  const aspect = featured ? "16 / 11" : "16 / 10";

  return (
    <article
      style={{
        background: `linear-gradient(165deg, ${CARD} 0%, #0a0a0a 100%)`,
        border: `1px solid ${BORDER}`,
        borderRadius: featured ? 22 : 18,
        overflow: "hidden",
        boxShadow: featured
          ? "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,181,27,0.08)"
          : "0 10px 32px rgba(0,0,0,0.4)",
        animation: `ceoPromoFadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + index * 0.07}s both`,
      }}
    >
      {showMedia && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: aspect,
            background: "#060606",
            overflow: "hidden",
          }}
        >
          {hasVideo && item.video && (
            <video
              ref={videoRef}
              src={item.video}
              muted
              playsInline
              loop
              preload={mediaPriority ? "metadata" : "none"}
              onPlay={() => onVideoPlay?.(item.id)}
              onError={() => setMediaError(true)}
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                if (el.paused) {
                  void el.play().then(() => onVideoPlay?.(item.id)).catch(() => {});
                } else el.pause();
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                cursor: "pointer",
              }}
            />
          )}

          {!hasVideo && hasImage && item.image && (
            <>
              {!imgLoaded && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "radial-gradient(ellipse at 50% 40%, rgba(245,181,27,0.12), #080808 70%)",
                  }}
                />
              )}
              <img
                src={item.image}
                alt={item.title}
                loading={mediaPriority ? "eager" : "lazy"}
                decoding="async"
                onLoad={() => setImgLoaded(true)}
                onError={() => setMediaError(true)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  opacity: imgLoaded ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              />
            </>
          )}

          {item.show3D && !hasVideo && !hasImage && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                background: `
                  radial-gradient(ellipse 70% 55% at 50% 42%, rgba(245,181,27,0.16) 0%, transparent 55%),
                  radial-gradient(ellipse 50% 40% at 70% 70%, rgba(80,100,180,0.12) 0%, transparent 50%),
                  #050505
                `,
              }}
            >
              <Promotion3DVisual
                size={featured ? 180 : 140}
                scene={item.scene ?? "exchange"}
                autoRotate
                entrance={false}
              />
            </div>
          )}

          {/* glass edge + fade */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 28%, transparent 55%, rgba(5,5,5,0.85) 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          />
        </div>
      )}

      <div style={{ padding: featured ? "20px 20px 18px" : "16px 16px 14px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 650,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 8,
            opacity: 0.95,
          }}
        >
          {item.category}
        </div>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: featured ? 20 : 16,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
          }}
        >
          {item.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: featured ? 14 : 13,
            lineHeight: 1.5,
            color: TEXT_DIM,
          }}
        >
          {item.description}
        </p>

        {item.ctaLabel && (
          <button
            type="button"
            onClick={() => onCta?.(item)}
            style={{
              marginTop: 16,
              padding: "12px 18px",
              borderRadius: 999,
              border: 0,
              background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
              color: "#0a0800",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              minHeight: 46,
              boxShadow: "0 8px 24px rgba(245,181,27,0.25)",
            }}
          >
            {item.ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
}
