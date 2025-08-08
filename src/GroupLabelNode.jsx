// GroupNode.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';

export default function GroupNode({ data, selected }) {
    return (
        <div
            style={{
                width: data.width || 300,
                height: data.height || 200,
                border: '2px dashed #00bcd4',
                borderRadius: 8,
                position: 'relative',
                backgroundColor: 'transparent',
                pointerEvents: 'none',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: '#00bcd4',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {data.label}
            </div>
        </div>
    );
}
