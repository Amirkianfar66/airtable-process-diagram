import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function InlineValveIcon({ data }) {
    const [hovered, setHovered] = useState(false);
    const label = data?.label || '';

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: 60,
                height: 110, // extra for label
                background: 'none',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            {/* SVG Bowtie Valve */}
            <svg width="60" height="90" viewBox="0 0 200 200">
                <polygon
                    points="60,80 100,100 60,120"
                    fill="orange"
                    stroke="Black"
                    strokeWidth="1"
                />
                <polygon
                    points="140,80 100,100 140,120"
                    fill="orange"
                    stroke="Black"
                    strokeWidth="1"
                />
                <text
                    x="100"
                    y="108"
                    fontSize="16"
                    textAnchor="middle"
                    fill="Black"
                    fontFamily="sans-serif"
                >
                    IV
                </text>
            </svg>

            {/* Label below the SVG */}
            <div style={{ position: 'relative', width: 60, height: 90 }}>
                <svg width="60" height="90" viewBox="0 0 200 200">...</svg>
                <div
                    style={{
                        position: 'absolute',
                        bottom: 2,
                        left: 0,
                        width: '100%',
                        fontSize: 13,
                        textAlign: 'center',
                        color: '#333',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        paddingLeft: 5,
                    }}
                >
                    {label.substring(0, 5)}
                </div>
            </div>


            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    top: 45,
                    left: -6,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'red',
                    border: '1px solid white',
                    opacity: hovered ? 1 : 0.4,
                    position: 'absolute',
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    top: 45,
                    right: -6,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'blue',
                    border: '1px solid white',
                    opacity: hovered ? 1 : 0.4,
                    position: 'absolute',
                }}
            />
        </div>
    );
}
