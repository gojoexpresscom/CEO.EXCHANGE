/**
 * Premium promotional card — product/marketing presentation.
 * No fake social engagement. Single-video autoplay coordination.
 */

import React, { useEffect, useRef, useState } from "react";
import type { PromoCardItem } from "./content";
import Promotion3DVisual from "./Promotion3DVisual";
import { CARD, BORDER, GOLD, GOLD_LIGHT, TEXT, TEXT_DIM } from "./tokens";

type Props = {
  item: PromoCardItem;
  index?: number;
  onCta?: (item: PromoCardItem) => void;
  /** Prefer loading media for featured card */
  mediaPriority?: boolean;
  /** Only one video plays at a time across the page */
  activeVideoId?: string | null;
  onVideoPlay?: (id: string | null) => void;
};

export default function PromotionCard({
  item,
  index = 0,
  onCta,
  mediaPriority = false,
  activeVideoId = null,
  onVideoPlay,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);

  const hasVideo = Boolean(item.video) && !mediaError;
  const hasImage = Boolean(item.image) && !mediaError;

  // Pause when another card becomes active
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !hasVideo) return;
    if (activeVideoId && activeVideoId !== item.id) {
      el.pause();
    }
  }, [activeVideoId, item.id, hasVideo]);

  // Featured: try muted autoplay once
  useEffect(() => {
    if (!mediaPriority || !hasVideo) return;
    const el = videoRef.current;
    if (!el) return;
    const tryPlay = async () => {
      try {
        el.muted = true;
        await el.play();
        onVideoPlay?.(item.id);
      } catch {
        // Autoplay blocked — user can tap
      }
    };
    void tryPlay();
  }, [mediaPriority, hasVideo, item.id, onVideoPlay]);

  return (
    <article
      style={{
        background: `linear-gradient(160deg, ${CARD} 0%, #0c0c0c 100%)`,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
        animation: `ceoPromoFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${0.12 + index * 0.07}s both`,
      }}
    >
      {(hasVideo || hasImage || item.show3D) && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 10",
            background: "#080808",
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
              controls={false}
              onPlay={() => onVideoPlay?.(item.id)}
              onError={() => setMediaError(true)}
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                if (el.paused) {
                  void el.play().then(() => onVideoPlay?.(item.id)).catch(() => {});
                } else {
                  el.pause();
                }
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
            <img
              src={item.image}
              alt=""
              loading={mediaPriority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setMediaError(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
          {item.show3D && !hasVideo && !hasImage && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                background: `radial-gradient(ellipse 60% 50% at 50% 45%, ${GOLD}18 0%, #050505 70%)`,
              }}
            >
              <Promotion3DVisual
                size={140}
                scene={item.scene ?? "exchange"}
                autoRotate
                entrance={false}
              />
            </div>
          )}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "36%",
              background: "linear-gradient(transparent, #0c0c0c)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      <div style={{ padding: "16px 16px 14px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 650,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 6,
            opacity: 0.9,
          }}
        >
          {item.category}
        </div>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 16,
            fontWeight: 680,
            color: TEXT,
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
          }}
        >
          {item.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
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
              marginTop: 14,
              padding: "12px 16px",
              borderRadius: 10,
              border: 0,
              background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
              color: "#0a0800",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              minHeight: 44,
            }}
          >
            {item.ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
}
