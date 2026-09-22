import React from 'react';

export const CeoExchangeEmblemAnimated: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 120, className = '' }) => {
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
      >
        <defs>
          {/* Keep your ORIGINAL gradients and filters here exactly as they were. */}

          <clipPath id="cx-upper-clip">
            <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" />
          </clipPath>

          <clipPath id="cx-lower-clip">
            <path d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z" />
          </clipPath>

          <mask id="cx-sweep-mask">
            <rect
              className="cx-sweep-rect"
              x="-340"
              y="0"
              width="260"
              height="512"
              fill="url(#cx-sweep)"
            />
          </mask>

          <linearGradient
            id="cx-sweep"
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

        {/* Center glow */}
        <circle
          className="cx-core-glow"
          cx="256"
          cy="256"
          r="45"
          fill="url(#diamond-glow)"
        />

        {/* Main animated logo */}
        <g className="cx-float">

          {/* Upper CEO bracket */}
          <g
            className="cx-bracket cx-upper"
            filter="url(#bracket-shadow)"
          >
            <path
              d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z"
              fill="url(#titanium-upper)"
            />

            <g
              clipPath="url(#cx-upper-clip)"
              mask="url(#cx-sweep-mask)"
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

          {/* Lower CEO bracket */}
          <g
            className="cx-bracket cx-lower"
            filter="url(#bracket-shadow)"
          >
            <path
              d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z"
              fill="url(#titanium-lower)"
            />

            <g
              clipPath="url(#cx-lower-clip)"
              mask="url(#cx-sweep-mask)"
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

          {/* Upper specular line */}
          <line
            className="cx-spec cx-spec-a"
            x1="181"
            y1="166"
            x2="270"
            y2="166"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#specular-glow)"
          />

          {/* Lower specular line */}
          <line
            className="cx-spec cx-spec-b"
            x1="242"
            y1="346"
            x2="331"
            y2="346"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#specular-glow)"
          />

          {/* Center diamond */}
          <polygon
            className="cx-diamond"
            points="256,236 276,256 256,276 236,256"
            fill="#FFFFFF"
            filter="url(#specular-glow)"
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

   There is NO fixed number of repetitions.

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
