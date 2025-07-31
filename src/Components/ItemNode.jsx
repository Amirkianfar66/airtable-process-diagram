// src/components/ItemNode.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ItemNode({ data }) {
  return (
    <div style={{ padding: 10, border: '1px solid #999', borderRadius: 5, background: 'white' }}>
      <strong>{data.label}</strong>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
