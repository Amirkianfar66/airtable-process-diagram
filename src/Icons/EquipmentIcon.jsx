import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ scaleX = 1, scaleY = 1 }) {
    const [hovered, setHovered] = useState(false);

    const width = 100 * scaleX;
    const height = 100 * scaleY;

    const rectTopMid = 50 * scaleY;
    const rectLeft = 20 * scaleX;
    const rectRight = 80 * scaleX;

    const handleSize = 16; // Fixed handle size in px

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width,
                height,
                backgroundColor: '#eee',
                boxShadow: hovered ? '0 0 10px rgba(0,0,0,0.3)' : 'none',
                overflow: 'visible',
            }}
        >
            {/* Scaled SVG */}
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

            {/* Fixed-size handles */}
            <div
                style={{
                    position: 'absolute',
                    top: rectTopMid - handleSize / 2,
                    left: rectLeft - handleSize / 2,
                    width: handleSize,
                    height: handleSize,
                    pointerEvents: 'none',
                }}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    id="left"
                    style={{
                        width: handleSize,
                        height: handleSize,
                        background: 'red',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 0 4px black',
                        opacity: hovered ? 1 : 0.6,
                        pointerEvents: 'all',
                    }}
                />
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: rectTopMid - handleSize / 2,
                    left: rectRight - handleSize / 2,
                    width: handleSize,
                    height: handleSize,
                    pointerEvents: 'none',
                }}
            >
                <Handle
                    type="source"
                    position={Position.Right}
                    id="right"
                    style={{
                        width: handleSize,
                        height: handleSize,
                        background: 'blue',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 0 4px black',
                        opacity: hovered ? 1 : 0.6,
                        pointerEvents: 'all',
                    }}
                />
            </div>
        </div>
    );
}
