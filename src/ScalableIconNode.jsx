""// ScalableIconNode.jsx
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

            {/* Right handle aligned to rect border (x = 80 in 100 viewBox) */}
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '160px', // 20px (margin) + 60px (width of rect) + 80px total offset
                    transform: 'translateY(-50%)',
                }}
                id="right"
            />

            {/* Left handle aligned to rect border (x = 20 in 100 viewBox) */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '40px', // x = 20 out of 100, mapped to 40px in 200px container
                    transform: 'translateY(-50%)',
                }}
                id="left"
            />
        </div>
    );
}