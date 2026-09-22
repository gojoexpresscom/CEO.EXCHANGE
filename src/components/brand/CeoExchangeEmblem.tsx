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
      {/* Paste the complete SVG contents from your Google AI Studio code here */}
    </svg>
  );
};

export default CeoExchangeEmblem;
