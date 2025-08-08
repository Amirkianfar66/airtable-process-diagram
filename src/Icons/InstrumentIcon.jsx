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
                <circle cx="100" cy="100" r="10" fill="Yellow" />
                <text x="100" y="110" fontSize="7" textAnchor="middle" fill="Black">
                    IN
                </text>
            </svg>

            {/* Single Handle node */}
            <Handle
                type="target"
                position={Position.Bottom}
                style={{
                    Left: '90%',
                    background: 'green',
                    border: '1px solid white',
                    borderRadius: '50%',
                    width: 5,
                    height: 5,
                    transform: 'translateX(-50%)',
                    opacity: hovered ? 1 : 0.3,
                }}
                id="bottom"
            />
        </div>
    );
}
