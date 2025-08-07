// ScalableIconNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;

    // Handlers to adjust scaleX and scaleY
    const onScaleX = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    const newScaleX = (node.data.scaleX || 1) * 2;
                    return {
                        ...node,
                        data: { ...node.data, scaleX: newScaleX },
                    };
                }
                return node;
            })
        );
    };

    const onScaleY = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    const newScaleY = (node.data.scaleY || 1) * 2;
                    return {
                        ...node,
                        data: { ...node.data, scaleY: newScaleY },
                    };
                }
                return node;
            })
        );
    };

    const onReset = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: { ...node.data, scaleX: 1, scaleY: 1 },
                    };
                }
                return node;
            })
        );
    };

    // Determine original icon dimensions
    const origWidth = data.icon?.props?.style?.width || 20;
    const origHeight = data.icon?.props?.style?.height || 20;
    const width = origWidth * scaleX;
    const height = origHeight * scaleY;

    // Wrap icon in a div to apply separate scaling
    const scaledIcon = data.icon ? (
        <div
            style={{
                width,
                height,
                transform: `scale(${scaleX}, ${scaleY})`,
                transformOrigin: 'center center',
                display: 'inline-block',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {data.icon}
        </div>
    ) : null;

    return (
        <div
            style={{
                width,
                height,
                display: 'inline-block',
                background: 'transparent',
                border: 'none',
                position: 'relative',
                padding: 0,
                margin: 0,
                pointerEvents: 'all',
                overflow: 'visible',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {scaledIcon}

            {/* Scale X button */}
            <button
                onClick={onScaleX}
                style={{
                    position: 'absolute',
                    top: -8,
                    right: 8,
                    padding: '2px 4px',
                    fontSize: 10,
                    background: '#fff',
                    border: '1px solid #aaa',
                    borderRadius: 2,
                    cursor: 'pointer',
                }}
            >
                X×2
            </button>

            {/* Scale Y button */}
            <button
                onClick={onScaleY}
                style={{
                    position: 'absolute',
                    top: -8,
                    right: 36,
                    padding: '2px 4px',
                    fontSize: 10,
                    background: '#fff',
                    border: '1px solid #aaa',
                    borderRadius: 2,
                    cursor: 'pointer',
                }}
            >
                Y×2
            </button>

            {/* Reset button */}
            <button
                onClick={onReset}
                style={{
                    position: 'absolute',
                    top: -8,
                    right: 64,
                    padding: '2px 4px',
                    fontSize: 10,
                    background: '#fff',
                    border: '1px solid #aaa',
                    borderRadius: 2,
                    cursor: 'pointer',
                }}
            >
                Reset
            </button>

            <Handle type="target" position={Position.Left} style={{ pointerEvents: 'auto' }} />
            <Handle type="source" position={Position.Right} style={{ pointerEvents: 'auto' }} />
        </div>
    );
}
