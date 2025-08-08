// InstrumentIcon.jsx
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function InstrumentIcon({ data }) {
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
                {/* Circular instrument body */}
                <circle cx="100" cy="100" r="50" fill="purple" />
                <text x="100" y="110" fontSize="20" textAnchor="middle" fill="white">
                    IN
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
