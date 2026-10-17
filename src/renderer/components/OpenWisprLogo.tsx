import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export const OpenWisprLogo: React.FC<LogoProps> = ({ size = 24, className = '', animate = false }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className} ${animate ? 'animate-pulse' : ''}`}
    >
      <defs>
        <linearGradient id="ow-grad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C1D21" />
          <stop offset="100%" stopColor="#0E0F12" />
        </linearGradient>
        <linearGradient id="ow-grad-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="ow-grad-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Squircle Base Container */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#ow-grad-bg)" stroke="#27272A" strokeWidth="1.5" />

      {/* Outer Concentric Dynamic Sound Wave Ring */}
      <circle cx="32" cy="32" r="22" stroke="url(#ow-grad-ring)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />

      {/* Stylized Open Voice Capsule / Microphone Shape */}
      <rect x="26" y="16" width="12" height="20" rx="6" fill="url(#ow-grad-accent)" />

      {/* Audio Waveform Pickup Arc */}
      <path d="M21 28 C21 37.5, 43 37.5, 43 28" stroke="#FDE68A" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Base Stand and Audio Pulse Node */}
      <line x1="32" y1="38" x2="32" y2="46" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="46" r="2.5" fill="#FDE68A" />

      {/* Harmonic Audio Pulse Dots */}
      <circle cx="16" cy="32" r="1.5" fill="#F59E0B" opacity="0.8" />
      <circle cx="48" cy="32" r="1.5" fill="#F59E0B" opacity="0.8" />
    </svg>
  );
};
