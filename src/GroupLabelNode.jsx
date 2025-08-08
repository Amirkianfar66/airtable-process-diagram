// GroupLabelNode.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';

export default function GroupLabelNode({ data }) {
    const { width, height, label } = data;

    return (
        <div
            style={{
                border: '2px dashed #00bcd4',
                borderRadius: 6,
                background: 'rgba(0, 188, 212, 0.05)',
                width,
                height,
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: -20,
                    left: 0,
                    background: '#00bcd4',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 'bold',
                    fontSize: 12,
                    userSelect: 'none',
                }}
            >
                {label}
            </div>

            {/* Optional handles if you want connections to group */}
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </div>
    );
}
