// src/Icons/InlineValveIcon.jsx
import React from 'react';

export default function InlineValveIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
      {/* Left Triangle */}
      <polygon points="10,50 50,20 50,80" fill="black" stroke="gray" strokeWidth="3" />
      {/* Right Triangle */}
      <polygon points="90,50 50,20 50,80" fill="black" stroke="gray" strokeWidth="3" />
      <text x="50" y="95" fontSize="14" textAnchor="middle" fill="black">Valve</text>
    </svg>
  );
}
