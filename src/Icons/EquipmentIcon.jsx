import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function ScalableIconNode({ id, data = {} }) {
    const [hovered, setHovered] = useState(false);

    const {
        scaleX = 1,
        scaleY = 1,
        fillColor = 'green',
        strokeColor = 'black',
        strokeWidth = 2,
    } = data;

    const width = 60 * scaleX;
    const height = 60 * scaleY;
    const x = 20 * scaleX;
    const y = 20 * scaleY;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ position: 'relative', width: 100, height: 100 }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                style={{ display: 'block' }}
            >
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={hovered ? strokeWidth + 1 : strokeWidth}
                />
                <text x="50" y="55" fontSize="14" textAnchor="middle" fill="white">
                    {id}
                </text>
            </svg>

            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{ background: '#555', width: 8, height: 8, right: -4, top: '50%' }}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{ background: '#555', width: 8, height: 8, left: -4, top: '50%' }}
            />
        </div>
    );
}
