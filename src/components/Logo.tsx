import React from 'react';

/** Marca do ContratoPro: a linha de hoje e o prazo restante de três contratos. */
export const Logo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect width="32" height="32" rx="7" fill="#1F5FD6" />
    <path d="M10 7v18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <rect x="10" y="9" width="13" height="3.5" rx="1" fill="#fff" />
    <rect x="10" y="14.25" width="6" height="3.5" rx="1" fill="#fff" />
    <rect x="10" y="19.5" width="10" height="3.5" rx="1" fill="#fff" />
  </svg>
);
