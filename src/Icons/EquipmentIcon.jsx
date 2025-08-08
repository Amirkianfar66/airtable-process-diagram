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
            style={{
                position: 'relative',
                width,
                height,
                backgroundColor: '#eee',
                border: '1px solid #ccc',
                transition: 'box-shadow 0.2s',
                boxShadow: hovered ? '0 0 10px rgba(0,0,0,0.3)' : 'none',
                overflow: 'visible',
            }}
        >
            {/* SVG is scaled */}
            <svg
                width={width}
                height={height}
                viewBox="0 0 100 100"
                fill="none"
                style={{ display: 'block' }}
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
                style={{
                    position: 'absolute',
                    top: rectTopMid,
                    left: rectLeft,
                    transform: 'translate(-50%, -50%)',
                    width: 16,
                    height: 16,
                    background: 'red',
                    borderRadius: '50%',
                    zIndex: 10,
                    border: '2px solid white',
                    boxShadow: '0 0 4px black',
                    opacity: hovered ? 1 : 0.6,
                    pointerEvents: 'all',
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    position: 'absolute',
                    top: rectTopMid,
                    left: rectRight,
                    transform: 'translate(-50%, -50%)',
                    width: 16,
                    height: 16,
                    background: 'blue',
                    borderRadius: '50%',
                    zIndex: 10,
                    border: '2px solid white',
                    boxShadow: '0 0 4px black',
                    opacity: hovered ? 1 : 0.6,
                    pointerEvents: 'all',
                }}
            />
        </div>
    );
}
