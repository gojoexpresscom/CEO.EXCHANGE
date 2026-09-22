import React, { useEffect, useState } from 'react';

export const CeoExchangeEmblemAnimated: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 120, className = '' }) => {
  // 0 = first play, 1 = second play (at 2s), then stops
  const [playCount, setPlayCount] = useState(0);

  useEffect(() => {
    if (playCount >= 1) return; // stop after 2 plays
    const t = setTimeout(() => setPlayCount(c => c + 1), 2000);
    return () => clearTimeout(t);
  }, [playCount]);

  return (
    <>
      <style>{css}</style>
      {/* key={playCount} remounts the SVG so the entrance restarts */}
      <svg
        key={playCount}
        className={`cx-animated ${className}`}
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ...same defs (gradients, filters, clipPaths, mask) as before... */}

        <circle className="cx-core-glow" cx="256" cy="256" r="45" fill="url(#diamond-glow)" />

        <g className="cx-float">
          <g className="cx-bracket cx-upper" filter="url(#bracket-shadow)">
            <path d="M 179 166 L 272 166 L 354 248 L 323 279 L 276 233 L 212 233 L 212 205 L 143 205 Z" fill="url(#titanium-upper)" />
            <g clipPath="url(#cx-upper-clip)" mask="url(#cx-sweep-mask)">
              <rect x="100" y="120" width="312" height="272" fill="#ffffff" opacity="0.35" />
            </g>
          </g>
          <g className="cx-bracket cx-lower" filter="url(#bracket-shadow)">
            <path d="M 333 346 L 240 346 L 158 264 L 189 233 L 236 279 L 300 279 L 300 307 L 369 307 Z" fill="url(#titanium-lower)" />
            <g clipPath="url(#cx-lower-clip)" mask="url(#cx-sweep-mask)">
              <rect x="100" y="120" width="312" height="272" fill="#ffffff" opacity="0.35" />
            </g>
          </g>

          <line className="cx-spec cx-spec-a" x1="181" y1="166" x2="270" y2="166" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" filter="url(#specular-glow)" />
          <line className="cx-spec cx-spec-b" x1="242" y1="346" x2="331" y2="346" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" filter="url(#specular-glow)" />

          <polygon className="cx-diamond" points="256,236 276,256 256,276 236,256" fill="#FFFFFF" filter="url(#specular-glow)" />
        </g>
      </svg>
    </>
  );
};

const css = `
  /* same keyframes as before — nothing else changes */
  .cx-float { animation: cx-enter-float 1s cubic-bezier(.22,.9,.3,1) both,
                          cx-idle-float 7s 1.6s ease-in-out infinite alternate; }
  .cx-core-glow { animation: cx-enter 1.2s ease-out both,
                              cx-core-pulse 3.2s ease-in-out infinite; }
  .cx-upper { animation: cx-enter-upper .9s .35s cubic-bezier(.16,.8,.24,1) both; }
  .cx-lower { animation: cx-enter-lower .9s .5s cubic-bezier(.16,.8,.24,1) both; }
  .cx-diamond { transform-box: fill-box; transform-origin: center;
                animation: cx-enter-diamond .7s 1s cubic-bezier(.34,1.6,.4,1) both,
                           cx-diamond-pulse 3.2s ease-in-out infinite; }
  .cx-spec { stroke-dasharray: 110; stroke-dashoffset: 110;
             animation: cx-draw .6s ease-out forwards, cx-spec-flash 4.5s ease-in-out infinite; }
  .cx-spec-a { animation-delay: 1.25s, 2.4s; }
  .cx-spec-b { animation-delay: 1.4s, 2.9s; }
  .cx-sweep-rect { animation: cx-sweep 5.5s 2s cubic-bezier(.45,0,.25,1) infinite; }

  @keyframes cx-enter-float { from { opacity: 0; transform: translateY(26px) scale(.96); } to { opacity: 1; } }
  @keyframes cx-enter { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cx-enter-upper { from { opacity: 0; transform: translate(-46px,-18px); } to { opacity: 1; transform: none; } }
  @keyframes cx-enter-lower { from { opacity: 0; transform: translate(46px,18px); } to { opacity: 1; transform: none; } }
  @keyframes cx-enter-diamond { from { opacity: 0; transform: scale(0) rotate(45deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
  @keyframes cx-draw { to { stroke-dashoffset: 0; } }
  @keyframes cx-idle-float { from { transform: translateY(0); } to { transform: translateY(-9px); } }
  @keyframes cx-core-pulse { 0%,100% { opacity: .75; } 50% { opacity: 1; } }
  @keyframes cx-diamond-pulse { 0%,100% { transform: scale(1); opacity: .92; } 50% { transform: scale(1.09); opacity: 1; } }
  @keyframes cx-spec-flash { 0%,78%,100% { opacity: .55; } 86% { opacity: 1; } }
  @keyframes cx-sweep { 0% { transform: translateX(0); } 42%,100% { transform: translateX(760px); } }

  @media (prefers-reduced-motion: reduce) {
    .cx-float, .cx-core-glow, .cx-upper, .cx-lower, .cx-diamond, .cx-spec, .cx-sweep-rect { animation: none; }
    .cx-spec { stroke-dashoffset: 0; }
  }
`;

export default CeoExchangeEmblemAnimated;

