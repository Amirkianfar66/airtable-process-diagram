// GroupLabelNode.jsx
import React from 'react';

export default function GroupLabelNode({ data }) {
  return (
    <div
      style={{
        padding: '4px 8px',
        background: '#00bcd4',
        color: 'white',
        borderRadius: 4,
        fontWeight: 'bold',
        fontSize: 12,
        pointerEvents: 'none', // so you can click through label
        userSelect: 'none',
      }}
    >
      {data.label}
    </div>
  );
}
