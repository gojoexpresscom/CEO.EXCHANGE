import React, { useId } from 'react';

export const CeoExchangeEmblemAnimated: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 120, className = '' }) => {
  /*
   * Each logo instance gets unique SVG IDs.
   *
   * This is important because Home.tsx can render more than one
   * CeoExchangeEmblemAnimated at the same time.
   *
   * Without unique IDs, gradients/filters/masks can resolve to
   * another SVG instance and make the logo appear invisible.
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
              ORIGINAL CEO EXCHANGE GRADIENTS
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
              ORIGINAL CLIPPING PATHS
              ===================================================== */}

          <clipPath id={upperClipId}>
            <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" />
          </clipPath>

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
            ===================================================== */}

        <circle
          className="cx-core-glow"
          cx="256"
          cy="256"
          r="45"
          fill={`url(#${diamondGlowId})`}
        />

        {/* =====================================================
            MAIN ANIMATED LOGO
            ===================================================== */}

        <g className="cx-float">

          {/* ===================================================
              UPPER CEO BRACKET
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
              LOWER CEO BRACKET
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


/* =========================================================
   CEO EXCHANGE LOADING ANIMATION
   =========================================================

   ONE COMPLETE REFRESH:
       0.00s → 2.72s

   THEN IT RESTARTS:
       2.72s → 5.44s
       5.44s → 8.16s
       etc.

   It continues ONLY while this component is mounted.

   Fast network:
       loading finishes → component disappears → animation stops.

   Slow network:
       component stays mounted → animation keeps refreshing.

   NO fixed number of repetitions.

   ========================================================= */

const css = `

  /* =====================================================
     MAIN LOGO
     ===================================================== */

  .cx-float {
    transform-origin: center;

    animation:
      cx-refresh-float
      2.72s
      cubic-bezier(.22,.9,.3,1)
      0s
      infinite;
  }


  /* =====================================================
     CENTER GLOW
     ===================================================== */

  .cx-core-glow {
    animation:
      cx-refresh-core
      2.72s
      ease-in-out
      0s
      infinite;
  }


  /* =====================================================
     UPPER BRACKET
     ===================================================== */

  .cx-upper {
    transform-origin: center;

    animation:
      cx-refresh-upper
      2.72s
      cubic-bezier(.16,.8,.24,1)
      0s
      infinite;
  }


  /* =====================================================
     LOWER BRACKET
     ===================================================== */

  .cx-lower {
    transform-origin: center;

    animation:
      cx-refresh-lower
      2.72s
      cubic-bezier(.16,.8,.24,1)
      0s
      infinite;
  }


  /* =====================================================
     CENTER DIAMOND
     ===================================================== */

  .cx-diamond {
    transform-box: fill-box;
    transform-origin: center;

    animation:
      cx-refresh-diamond
      2.72s
      cubic-bezier(.34,1.6,.4,1)
      0s
      infinite;
  }


  /* =====================================================
     SPECULAR LINES
     ===================================================== */

  .cx-spec {
    stroke-dasharray: 110;
    stroke-dashoffset: 110;

    animation:
      cx-refresh-spec
      2.72s
      ease-out
      0s
      infinite;
  }


  /* =====================================================
     LIGHT SWEEP
     ===================================================== */

  .cx-sweep-rect {
    animation:
      cx-refresh-sweep
      2.72s
      cubic-bezier(.45,0,.25,1)
      0s
      infinite;
  }


  /* =====================================================
     MAIN REFRESH MOTION
     ===================================================== */

  @keyframes cx-refresh-float {

    0% {
      opacity: 0;
      transform:
        translateY(26px)
        scale(.96);
    }

    10% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }

    23% {
      opacity: 1;
      transform:
        translateY(-3px)
        scale(1.015);
    }

    38% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }

    50% {
      opacity: .72;
      transform:
        translateY(0)
        scale(.965);
    }

    62% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }

    78% {
      opacity: 1;
      transform:
        translateY(-1px)
        scale(1.008);
    }

    88% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }

    100% {
      opacity: 0;
      transform:
        translateY(26px)
        scale(.96);
    }
  }


  /* =====================================================
     CORE GLOW REFRESH
     ===================================================== */

  @keyframes cx-refresh-core {

    0% {
      opacity: 0;
    }

    10% {
      opacity: .65;
    }

    24% {
      opacity: .95;
    }

    40% {
      opacity: .72;
    }

    55% {
      opacity: 1;
    }

    70% {
      opacity: .78;
    }

    82% {
      opacity: 1;
    }

    90% {
      opacity: .75;
    }

    100% {
      opacity: 0;
    }
  }


  /* =====================================================
     UPPER BRACKET REFRESH
     ===================================================== */

  @keyframes cx-refresh-upper {

    0% {
      opacity: 0;
      transform:
        translate(-46px,-18px);
    }

    12% {
      opacity: .25;
    }

    27% {
      opacity: 1;
      transform:
        translate(0,0);
    }

    40% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1.012);
    }

    52% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }

    72% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1.008);
    }

    88% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }

    100% {
      opacity: 0;
      transform:
        translate(-46px,-18px);
    }
  }


  /* =====================================================
     LOWER BRACKET REFRESH
     ===================================================== */

  @keyframes cx-refresh-lower {

    0% {
      opacity: 0;
      transform:
        translate(46px,18px);
    }

    14% {
      opacity: .25;
    }

    32% {
      opacity: 1;
      transform:
        translate(0,0);
    }

    45% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1.012);
    }

    57% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }

    74% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1.008);
    }

    88% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }

    100% {
      opacity: 0;
      transform:
        translate(46px,18px);
    }
  }


  /* =====================================================
     DIAMOND REFRESH
     ===================================================== */

  @keyframes cx-refresh-diamond {

    0% {
      opacity: 0;
      transform:
        scale(0)
        rotate(45deg);
    }

    14% {
      opacity: 0;
      transform:
        scale(.25)
        rotate(35deg);
    }

    28% {
      opacity: 1;
      transform:
        scale(1.08)
        rotate(0deg);
    }

    38% {
      opacity: 1;
      transform:
        scale(.96)
        rotate(0deg);
    }

    50% {
      opacity: 1;
      transform:
        scale(1)
        rotate(0deg);
    }

    63% {
      opacity: 1;
      transform:
        scale(1.09)
        rotate(0deg);
    }

    74% {
      opacity: .92;
      transform:
        scale(1)
        rotate(0deg);
    }

    88% {
      opacity: 1;
      transform:
        scale(1.04)
        rotate(0deg);
    }

    100% {
      opacity: 0;
      transform:
        scale(0)
        rotate(45deg);
    }
  }


  /* =====================================================
     SPECULAR LINE REFRESH
     ===================================================== */

  @keyframes cx-refresh-spec {

    0% {
      stroke-dashoffset: 110;
      opacity: 0;
    }

    20% {
      stroke-dashoffset: 110;
      opacity: 0;
    }

    35% {
      stroke-dashoffset: 55;
      opacity: .6;
    }

    48% {
      stroke-dashoffset: 0;
      opacity: 1;
    }

    58% {
      stroke-dashoffset: 0;
      opacity: .55;
    }

    70% {
      stroke-dashoffset: 0;
      opacity: 1;
    }

    82% {
      stroke-dashoffset: 0;
      opacity: .55;
    }

    90% {
      stroke-dashoffset: 0;
      opacity: .55;
    }

    100% {
      stroke-dashoffset: 110;
      opacity: 0;
    }
  }


  /* =====================================================
     LIGHT SWEEP REFRESH
     ===================================================== */

  @keyframes cx-refresh-sweep {

    0% {
      transform: translateX(0);
      opacity: 0;
    }

    14% {
      transform: translateX(0);
      opacity: 0;
    }

    24% {
      opacity: 1;
    }

    58% {
      transform: translateX(760px);
      opacity: 1;
    }

    68% {
      transform: translateX(760px);
      opacity: 0;
    }

    100% {
      transform: translateX(760px);
      opacity: 0;
    }
  }


  /* =====================================================
     ACCESSIBILITY
     ===================================================== */

  @media (prefers-reduced-motion: reduce) {

    .cx-float,
    .cx-core-glow,
    .cx-upper,
    .cx-lower,
    .cx-diamond,
    .cx-spec,
    .cx-sweep-rect {
      animation: none !important;
    }

    .cx-float {
      opacity: 1;
      transform: none;
    }

    .cx-core-glow {
      opacity: .75;
    }

    .cx-upper,
    .cx-lower {
      opacity: 1;
      transform: none;
    }

    .cx-diamond {
      opacity: .92;
      transform:
        scale(1)
        rotate(0);
    }

    .cx-spec {
      stroke-dashoffset: 0;
      opacity: .55;
    }

    .cx-sweep-rect {
      transform: translateX(760px);
      opacity: 0;
    }
  }
`;

export default CeoExchangeEmblemAnimated;
