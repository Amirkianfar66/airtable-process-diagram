import React from 'react';
import { Handle, Position } from 'reactflow';

export default function GroupLabelNode({ data }) {
    const {
        width = 200,   // default width if not provided
        height = 100,  // default height if not provided
        label,
    } = data;

    return (
        <div
            style={{
                border: '2px dashed #00bcd4',
                borderRadius: 6,
                background: 'rgba(0, 188, 212, 0.05)',
                width: `${width}px`,
                height: `${height}px`,
                position: 'relative',
                zIndex: 9999,          // keep on top
                boxSizing: 'border-box',
                padding: '8px 12px 12px 12px', // padding inside the group rect
                userSelect: 'none',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: -24,
                    left: 4,
                    background: '#00bcd4',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 'bold',
                    fontSize: 12,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </div>

            {/* Optional handles (hidden here) */}
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </div>
    );
}
