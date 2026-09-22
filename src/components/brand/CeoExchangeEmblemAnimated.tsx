import React, { useId } from 'react';

export const CeoExchangeEmblemAnimated: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 120, className = '' }) => {
  /*
   * IMPORTANT:
   *
   * There is NO timer here.
   * There is NO network request here.
   * There is NO fixed number of repetitions.
   *
   * The parent component controls how long this component exists.
   *
   * While this component is mounted:
   *   → animation repeats continuously.
   *
   * When the parent unmounts it after refresh/loading finishes:
   *   → animation stops automatically.
   */

  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  /*
   * Unique SVG IDs.
   * This prevents multiple CEO logos on the same page
   * from sharing gradients, filters, clips or masks.
   */

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
              ORIGINAL CEO EXCHANGE TITANIUM GRADIENT
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
              CENTER DIAMOND GLOW
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
              ORIGINAL BRACKET SHADOW
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
              ORIGINAL SPECULAR GLOW
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
              UPPER CLIP
              ===================================================== */}

          <clipPath id={upperClipId}>
            <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" />
          </clipPath>

          {/* =====================================================
              LOWER CLIP
              ===================================================== */}

          <clipPath id={lowerClipId}>
            <path d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z" />
          </clipPath>

          {/* =====================================================
              LIGHT SWEEP MASK
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
              stopColor="#fff"
              stopOpacity="0"
            />

            <stop
              offset="50%"
              stopColor="#fff"
              stopOpacity="0.5"
            />

            <stop
              offset="100%"
              stopColor="#fff"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* =====================================================
            CENTER GLOW

            Always exists while the component is mounted.
            ===================================================== */}

        <circle
          className="cx-core-glow"
          cx="256"
          cy="256"
          r="45"
          fill={`url(#${diamondGlowId})`}
        />

        {/* =====================================================
            MAIN LOGO

            The whole logo stays in the same place.

            ONLY the upper and lower pieces move toward
            and away from each other.
            ===================================================== */}

        <g className="cx-float">

          {/* ===================================================
              UPPER CEO PIECE
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
                fill="#ffffff"
                opacity="0.35"
              />
            </g>
          </g>

          {/* ===================================================
              LOWER CEO PIECE
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
                fill="#ffffff"
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


/* ============================================================
   CEO EXCHANGE NETWORK-DEPENDENT LOADING ANIMATION
   ============================================================

   IMPORTANT:

   This file DOES NOT control the network.

   It does NOT use:
     - setTimeout
     - setInterval
     - playCount
     - fixed refresh count
     - fixed loading duration
     - 3-second replay timer
     - 5.44-second wait

   The PARENT decides when this component is mounted.

   While mounted:
       animation runs forever.

   When parent unmounts:
       animation stops immediately.

   ============================================================

   ANIMATION:

       START
         ↓
       upper piece is separated
       lower piece is separated
         ↓
       both move toward center
         ↓
       complete CEO logo
         ↓
       stays together briefly
         ↓
       smoothly separates again
         ↓
       comes together again
         ↓
       forever...

   There is NO opacity fade-out.

   ============================================================ */

const css = `

  /* ==========================================================
     MAIN CONTAINER

     The complete logo itself does NOT move around the page.
     ========================================================== */

  .cx-float {
    transform-origin: center;
  }


  /* ==========================================================
     UPPER PIECE

     Starts:
       upper + left

     Moves:
       toward center

     Then:
       remains visible and together

     Then:
       separates again for the next cycle.
     ========================================================== */

  .cx-upper {
    transform-box: view-box;
    transform-origin: center;

    animation:
      cx-upper-refresh
      2.72s
      cubic-bezier(.22,.9,.3,1)
      infinite;
  }


  @keyframes cx-upper-refresh {

    /* Start separated */
    0% {
      opacity: 1;
      transform:
        translate(-58px, -28px);
    }

    /* Begin moving toward center */
    18% {
      opacity: 1;
      transform:
        translate(-46px, -22px);
    }

    /* Continue convergence */
    38% {
      opacity: 1;
      transform:
        translate(-25px, -12px);
    }

    /* Almost together */
    55% {
      opacity: 1;
      transform:
        translate(-7px, -3px);
    }

    /* Fully together */
    65% {
      opacity: 1;
      transform:
        translate(0, 0);
    }

    /* Stay together */
    72% {
      opacity: 1;
      transform:
        translate(0, 0);
    }

    /* Begin next separation */
    84% {
      opacity: 1;
      transform:
        translate(-12px, -6px);
    }

    /* Back to separated position */
    100% {
      opacity: 1;
      transform:
        translate(-58px, -28px);
    }
  }


  /* ==========================================================
     LOWER PIECE

     Starts:
       lower + right

     Moves:
       toward center

     Then:
       remains together

     Then:
       separates again.

     OPACITY NEVER BECOMES ZERO.
     ========================================================== */

  .cx-lower {
    transform-box: view-box;
    transform-origin: center;

    animation:
      cx-lower-refresh
      2.72s
      cubic-bezier(.22,.9,.3,1)
      infinite;
  }


  @keyframes cx-lower-refresh {

    /* Start separated */
    0% {
      opacity: 1;
      transform:
        translate(58px, 28px);
    }

    /* Begin moving toward center */
    18% {
      opacity: 1;
      transform:
        translate(46px, 22px);
    }

    /* Continue convergence */
    38% {
      opacity: 1;
      transform:
        translate(25px, 12px);
    }

    /* Almost together */
    55% {
      opacity: 1;
      transform:
        translate(7px, 3px);
    }

    /* Fully together */
    65% {
      opacity: 1;
      transform:
        translate(0, 0);
    }

    /* Stay together */
    72% {
      opacity: 1;
      transform:
        translate(0, 0);
    }

    /* Begin next separation */
    84% {
      opacity: 1;
      transform:
        translate(12px, 6px);
    }

    /* Back to separated position */
    100% {
      opacity: 1;
      transform:
        translate(58px, 28px);
    }
  }


  /* ==========================================================
     CENTER GLOW

     Never disappears.
     ========================================================== */

  .cx-core-glow {
    animation:
      cx-core-pulse
      2.2s
      ease-in-out
      infinite;
  }


  @keyframes cx-core-pulse {

    0%,
    100% {
      opacity: .72;
    }

    50% {
      opacity: 1;
    }
  }


  /* ==========================================================
     CENTER DIAMOND

     Stays visible.
     Small breathing/pulse effect.
     ========================================================== */

  .cx-diamond {
    transform-box: fill-box;
    transform-origin: center;

    animation:
      cx-diamond-pulse
      2.72s
      cubic-bezier(.34,1.35,.4,1)
      infinite;
  }


  @keyframes cx-diamond-pulse {

    0% {
      opacity: 1;
      transform:
        scale(.94)
        rotate(0deg);
    }

    22% {
      opacity: 1;
      transform:
        scale(1)
        rotate(0deg);
    }

    55% {
      opacity: 1;
      transform:
        scale(1.08)
        rotate(0deg);
    }

    68% {
      opacity: 1;
      transform:
        scale(1)
        rotate(0deg);
    }

    82% {
      opacity: 1;
      transform:
        scale(1.05)
        rotate(0deg);
    }

    100% {
      opacity: 1;
      transform:
        scale(.94)
        rotate(0deg);
    }
  }


  /* ==========================================================
     SPECULAR LINES

     They remain visible.
     ========================================================== */

  .cx-spec {
    stroke-dasharray: 110;

    animation:
      cx-spec-refresh
      2.72s
      ease-in-out
      infinite;
  }


  .cx-spec-a {
    animation-delay: 0s;
  }


  .cx-spec-b {
    animation-delay: .08s;
  }


  @keyframes cx-spec-refresh {

    0% {
      stroke-dashoffset: 110;
      opacity: .25;
    }

    18% {
      stroke-dashoffset: 75;
      opacity: .55;
    }

    38% {
      stroke-dashoffset: 25;
      opacity: .85;
    }

    55% {
      stroke-dashoffset: 0;
      opacity: 1;
    }

    70% {
      stroke-dashoffset: 0;
      opacity: .72;
    }

    84% {
      stroke-dashoffset: 0;
      opacity: .55;
    }

    100% {
      stroke-dashoffset: 110;
      opacity: .25;
    }
  }


  /* ==========================================================
     LIGHT SWEEP

     Subtle sweep over the metallic pieces.
     ========================================================== */

  .cx-sweep-rect {
    animation:
      cx-sweep-refresh
      2.72s
      cubic-bezier(.45,0,.25,1)
      infinite;
  }


  @keyframes cx-sweep-refresh {

    0% {
      transform: translateX(-80px);
      opacity: 0;
    }

    18% {
      transform: translateX(40px);
      opacity: .4;
    }

    48% {
      transform: translateX(430px);
      opacity: .7;
    }

    62% {
      transform: translateX(760px);
      opacity: 0;
    }

    100% {
      transform: translateX(760px);
      opacity: 0;
    }
  }


  /* ==========================================================
     REDUCED MOTION
     ========================================================== */

  @media (prefers-reduced-motion: reduce) {

    .cx-float,
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
      transform:
        scale(1)
        rotate(0deg);
    }

    .cx-spec {
      stroke-dashoffset: 0;
      opacity: .75;
    }

    .cx-sweep-rect {
      transform: translateX(760px);
      opacity: 0;
    }
  }
`;

export default CeoExchangeEmblemAnimated;
