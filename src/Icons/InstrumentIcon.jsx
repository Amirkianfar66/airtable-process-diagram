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
                height: 120, // extra space for label or handle
                background: 'none',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <svg width="60" height="60" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="30" fill="Yellow" />
                <text x="100" y="110" fontSize="10" textAnchor="middle" fill="Black">
                    IN
                </text>
            </svg>

            {/* Handle at the bottom center */}
            <Handle
                type="target"
                position={Position.Bottom}
                style={{
                    left: '50%',
                    top: 5,
                    background: 'green',
                    border: '1px solid white',
                    borderRadius: '50%',
                    width: 10,
                    height: 10,
                    transform: 'translateX(-50%)',
                    opacity: hovered ? 1 : 0.3,
                }}
                id="bottom"
            />
        </div>
    );
}
