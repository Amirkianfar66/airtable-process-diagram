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
        // Scale entire container, so child icon and border moves together
        <div
            style={{
                position: 'relative',
                display: 'inline-block',
                transform: `scale(${scaleX}, ${scaleY})`,
                transformOrigin: 'center center',
                pointerEvents: 'all',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* SVG Icon */}
            <div style={{ display: 'inline-block' }}>
                {data.icon}
            </div>

            {/* Control buttons (absolute, not scaled because they are outside transform) */}
            <div style={{ position: 'absolute', top: -20, right: 0, transform: `scale(${1 / scaleX}, ${1 / scaleY})`, transformOrigin: 'top right' }}>
                <button onClick={onScaleX} style={{ marginRight: 4, fontSize: 10 }}>X×2</button>
                <button onClick={onScaleY} style={{ marginRight: 4, fontSize: 10 }}>Y×2</button>
                <button onClick={onReset} style={{ fontSize: 10 }}>Reset</button>
            </div>

            {/* Handles locked to container border: disable transform on handles */}
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
