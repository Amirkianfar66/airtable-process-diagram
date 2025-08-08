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
                {/* Infinity/butterfly-valve body */}
                <path
                    d="
            M 40,100
            C 40,60  90,60  90,100
            C 90,140 40,140 40,100
            Z
            M 160,100
            C 160,60  110,60 110,100
            C 110,140 160,140 160,100
            Z
          "
                    fill="orange"
                    stroke="darkorange"
                    strokeWidth="4"
                />
                {/* Central disc intersection */}
                <circle cx="100" cy="100" r="20" fill="darkorange" />
                <text x="100" y="105" fontSize="16" textAnchor="middle" fill="white">
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
