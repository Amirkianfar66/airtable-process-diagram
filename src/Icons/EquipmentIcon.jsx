import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(true);
    const nodeRef = useRef(null);

    const baseSize = 100;
    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;

    const width = baseSize * scaleX;
    const height = baseSize * scaleY;

    const iconSize = 60;
    const iconX = (baseSize - iconSize) / 2;
    const iconY = (baseSize - iconSize) / 2;

    useEffect(() => {
        setVisible(true);
    }, [scaleX, scaleY]);

    return (
        <div
            ref={nodeRef}
            style={{
                width,
                height,
                position: 'relative',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${baseSize} ${baseSize}`}
                style={{ display: visible ? 'block' : 'none' }}
            >
                <rect
                    x={iconX}
                    y={iconY}
                    width={iconSize}
                    height={iconSize}
                    fill="green"
                />
                <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                    {id}
                </text>
            </svg>

            <Handle type="source" position={Position.Right} style={{ background: 'blue', width: 8, height: 8 }} />
            <Handle type="target" position={Position.Left} style={{ background: 'red', width: 8, height: 8 }} />
        </div>
    );
}
