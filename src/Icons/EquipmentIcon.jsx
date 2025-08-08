import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ scaleX = 1, scaleY = 1 }) {
    const [hovered, setHovered] = useState(false);

    const width = 100 * scaleX;
    const height = 100 * scaleY;

    // Position of the center of the rect (for handle alignment)
    const rectTopMid = 20 + 30; // rect y = 20, height = 60 -> mid = 50
    const rectLeft = 20;        // x = 20
    const rectRight = 80;       // x + width = 20 + 60

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
            }}
        >
            {/* SVG is scaled */}
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: 100,
                    height: 100,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
            >
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                    <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                        EQ
                    </text>
                </svg>
            </div>

            {/* Handles are positioned relative to parent, no scaling needed */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    position: 'absolute',
                    top: rectTopMid * scaleY,
                    left: rectLeft * scaleX,
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
                    top: rectTopMid * scaleY,
                    left: rectRight * scaleX,
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
