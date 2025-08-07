// ScalableIconNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;

    // Original icon dimensions from props or default
    const origWidth = data.icon?.props?.style?.width || 20;
    const origHeight = data.icon?.props?.style?.height || 20;

    // Scaled dimensions
    const width = origWidth * scaleX;
    const height = origHeight * scaleY;

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
                width,
                height,
                pointerEvents: 'all',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Scaled SVG Icon */}
            <div
                style={{
                    width: origWidth,
                    height: origHeight,
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    display: 'inline-block',
                }}
            >
                {data.icon}
            </div>

            {/* Control buttons (absolute, unscaled) */}
            <button
                onClick={onScaleX}
                style={{ position: 'absolute', top: -20, right: 8, fontSize: 10 }}
            >X×2</button>
            <button
                onClick={onScaleY}
                style={{ position: 'absolute', top: -20, right: 40, fontSize: 10 }}
            >Y×2</button>
            <button
                onClick={onReset}
                style={{ position: 'absolute', top: -20, right: 72, fontSize: 10 }}
            >Reset</button>

            {/* Handles locked on scaled border */}
            <Handle
                type="target"
                position={Position.Left}
                style={{ top: height / 2 - 8 }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{ top: height / 2 - 8 }}
            />
        </div>
    );
}
