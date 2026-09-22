import React from 'react';

export const CeoExchangeEmblem: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 120, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="titanium-upper"
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
          id="titanium-lower"
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
          id="diamond-glow"
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
          id="bracket-shadow"
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
          id="specular-glow"
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
      </defs>

      <circle
        cx="256"
        cy="256"
        r="45"
        fill="url(#diamond-glow)"
      />

      <g filter="url(#bracket-shadow)">
        <path
          d="
            M 179 166
            L 272 166
            L 354 248
            L 323 279
            L 276 233
            L 212 233
            L 212 205
            L 143 205
            Z
          "
          fill="url(#titanium-upper)"
        />

        <path
          d="
            M 333 346
            L 240 346
            L 158 264
            L 189 233
            L 236 279
            L 300 279
            L 300 307
            L 369 307
            Z
          "
          fill="url(#titanium-lower)"
        />
      </g>

      <line
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
        points="256,236 276,256 256,276 236,256"
        fill="#FFFFFF"
        filter="url(#specular-glow)"
      />
    </svg>
  );
};

export default CeoExchangeEmblem;

