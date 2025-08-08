import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ data }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: 100,
                height: 100,
                background: '#eee',
                border: '1px solid #aaa',
                borderRadius: 8,
            }}
        >
            <svg width="100" height="100" viewBox="0 0 100 100">
                <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">EQ</text>
            </svg>

            <Handle
                type="target"
                position={Position.Left}
                style={{
                    top: '50%',
                    background: 'red',
                    border: '2px solid white',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateY(-50%)',
                    opacity: hovered ? 1 : 0.5,
                }}
                id="left"
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: '50%',
                    background: 'blue',
                    border: '2px solid white',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateY(-50%)',
                    opacity: hovered ? 1 : 0.5,
                }}
                id="right"
            />
        </div>
    );
}
