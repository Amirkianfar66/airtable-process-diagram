// InlineValveIcon.jsx
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function InlineValveIcon({ data }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: 100,
                height: 100,
                background: 'none',
                border: 'none',
                borderRadius: 8,
            }}
        >
            <svg width="200" height="200" viewBox="0 0 200 200">
                {/* Bow-tie shape */}
                <polygon
                    points="60,60 100,100 60,140"
                    fill="none"
                    stroke="orange"
                    strokeWidth="4"
                />
                <polygon
                    points="140,60 100,100 140,140"
                    fill="none"
                    stroke="orange"
                    strokeWidth="4"
                />
                {/* Central disc (optional) */}
                <circle cx="100" cy="100" r="20" fill="orange" stroke="darkorange" strokeWidth="2" />
                <text x="100" y="108" fontSize="16" textAnchor="middle" fill="white">
                    IV
                </text>
            </svg>

            <Handle
                type="target"
                position={Position.Left}
                style={{
                    top: '50%',
                    background: 'red',
                    border: '1px solid white',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateY(-50%)',
                    opacity: hovered ? 1 : 0.01,
                }}
                id="left"
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: '50%',
                    background: 'blue',
                    border: '1px solid white',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateY(-50%)',
                    opacity: hovered ? 1 : 0.01,
                }}
                id="right"
            />
        </div>
    );
}
