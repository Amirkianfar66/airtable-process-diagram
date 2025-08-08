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
                width: 60,
                height: 100,
                background: 'none',
                border: 'none',
                borderRadius: 8,
            }}
        >
            <svg width="100" height="100" viewBox="0 0 200 200">
                {/* Bow-tie shape with half-height wings */}
                <polygon
                    points="60,80 100,100 60,120"
                    fill="none"
                    stroke="orange"
                    strokeWidth="4"
                />
                <polygon
                    points="140,80 100,100 140,120"
                    fill="none"
                    stroke="orange"
                    strokeWidth="4"
                />

                {/* Label stays centered */}
                <text
                    x="100"
                    y="108"
                    fontSize="16"
                    textAnchor="middle"
                    fill="white"
                    fontFamily="sans-serif"
                >
                    IV
                </text>
            </svg>

            {/* React Flow handles on hover */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    top: '50%',
                    left: 0,
                    transform: 'translate(-50%, -50%)',
                    background: 'red',
                    border: '1px solid white',
                    borderRadius: '50%',
                    width: 5,
                    height: 5,
                    opacity: hovered ? 1 : 0.5,
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    top: '50%',
                    right: 0,
                    transform: 'translate(50%, -50%)',
                    background: 'blue',
                    border: '1px solid white',
                    borderRadius: '50%',
                    width: 5,
                    height: 5,
                    opacity: hovered ? 1 : 0.5,
                }}
            />
        </div>
    );
}
