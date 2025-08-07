// ScalableIconNode.jsx
import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);

    return (
        <div
            style={{
                width: 200,
                height: 200,
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Render the passed icon */}
            {data.icon}

            {/* Right handle on SVG rect border */}
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: 'calc(20% + 60%)',
                    transform: 'translateY(-50%)',
                }}
                id="right"
            />

            {/* Left handle on SVG rect border */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '20%',
                    transform: 'translateY(-50%)',
                }}
                id="left"
            />
        </div>
    );
}
