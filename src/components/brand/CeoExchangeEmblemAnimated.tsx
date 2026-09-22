import React from 'react';

interface CeoExchangeEmblemAnimatedProps {
  size?: number;
  className?: string;
  /** Set to true to trigger refresh, or leave default true for continuous loop */
  isRefreshing?: boolean;
}

export const CeoExchangeEmblemAnimated: React.FC<CeoExchangeEmblemAnimatedProps> = ({
  size = 140,
  className = '',
  isRefreshing = true,
}) => {
  return (
    <>
      <style>{refreshCss}</style>
      <div
        className={`cx-refresh-container ${isRefreshing ? 'is-refreshing' : ''} ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          className="cx-animated-svg"
          width={size}
          height={size}
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Brushed Titanium Upper Bracket Gradient */}
            <linearGradient id="titanium-upper" x1="160" y1="160" x2="350" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="22%" stopColor="#DCE3EB" />
              <stop offset="55%" stopColor="#8C9CAE" />
              <stop offset="85%" stopColor="#5B6978" />
              <stop offset="100%" stopColor="#465362" />
            </linearGradient>

            {/* Brushed Titanium Lower Bracket Gradient */}
            <linearGradient id="titanium-lower" x1="160" y1="230" x2="350" y2="350" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CBD6E2" />
              <stop offset="25%" stopColor="#8E9EAF" />
              <stop offset="65%" stopColor="#606E7D" />
              <stop offset="90%" stopColor="#7B8B9B" />
              <stop offset="100%" stopColor="#B2C0CE" />
            </linearGradient>

            {/* Diamond Center Radial Glow */}
            <radialGradient id="diamond-glow" cx="256" cy="256" r="45" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#A5C2DE" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0A1017" stopOpacity="0" />
            </radialGradient>

            {/* Precision 3D Drop Shadow */}
            <filter id="bracket-shadow" x="100" y="120" width="312" height="272" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#000000" floodOpacity="0.65" />
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.45" />
            </filter>

            {/* Specular Glow Filter */}
            <filter id="specular-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FFFFFF" floodOpacity="0.9" />
            </filter>

            {/* Chamfer Mask Clips for Specular Light Sweep */}
            <clipPath id="cx-upper-clip">
              <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" />
            </clipPath>
            <clipPath id="cx-lower-clip">
              <path d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z" />
            </clipPath>

            {/* 45° Light Sweep Gradient */}
            <linearGradient id="cx-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <mask id="cx-sweep-mask">
              <rect className="cx-sweep-rect" x="-340" y="0" width="280" height="512" fill="url(#cx-sweep)" />
            </mask>
          </defs>

          {/* Central Radial Light Core */}
          <circle className="cx-core-glow" cx="256" cy="256" r="45" fill="url(#diamond-glow)" />

          {/* Rotating Refresh Orbit Group */}
          <g className="cx-refresh-orbit">
            {/* Upper Kinetic Titanium Bracket */}
            <g className="cx-bracket cx-upper" filter="url(#bracket-shadow)">
              <path
                d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z"
                fill="url(#titanium-upper)"
              />
              <g clipPath="url(#cx-upper-clip)" mask="url(#cx-sweep-mask)">
                <rect x="100" y="120" width="312" height="272" fill="#ffffff" opacity="0.45" />
              </g>
            </g>

            {/* Lower Kinetic Titanium Bracket */}
            <g className="cx-bracket cx-lower" filter="url(#bracket-shadow)">
              <path
                d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z"
                fill="url(#titanium-lower)"
              />
              <g clipPath="url(#cx-lower-clip)" mask="url(#cx-sweep-mask)">
                <rect x="100" y="120" width="312" height="272" fill="#ffffff" opacity="0.45" />
              </g>
            </g>

            {/* Specular Highlight Edge Bars */}
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

            {/* Floating Central Diamond */}
            <polygon
              className="cx-diamond"
              points="256,236 276,256 256,276 236,256"
              fill="#FFFFFF"
              filter="url(#specular-glow)"
            />
          </g>
        </svg>
      </div>
    </>
  );
};

const refreshCss = `
  .cx-refresh-container {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }

  /* 2-Second Repeating Refresh Orbit (Executes 2 full 360° spins per 2s cycle) */
  .cx-refresh-container.is-refreshing .cx-refresh-orbit {
    transform-origin: 256px 256px;
    animation: cx-refresh-spin 2s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
  }

  /* Rhythmic clamp contraction: 2 contractions in 2 seconds */
  .cx-refresh-container.is-refreshing .cx-upper {
    animation: cx-refresh-upper 2s ease-in-out infinite;
  }

  .cx-refresh-container.is-refreshing .cx-lower {
    animation: cx-refresh-lower 2s ease-in-out infinite;
  }

  /* Diamond core pulse synchronized with the 2-second loop */
  .cx-refresh-container.is-refreshing .cx-diamond {
    transform-origin: 256px 256px;
    animation: cx-refresh-diamond 2s ease-in-out infinite;
  }

  /* Ambient cavity glow breathing */
  .cx-refresh-container.is-refreshing .cx-core-glow {
    animation: cx-refresh-glow 2s ease-in-out infinite;
  }

  /* Light sweep across titanium chamfers (cycles twice every 2s) */
  .cx-refresh-container.is-refreshing .cx-sweep-rect {
    animation: cx-refresh-sweep 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Edge specular flash */
  .cx-refresh-container.is-refreshing .cx-spec {
    animation: cx-refresh-flash 1s ease-in-out infinite alternate;
  }

  /* Keyframe Animations */
  @keyframes cx-refresh-spin {
    0% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(360deg);
    }
    100% {
      transform: rotate(720deg); /* 2 full rotations in 2 seconds */
    }
  }

  @keyframes cx-refresh-upper {
    0%, 100% {
      transform: translate(0, 0);
    }
    25%, 75% {
      transform: translate(-10px, -6px); /* Elastic pull apart */
    }
    50% {
      transform: translate(0, 0); /* Tight snap clamp */
    }
  }

  @keyframes cx-refresh-lower {
    0%, 100% {
      transform: translate(0, 0);
    }
    25%, 75% {
      transform: translate(10px, 6px); /* Elastic counter-pull */
    }
    50% {
      transform: translate(0, 0); /* Tight snap clamp */
    }
  }

  @keyframes cx-refresh-diamond {
    0%, 50%, 100% {
      transform: scale(1);
      opacity: 0.95;
    }
    25%, 75% {
      transform: scale(1.22);
      opacity: 1;
    }
  }

  @keyframes cx-refresh-glow {
    0%, 50%, 100% {
      opacity: 0.55;
      transform: scale(0.95);
    }
    25%, 75% {
      opacity: 1;
      transform: scale(1.15);
    }
  }

  @keyframes cx-refresh-sweep {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(780px);
    }
  }

  @keyframes cx-refresh-flash {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cx-refresh-orbit, .cx-upper, .cx-lower, .cx-diamond, .cx-core-glow, .cx-sweep-rect, .cx-spec {
      animation: none !important;
    }
  }
`;

export default CeoExchangeEmblemAnimated;
