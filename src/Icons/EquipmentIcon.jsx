import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ scaleX = 1, scaleY = 1 }) {
    const [hovered, setHovered] = useState(false);

    const width = 100 * scaleX;
    const height = 100 * scaleY;

    const rectTopMid = 50 * scaleY; // Mid Y of the rect
    const rectLeft = 20 * scaleX;
    const rectRight = 80 * scaleX;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}

        >
            {/* SVG is scaled */}
            <svg
                width={width}
                height={height}
                viewBox="0 0 100 100"
                fill="none"

            >
                <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                    EQ
                </text>
            </svg>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"

            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"

            />
        </div>
    );
}
