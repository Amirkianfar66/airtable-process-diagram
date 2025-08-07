// ScalableIconNode.jsx
import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;

    const updateScale = (newScaleX, newScaleY) => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, scaleX: newScaleX, scaleY: newScaleY } }
                    : node
            )
        );
    };

    const onScaleX = (e) => { e.stopPropagation(); updateScale(scaleX * 2, scaleY); };
    const onScaleY = (e) => { e.stopPropagation(); updateScale(scaleX, scaleY * 2); };
    const onReset = (e) => { e.stopPropagation(); updateScale(1, 1); };

    return (
        <div
            style={{
                position: 'relative',
                display: 'inline-block',
                transform: `scale(${scaleX}, ${scaleY})`,
                transformOrigin: 'center center',
                pointerEvents: 'all',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => e.stopPropagation()}
        >
            {/* SVG Icon */}
            <div style={{ display: 'inline-block' }}>
                {data.icon}
            </div>

            {/* Control buttons: visible on hover, positioned at top center */}
            {hovered && (
                <div
                    style={{
                        position: 'absolute',
                        top: -28,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        pointerEvents: 'auto',
                        display: 'flex',
                        gap: '4px',
                        background: 'rgba(255,255,255,0.8)',
                        padding: '2px',
                        borderRadius: '4px',
                    }}
                >
                    <button onClick={onScaleX} style={{ fontSize: 10 }}>X×2</button>
                    <button onClick={onScaleY} style={{ fontSize: 10 }}>Y×2</button>
                    <button onClick={onReset} style={{ fontSize: 10 }}>Reset</button>
                </div>
            )}

            {/* Handles locked to container border */}
            <Handle
                type="target"
                position={Position.Left}
                style={{ pointerEvents: 'auto', transform: 'none' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{ pointerEvents: 'auto', transform: 'none' }}
            />
        </div>
    );
}