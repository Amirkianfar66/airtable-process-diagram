import React from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon() {
    return (
        <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">EQ</text>
            </svg>

            {/* Left handle */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: 20,         // same as rect x
                    transform: 'translate(-50%, -50%)',
                    background: 'red', // just for visibility, optional
                }}
            />

            {/* Right handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: 80,         // rect x (20) + width (60)
                    transform: 'translate(-50%, -50%)',
                    background: 'blue', // just for visibility, optional
                }}
            />
        </div>
    );
}
