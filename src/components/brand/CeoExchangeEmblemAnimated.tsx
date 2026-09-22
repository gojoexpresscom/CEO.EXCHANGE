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
          <linearGradient
            id="cx-titanium-upper"
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
            id="cx-titanium-lower"
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
            id="cx-diamond-glow"
            cx="256"
            cy="256"
            r="45"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#A5C2DE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0A1017" stopOpacity="0" />
          </radialGradient>

          <filter
            id="cx-bracket-shadow"
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

          <filter
            id="cx-specular-glow"
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

          <clipPath id="cx-upper-clip">
            <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" />
          </clipPath>
          <clipPath id="cx-lower-clip">
            <path d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z" />
          </clipPath>
          <mask id="cx-sweep-mask">
            <rect className="cx-sweep-rect" x="-340" y="0" width="260" height="512" fill="url(#cx-sweep)" />
          </mask>
          <linearGradient id="cx-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle className="cx-core-glow" cx="256" cy="256" r="45" fill="url(#cx-diamond-glow)" />

        <g className="cx-float">
          <g className="cx-bracket cx-upper" filter="url(#cx-bracket-shadow)">
            <path
              d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z"
              fill="url(#cx-titanium-upper)"
            />
            <g clipPath="url(#cx-upper-clip)" mask="url(#cx-sweep-mask)">
              <rect x="100" y="120" width="312" height="272" fill="#ffffff" opacity="0.35" />
            </g>
          </g>
          <g className="cx-bracket cx-lower" filter="url(#cx-bracket-shadow)">
            <path
              d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z"
              fill="url(#cx-titanium-lower)"
            />
            <g clipPath="url(#cx-lower-clip)" mask="url(#cx-sweep-mask)">
              <rect x="100" y="120" width="312" height="272" fill="#ffffff" opacity="0.35" />
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
            filter="url(#cx-specular-glow)"
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
            filter="url(#cx-specular-glow)"
          />

          <polygon
            className="cx-diamond"
            points="256,236 276,256 256,276 236,256"
            fill="#FFFFFF"
            filter="url(#cx-specular-glow)"
          />
        </g>
      </svg>
    </>
  );
};

const css = `
  /* BingX-style loading refresh:
     cycle ≈ 2.72s
     play exactly 2 cycles
     then remain on the finished CEO logo */
  .cx-float {
    animation: cx-refresh-cycle 2.72s cubic-bezier(.22,.9,.3,1) 0s 2 both;
  }

  .cx-core-glow {
    animation: cx-core-cycle 2.72s ease-out 0s 2 both;
  }

  .cx-upper {
    animation: cx-enter-upper 0.55s 0.08s cubic-bezier(.16,.8,.24,1) both;
  }

  .cx-lower {
    animation: cx-enter-lower 0.55s 0.14s cubic-bezier(.16,.8,.24,1) both;
  }

  .cx-diamond {
    transform-box: fill-box;
    transform-origin: center;
    animation: cx-diamond-cycle 2.72s cubic-bezier(.34,1.4,.4,1) 0s 2 both;
  }

  .cx-spec {
    stroke-dasharray: 110;
    stroke-dashoffset: 110;
    animation: cx-draw 0.55s ease-out forwards, cx-spec-cycle 2.72s ease-in-out 0s 2 both;
  }

  .cx-spec-a { animation-delay: 0.35s, 0s; }
  .cx-spec-b { animation-delay: 0.45s, 0.12s; }

  .cx-sweep-rect {
    animation: cx-sweep 2.72s cubic-bezier(.45,0,.25,1) 0s 2 both;
  }

  @keyframes cx-refresh-cycle {
    0% {
      opacity: 0;
      transform: translateY(18px) scale(.92);
    }
    10% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    28% {
      opacity: 1;
      transform: translateY(-2px) scale(1.015);
    }
    48% {
      opacity: .72;
      transform: translateY(0) scale(.965);
    }
    62% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    82% {
      opacity: 1;
      transform: translateY(-1px) scale(1.008);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes cx-core-cycle {
    0% { opacity: 0; }
    12% { opacity: .85; }
    48% { opacity: .55; }
    62% { opacity: .9; }
    100% { opacity: .8; }
  }

  @keyframes cx-enter-upper {
    from { opacity: 0; transform: translate(-28px, -12px); }
    to { opacity: 1; transform: none; }
  }

  @keyframes cx-enter-lower {
    from { opacity: 0; transform: translate(28px, 12px); }
    to { opacity: 1; transform: none; }
  }

  @keyframes cx-diamond-cycle {
    0% { opacity: 0; transform: scale(0) rotate(45deg); }
    12% { opacity: 1; transform: scale(1) rotate(0); }
    48% { opacity: .85; transform: scale(.96) rotate(0); }
    62% { opacity: 1; transform: scale(1.04) rotate(0); }
    100% { opacity: 1; transform: scale(1) rotate(0); }
  }

  @keyframes cx-draw {
    to { stroke-dashoffset: 0; }
  }

  @keyframes cx-spec-cycle {
    0%, 70%, 100% { opacity: .7; }
    40% { opacity: 1; }
    48% { opacity: .45; }
    62% { opacity: 1; }
  }

  @keyframes cx-sweep {
    0% { transform: translateX(0); }
    42% { transform: translateX(760px); }
    100% { transform: translateX(760px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .cx-float, .cx-core-glow, .cx-upper, .cx-lower, .cx-diamond, .cx-spec, .cx-sweep-rect {
      animation: none !important;
    }
    .cx-float, .cx-core-glow, .cx-upper, .cx-lower, .cx-diamond {
      opacity: 1;
      transform: none;
    }
    .cx-spec { stroke-dashoffset: 0; opacity: 1; }
  }
`;

export default CeoExchangeEmblemAnimated;
