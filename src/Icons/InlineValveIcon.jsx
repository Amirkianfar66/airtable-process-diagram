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
                height: 110, // container height
                background: 'none',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            {/* Wrap SVG and label in relative container */}
            <div style={{ position: 'relative', width: 60, height: 90 }}>
                <svg width="60" height="90" viewBox="0 0 200 200">
                    <polygon points="60,80 100,100 60,120" fill="orange" stroke="Black" strokeWidth="1" />
                    <polygon points="140,80 100,100 140,120" fill="orange" stroke="Black" strokeWidth="1" />
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

                {/* Label absolutely positioned at the bottom of SVG container */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 50, // adjust this value to move label up/down
                        left: 0,
                        width: '100%',
                        fontSize: 13,
                        color: '#333',
                        textAlign: 'Left',
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
                    left: -1,
                    width: 2,
                    height: 2,
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
                    right: -1,
                    width: 2,
                    height: 2,
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
