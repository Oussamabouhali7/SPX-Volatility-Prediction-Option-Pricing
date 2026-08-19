// components/PwCLogo.jsx — Logo image PwC
import React from 'react';

export default function PwCLogo({ size = 36 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <img
        src="/pwc_logo.png"
        alt="PwC Volatility AI Lab"
        style={{ height: size, width: 'auto', objectFit: 'contain' }}
      />
    </div>
  );
}