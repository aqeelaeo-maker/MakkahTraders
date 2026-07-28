import React from 'react';

interface FbrLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function FbrLogo({ className = "w-36 h-36", style }: FbrLogoProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 500 500" 
      className={className}
      style={style}
    >
      {/* Green Arc */}
      <path d="M 55 120 Q 250 40 445 120 Q 250 62 55 120 Z" fill="#0f8b3d" />
      
      {/* Yellow Star at Apex */}
      <g transform="translate(250, 78)">
        <polygon points="0,-36 5,0 0,36 -5,0" fill="#ffd700" />
        <polygon points="-28,0 0,4 28,0 0,-4" fill="#ffd700" />
        <polygon points="-14,-14 0,2 14,14 2,0" fill="#ffd700" />
        <polygon points="14,-14 -2,0 -14,14 0,-2" fill="#ffd700" />
        <circle cx="0" cy="0" r="3" fill="#ffffff" />
      </g>

      {/* FBR Text */}
      <text x="250" y="175" fontFamily="'Arial Black', 'Impact', sans-serif" fontWeight="900" fontSize="86" fill="#004fa3" textAnchor="middle" letterSpacing="-2">FBR</text>

      {/* Blue Rounded Box */}
      <rect x="20" y="195" width="460" height="245" rx="28" ry="28" fill="#004fa3" />

      {/* DIGITAL Text */}
      <text x="250" y="365" fontFamily="'Impact', 'Arial Black', sans-serif" fontWeight="900" fontSize="132" fill="#ffffff" textAnchor="middle" letterSpacing="2">DIGITAL</text>

      {/* INVOICING SYSTEM Text */}
      <text x="250" y="420" fontFamily="'Arial Black', 'Arial', sans-serif" fontWeight="800" fontSize="33" fill="#ffffff" textAnchor="middle" letterSpacing="3.5">INVOICING SYSTEM</text>
    </svg>
  );
}
