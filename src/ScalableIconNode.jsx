// ScalableIconNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
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
            style={{ position: 'relative', display: 'inline-block', pointerEvents: 'all' }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Icon wrapper applies transform scaling */}
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'center center',
                    display: 'inline-block',
                }}
            >
                {data.icon}
            </div>

            {/* Control buttons with spacing */}
            <button onClick={onScaleX} style={{ position: 'absolute', top: -10, right: 8, padding: '2px 4px', fontSize: 10 }}>X×2</button>
            <button onClick={onScaleY} style={{ position: 'absolute', top: -10, right: 40, padding: '2px 4px', fontSize: 10 }}>Y×2</button>
            <button onClick={onReset} style={{ position: 'absolute', top: -10, right: 72, padding: '2px 4px', fontSize: 10 }}>Reset</button>

            {/* Handles on perimeter of scaled icon */}
            <Handle type="target" position={Position.Left} style={{ left: -8, top: '50%' }} />
            <Handle type="source" position={Position.Right} style={{ right: -8, top: '50%' }} />
        </div>
    );
}