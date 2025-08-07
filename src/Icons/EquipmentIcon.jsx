import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ scaleX = 1, scaleY = 1 }) {
    const [hovered, setHovered] = useState(false);

    const rectLeft = 20 * scaleX;
    const rectRight = (20 + 60) * scaleX;
    const rectTopMid = 20 * scaleY + (60 * scaleY) / 2;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: 100 * scaleX,
                height: 100 * scaleY,
                backgroundColor: '#eee',
                border: '1px solid #ccc',
                transition: 'box-shadow 0.2s',
                boxShadow: hovered ? '0 0 10px rgba(0,0,0,0.3)' : 'none',
            }}
        >
            {/* Scaled SVG */}
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: 100,
                    height: 100,
                }}
            >
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                    <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                        EQ
                    </text>
                </svg>
            </div>

            {/* Conditionally visible Handles */}
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
                    zIndex: 9999,
                    border: '2px solid white',
                    boxShadow: '0 0 4px black',
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 0.2s',
                    pointerEvents: hovered ? 'all' : 'none',
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
                    zIndex: 9999,
                    border: '2px solid white',
                    boxShadow: '0 0 4px black',
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 0.2s',
                    pointerEvents: hovered ? 'all' : 'none',
                }}
            />
        </div>
    );
}
