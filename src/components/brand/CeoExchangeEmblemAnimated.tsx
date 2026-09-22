import React, { useId } from 'react';

export const CeoExchangeEmblemAnimated: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 120, className = '' }) => {
  /*
   * IMPORTANT
   *
   * This component does NOT control loading or networking.
   *
   * There is:
   * - no setTimeout
   * - no setInterval
   * - no play counter
   * - no fixed number of repetitions
   * - no 3-second refresh
   *
   * If this component is mounted by a loading/refresh screen,
   * the animation continues for as long as it remains mounted.
   *
   * When the parent removes the component after loading finishes,
   * the animation stops naturally.
   */

  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const upperGradientId = `titanium-upper-${uid}`;
  const lowerGradientId = `titanium-lower-${uid}`;
  const diamondGlowId = `diamond-glow-${uid}`;
  const bracketShadowId = `bracket-shadow-${uid}`;
  const specularGlowId = `specular-glow-${uid}`;
  const upperClipId = `cx-upper-clip-${uid}`;
  const lowerClipId = `cx-lower-clip-${uid}`;
  const sweepMaskId = `cx-sweep-mask-${uid}`;
  const sweepGradientId = `cx-sweep-${uid}`;

  return (
    <>
      <style>{css}</style>

      <svg
        className={`cx-animated ${className}`}
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* =====================================================
              CEO TITANIUM GRADIENTS
              ===================================================== */}

          <linearGradient
            id={upperGradientId}
            x1="160"
            y1="160"
            x2="350"
            y2="280"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="22%" stopColor="#DCE3EB" />
            <stop offset="55%" stopColor="#8C9CAE" />
            <stop offset="85%" stopColor="#5B6978" />
            <stop offset="100%" stopColor="#465362" />
          </linearGradient>

          <linearGradient
            id={lowerGradientId}
            x1="160"
            y1="230"
            x2="350"
            y2="350"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#CBD6E2" />
            <stop offset="25%" stopColor="#8E9EAF" />
            <stop offset="65%" stopColor="#606E7D" />
            <stop offset="90%" stopColor="#7B8B9B" />
            <stop offset="100%" stopColor="#B2C0CE" />
          </linearGradient>

          {/* =====================================================
              CENTER GLOW
              ===================================================== */}

          <radialGradient
            id={diamondGlowId}
            cx="256"
            cy="256"
            r="45"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0%"
              stopColor="#FFFFFF"
              stopOpacity="0.8"
            />

            <stop
              offset="40%"
              stopColor="#A5C2DE"
              stopOpacity="0.35"
            />

            <stop
              offset="100%"
              stopColor="#0A1017"
              stopOpacity="0"
            />
          </radialGradient>

          {/* =====================================================
              BRACKET SHADOW
              ===================================================== */}

          <filter
            id={bracketShadowId}
            x="100"
            y="120"
            width="312"
            height="272"
            filterUnits="userSpaceOnUse"
          >
            <feDropShadow
              dx="0"
              dy="16"
              stdDeviation="18"
              floodColor="#000000"
              floodOpacity="0.65"
            />

            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="6"
              floodColor="#000000"
              floodOpacity="0.45"
            />
          </filter>

          {/* =====================================================
              SPECULAR GLOW
              ===================================================== */}

          <filter
            id={specularGlowId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="3"
              floodColor="#FFFFFF"
              floodOpacity="0.9"
            />
          </filter>

          {/* =====================================================
              CLIPS
              ===================================================== */}

          <clipPath id={upperClipId}>
            <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" />
          </clipPath>

          <clipPath id={lowerClipId}>
            <path d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z" />
          </clipPath>

          {/* =====================================================
              METALLIC LIGHT SWEEP
              ===================================================== */}

          <mask id={sweepMaskId}>
            <rect
              className="cx-sweep-rect"
              x="-340"
              y="0"
              width="260"
              height="512"
              fill={`url(#${sweepGradientId})`}
            />
          </mask>

          <linearGradient
            id={sweepGradientId}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stopColor="#FFFFFF"
              stopOpacity="0"
            />

            <stop
              offset="50%"
              stopColor="#FFFFFF"
              stopOpacity="0.5"
            />

            <stop
              offset="100%"
              stopColor="#FFFFFF"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* =====================================================
            CENTER GLOW
            ===================================================== */}

        <circle
          className="cx-core-glow"
          cx="256"
          cy="256"
          r="45"
          fill={`url(#${diamondGlowId})`}
        />

        {/* =====================================================
            CEO LOGO
            ===================================================== */}

        <g className="cx-float">

          {/* ===================================================
              UPPER HALF
              =================================================== */}

          <g
            className="cx-bracket cx-upper"
            filter={`url(#${bracketShadowId})`}
          >
            <path
              d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z"
              fill={`url(#${upperGradientId})`}
            />

            <g
              clipPath={`url(#${upperClipId})`}
              mask={`url(#${sweepMaskId})`}
            >
              <rect
                x="100"
                y="120"
                width="312"
                height="272"
                fill="#FFFFFF"
                opacity="0.35"
              />
            </g>
          </g>

          {/* ===================================================
              LOWER HALF
              =================================================== */}

          <g
            className="cx-bracket cx-lower"
            filter={`url(#${bracketShadowId})`}
          >
            <path
              d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z"
              fill={`url(#${lowerGradientId})`}
            />

            <g
              clipPath={`url(#${lowerClipId})`}
              mask={`url(#${sweepMaskId})`}
            >
              <rect
                x="100"
                y="120"
                width="312"
                height="272"
                fill="#FFFFFF"
                opacity="0.35"
              />
            </g>
          </g>

          {/* ===================================================
              UPPER SPECULAR LINE
              =================================================== */}

          <line
            className="cx-spec cx-spec-a"
            x1="181"
            y1="166"
            x2="270"
            y2="166"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            filter={`url(#${specularGlowId})`}
          />

          {/* ===================================================
              LOWER SPECULAR LINE
              =================================================== */}

          <line
            className="cx-spec cx-spec-b"
            x1="242"
            y1="346"
            x2="331"
            y2="346"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            filter={`url(#${specularGlowId})`}
          />

          {/* ===================================================
              CENTER DIAMOND
              =================================================== */}

          <polygon
            className="cx-diamond"
            points="256,236 276,256 256,276 236,256"
            fill="#FFFFFF"
            filter={`url(#${specularGlowId})`}
          />
        </g>
      </svg>
    </>
  );
};


/* ==============================================================
   CEO EXCHANGE LOGO ANIMATION
   ==============================================================

   LOADING / REFRESH:
   ------------------
   The animation continuously runs while this component exists.

   Cycle:
      separated
          ↓
      fast convergence
          ↓
      complete CEO logo
          ↓
      quick hold
          ↓
      separated
          ↓
      repeat

   No fade-out.
   No JavaScript timer.
   No fixed number of loops.
   No network logic.

   AUTH SCREEN:
   -----------
   .ceo-auth-logo
   .ceo-boot-logo

   are explicitly STATIC.

   This means AuthScreen gets only the finished CEO logo.

   ============================================================== */

const css = `

  /* ============================================================
     MAIN LOGO
     ============================================================ */

  .cx-float {
    transform-origin: center;
  }


  /* ============================================================
     FAST UPPER CONVERGENCE

     Full cycle ≈ 1.5s
     0%–40%   → fast soft convergence (~600ms)
     40%–60%  → COMPLETE logo HOLD (~300ms) at translate(0,0)
     60%–100% → smooth separation (~600ms)
     ============================================================ */

  .cx-upper {
    transform-box: view-box;
    transform-origin: center;
    will-change: transform;

    animation:
      cx-upper-refresh
      1.5s
      cubic-bezier(.22,.88,.32,1)
      infinite;
  }


  @keyframes cx-upper-refresh {

    0% {
      opacity: 1;
      transform: translate(-58px, -28px);
    }

    18% {
      opacity: 1;
      transform: translate(-32px, -15px);
    }

    32% {
      opacity: 1;
      transform: translate(-10px, -5px);
    }

    /* Arrived — complete logo */
    40% {
      opacity: 1;
      transform: translate(0, 0);
    }

    /* HOLD ~300ms (40%→60% of 1.5s) — fully assembled, stable */
    60% {
      opacity: 1;
      transform: translate(0, 0);
    }

    78% {
      opacity: 1;
      transform: translate(-22px, -11px);
    }

    100% {
      opacity: 1;
      transform: translate(-58px, -28px);
    }
  }


  /* ============================================================
     FAST LOWER CONVERGENCE
     ============================================================ */

  .cx-lower {
    transform-box: view-box;
    transform-origin: center;
    will-change: transform;

    animation:
      cx-lower-refresh
      1.5s
      cubic-bezier(.22,.88,.32,1)
      infinite;
  }


  @keyframes cx-lower-refresh {

    0% {
      opacity: 1;
      transform: translate(58px, 28px);
    }

    18% {
      opacity: 1;
      transform: translate(32px, 15px);
    }

    32% {
      opacity: 1;
      transform: translate(10px, 5px);
    }

    40% {
      opacity: 1;
      transform: translate(0, 0);
    }

    /* HOLD ~300ms — fully assembled with upper */
    60% {
      opacity: 1;
      transform: translate(0, 0);
    }

    78% {
      opacity: 1;
      transform: translate(22px, 11px);
    }

    100% {
      opacity: 1;
      transform: translate(58px, 28px);
    }
  }


  /* ============================================================
     CENTER GLOW — peaks during assembled hold
     ============================================================ */

  .cx-core-glow {
    animation:
      cx-core-pulse
      1.5s
      ease-in-out
      infinite;
  }


  @keyframes cx-core-pulse {

    0%,
    100% {
      opacity: .62;
    }

    40%,
    60% {
      opacity: 1;
    }
  }


  /* ============================================================
     CENTER DIAMOND — stable scale during hold
     ============================================================ */

  .cx-diamond {
    transform-box: fill-box;
    transform-origin: center;
    will-change: transform;

    animation:
      cx-diamond-pulse
      1.5s
      cubic-bezier(.34,1.25,.4,1)
      infinite;
  }


  @keyframes cx-diamond-pulse {

    0% {
      opacity: 1;
      transform: scale(.92);
    }

    40% {
      opacity: 1;
      transform: scale(1);
    }

    /* Hold at complete logo scale */
    60% {
      opacity: 1;
      transform: scale(1);
    }

    100% {
      opacity: 1;
      transform: scale(.92);
    }
  }


  /* ============================================================
     SPECULAR HIGHLIGHTS — fully drawn during hold
     ============================================================ */

  .cx-spec {
    stroke-dasharray: 110;
    will-change: stroke-dashoffset, opacity;

    animation:
      cx-spec-refresh
      1.5s
      ease-in-out
      infinite;
  }


  .cx-spec-b {
    animation-delay: .04s;
  }


  @keyframes cx-spec-refresh {

    0% {
      stroke-dashoffset: 110;
      opacity: .3;
    }

    28% {
      stroke-dashoffset: 30;
      opacity: .85;
    }

    40% {
      stroke-dashoffset: 0;
      opacity: 1;
    }

    /* Hold — lines fully visible on complete logo */
    60% {
      stroke-dashoffset: 0;
      opacity: 1;
    }

    82% {
      stroke-dashoffset: 40;
      opacity: .5;
    }

    100% {
      stroke-dashoffset: 110;
      opacity: .3;
    }
  }


  /* ============================================================
     METALLIC LIGHT SWEEP — passes during/after assembly
     ============================================================ */

  .cx-sweep-rect {
    animation:
      cx-sweep-refresh
      1.5s
      cubic-bezier(.45,0,.25,1)
      infinite;
  }


  @keyframes cx-sweep-refresh {

    0% {
      transform: translateX(-80px);
      opacity: 0;
    }

    18% {
      transform: translateX(80px);
      opacity: .35;
    }

    45% {
      transform: translateX(430px);
      opacity: .7;
    }

    60% {
      transform: translateX(760px);
      opacity: 0;
    }

    100% {
      transform: translateX(760px);
      opacity: 0;
    }
  }


  /* ============================================================
     AUTH SCREEN — STATIC LOGO
     ============================================================

     AuthScreen uses:
       ceo-auth-logo
       ceo-boot-logo

     These must NEVER animate.

     This override is deliberately applied to every animated
     child inside those SVGs.
     ============================================================ */

  .ceo-auth-logo .cx-upper,
  .ceo-auth-logo .cx-lower,
  .ceo-auth-logo .cx-core-glow,
  .ceo-auth-logo .cx-diamond,
  .ceo-auth-logo .cx-spec,
  .ceo-auth-logo .cx-sweep-rect,

  .ceo-boot-logo .cx-upper,
  .ceo-boot-logo .cx-lower,
  .ceo-boot-logo .cx-core-glow,
  .ceo-boot-logo .cx-diamond,
  .ceo-boot-logo .cx-spec,
  .ceo-boot-logo .cx-sweep-rect {
    animation: none !important;
  }


  /* Static final positions for AuthScreen */

  .ceo-auth-logo .cx-upper,
  .ceo-boot-logo .cx-upper {
    opacity: 1 !important;
    transform: translate(0, 0) !important;
  }


  .ceo-auth-logo .cx-lower,
  .ceo-boot-logo .cx-lower {
    opacity: 1 !important;
    transform: translate(0, 0) !important;
  }


  .ceo-auth-logo .cx-core-glow,
  .ceo-boot-logo .cx-core-glow {
    opacity: .8 !important;
  }


  .ceo-auth-logo .cx-diamond,
  .ceo-boot-logo .cx-diamond {
    opacity: 1 !important;
    transform: scale(1) !important;
  }


  .ceo-auth-logo .cx-spec,
  .ceo-boot-logo .cx-spec {
    stroke-dashoffset: 0 !important;
    opacity: .75 !important;
  }


  .ceo-auth-logo .cx-sweep-rect,
  .ceo-boot-logo .cx-sweep-rect {
    opacity: 0 !important;
    transform: translateX(760px) !important;
  }


  /* ============================================================
     REDUCED MOTION
     ============================================================ */

  @media (prefers-reduced-motion: reduce) {

    .cx-upper,
    .cx-lower,
    .cx-core-glow,
    .cx-diamond,
    .cx-spec,
    .cx-sweep-rect {
      animation: none !important;
    }

    .cx-upper,
    .cx-lower {
      opacity: 1;
      transform: translate(0, 0);
    }

    .cx-core-glow {
      opacity: .8;
    }

    .cx-diamond {
      opacity: 1;
      transform: scale(1);
    }

    .cx-spec {
      stroke-dashoffset: 0;
      opacity: .75;
    }

    .cx-sweep-rect {
      opacity: 0;
      transform: translateX(760px);
    }
  }
`;

export default CeoExchangeEmblemAnimated;
