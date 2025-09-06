import React from 'react';

export default function PipeIcon({ width = 100, height = 50 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
      {/* Main pipe shape */}
      <rect x="0" y="15" width="100" height="20" fill="blue" stroke="black" strokeWidth="2" />
      {/* Pipe label */}
      <text x="50" y="30" fontSize="12" textAnchor="middle" fill="white">Pipe</text>
    </svg>
  );
}
