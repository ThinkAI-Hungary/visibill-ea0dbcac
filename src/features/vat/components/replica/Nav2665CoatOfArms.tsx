import React from 'react';

interface Nav2665CoatOfArmsProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Authentic vector Coat of Arms of Hungary (Magyarország Címere)
 * for the official NAV ÁNYK tax return form header.
 */
export function Nav2665CoatOfArms({ className, width = 36, height = 48 }: Nav2665CoatOfArmsProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 135"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Magyarország címere"
    >
      {/* Holy Crown at top */}
      <g stroke="#1a1a1a" strokeWidth="2.5" fill="#fefefe">
        {/* Slanted cross on top */}
        <line x1="50" y1="4" x2="50" y2="15" strokeWidth="3" />
        <line x1="44" y1="9" x2="56" y2="9" strokeWidth="3" transform="rotate(-15 50 9)" />
        {/* Crown arches & band */}
        <path d="M 28 26 C 30 16, 45 15, 50 15 C 55 15, 70 16, 72 26 Z" />
        <path d="M 32 26 Q 50 20 68 26" strokeWidth="2" />
        {/* Pearls / Jewels on arches */}
        <circle cx="36" cy="20" r="2" fill="#1a1a1a" />
        <circle cx="50" cy="17" r="2.5" fill="#1a1a1a" />
        <circle cx="64" cy="20" r="2" fill="#1a1a1a" />
        {/* Crown band */}
        <rect x="24" y="26" width="52" height="7" rx="1.5" />
        <circle cx="30" cy="29.5" r="1.5" fill="#1a1a1a" />
        <circle cx="40" cy="29.5" r="1.5" fill="#1a1a1a" />
        <circle cx="50" cy="29.5" r="1.5" fill="#1a1a1a" />
        <circle cx="60" cy="29.5" r="1.5" fill="#1a1a1a" />
        <circle cx="70" cy="29.5" r="1.5" fill="#1a1a1a" />
      </g>

      {/* Main Shield */}
      <g stroke="#1a1a1a" strokeWidth="2.5" fill="#ffffff">
        <path d="M 20 33 L 80 33 L 80 82 C 80 110, 50 128, 50 128 C 50 128, 20 110, 20 82 Z" />
        {/* Shield vertical dividing line */}
        <line x1="50" y1="33" x2="50" y2="128" />
      </g>

      {/* Left side (Árpád stripes): 4 red, 4 silver stripes */}
      <g stroke="#1a1a1a" strokeWidth="2">
        <line x1="20" y1="45" x2="50" y2="45" />
        <line x1="20" y1="57" x2="50" y2="57" />
        <line x1="20" y1="69" x2="50" y2="69" />
        <line x1="20" y1="81" x2="50" y2="81" />
        {/* Striping hatches for print effect */}
        <rect x="20.5" y="45.5" width="29" height="11" fill="#e5e5e5" />
        <rect x="20.5" y="69.5" width="29" height="11" fill="#e5e5e5" />
      </g>

      {/* Right side: Triple green mount, small crown, double silver cross */}
      <g stroke="#1a1a1a" strokeWidth="2">
        {/* Triple mount */}
        <path d="M 50 106 Q 58 96 65 106 Q 73 96 80 106" fill="#e5e5e5" />
        <path d="M 58 102 Q 65 88 72 102" fill="#d4d4d4" />
        {/* Small coronet */}
        <path d="M 60 90 L 70 90 L 71 86 L 67 88 L 65 85 L 63 88 L 59 86 Z" fill="#ffffff" />
        {/* Patriarchal Cross (Double Cross) */}
        <line x1="65" y1="50" x2="65" y2="86" strokeWidth="2.5" />
        <line x1="59" y1="60" x2="71" y2="60" strokeWidth="2.5" />
        <line x1="56" y1="68" x2="74" y2="68" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
