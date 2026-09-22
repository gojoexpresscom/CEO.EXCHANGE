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
          {/* ...same gradients + bracket-shadow + specular-glow as your original... */}

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

          <linearGradient id="cx-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle
          className="cx-core-glow"
          cx="256"
          cy="256"
          r="45"
          fill="url(#diamond-glow)"
        />

        <g className="cx-float">

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

const css = `

  /*
   * CEO EXCHANGE LOGO LOADING MOTION
   *
   * One complete animation cycle = 2.72 seconds
   * Total playback = 2 cycles = 5.44 seconds
   *
   * Cycle 1: 0.00s → 2.72s
   * Cycle 2: 2.72s → 5.44s
   *
   * After 5.44s the finished logo remains stable.
   * No infinite animation.
   */

  .cx-float {
    animation:
      cx-refresh-float 2.72s cubic-bezier(.22,.9,.3,1) 0s 2 both;
    transform-origin: center;
  }

  .cx-core-glow {
    animation:
      cx-refresh-core 2.72s ease-in-out 0s 2 both;
  }

  .cx-upper {
    animation:
      cx-refresh-upper 2.72s cubic-bezier(.16,.8,.24,1) 0s 2 both;
    transform-origin: center;
  }

  .cx-lower {
    animation:
      cx-refresh-lower 2.72s cubic-bezier(.16,.8,.24,1) 0s 2 both;
    transform-origin: center;
  }

  .cx-diamond {
    transform-box: fill-box;
    transform-origin: center;

    animation:
      cx-refresh-diamond 2.72s cubic-bezier(.34,1.6,.4,1) 0s 2 both;
  }

  .cx-spec {
    stroke-dasharray: 110;
    stroke-dashoffset: 110;

    animation:
      cx-refresh-spec 2.72s ease-out 0s 2 both;
  }

  .cx-sweep-rect {
    animation:
      cx-refresh-sweep 2.72s cubic-bezier(.45,0,.25,1) 0s 2 both;
  }


  /* ================================
     MAIN LOGO MOVEMENT
     ================================ */

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

    24% {
      opacity: 1;
      transform:
        translateY(-3px)
        scale(1.015);
    }

    40% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }

    55% {
      opacity: .86;
      transform:
        translateY(-1px)
        scale(.985);
    }

    70% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }

    100% {
      opacity: 1;
      transform:
        translateY(0)
        scale(1);
    }
  }


  /* ================================
     CORE GLOW
     ================================ */

  @keyframes cx-refresh-core {

    0% {
      opacity: 0;
    }

    12% {
      opacity: .75;
    }

    28% {
      opacity: 1;
    }

    48% {
      opacity: .72;
    }

    65% {
      opacity: 1;
    }

    82% {
      opacity: .82;
    }

    100% {
      opacity: .75;
    }
  }


  /* ================================
     UPPER BRACKET
     ================================ */

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

    42% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1.012);
    }

    55% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }

    100% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }
  }


  /* ================================
     LOWER BRACKET
     ================================ */

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

    47% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1.012);
    }

    58% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }

    100% {
      opacity: 1;
      transform:
        translate(0,0)
        scale(1);
    }
  }


  /* ================================
     CENTER DIAMOND
     ================================ */

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

    30% {
      opacity: 1;
      transform:
        scale(1.08)
        rotate(0deg);
    }

    39% {
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

    62% {
      opacity: 1;
      transform:
        scale(1.09)
        rotate(0deg);
    }

    72% {
      opacity: .92;
      transform:
        scale(1)
        rotate(0deg);
    }

    100% {
      opacity: .92;
      transform:
        scale(1)
        rotate(0deg);
    }
  }


  /* ================================
     SPECULAR LINES
     ================================ */

  @keyframes cx-refresh-spec {

    0% {
      stroke-dashoffset: 110;
      opacity: 0;
    }

    18% {
      stroke-dashoffset: 110;
      opacity: 0;
    }

    36% {
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

    100% {
      stroke-dashoffset: 0;
      opacity: .55;
    }
  }


  /* ================================
     LIGHT SWEEP
     ================================ */

  @keyframes cx-refresh-sweep {

    0% {
      transform: translateX(0);
      opacity: 0;
    }

    15% {
      transform: translateX(0);
      opacity: 0;
    }

    25% {
      opacity: 1;
    }

    62% {
      transform: translateX(760px);
      opacity: 1;
    }

    72% {
      transform: translateX(760px);
      opacity: 0;
    }

    100% {
      transform: translateX(760px);
      opacity: 0;
    }
  }


  /* ================================
     REDUCED MOTION
     ================================ */

  @media (prefers-reduced-motion: reduce) {

    .cx-float,
    .cx-core-glow,
    .cx-upper,
    .cx-lower,
    .cx-diamond,
    .cx-spec,
    .cx-sweep-rect {
      animation: none;
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
      transform: scale(1) rotate(0);
    }

    .cx-spec {
      stroke-dashoffset: 0;
      opacity: .55;
    }

    .cx-sweep-rect {
      transform: translateX(760px);
    }
  }
`;

export default CeoExchangeEmblemAnimated;
