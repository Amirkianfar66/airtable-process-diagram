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
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, scaleX: (node.data.scaleX || 1) * 2 } }
                    : node
            )
        );
    };

    const onScaleY = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, scaleY: (node.data.scaleY || 1) * 2 } }
                    : node
            )
        );
    };

    const onReset = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, scaleX: 1, scaleY: 1 } }
                    : node
            )
        );
    };

    // Determine scaled dimensions
    const origWidth = data.icon?.props?.style?.width || 20;
    const origHeight = data.icon?.props?.style?.height || 20;
    const width = origWidth * scaleX;
    const height = origHeight * scaleY;

    // Clone icon with explicit width/height
    const scaledIcon = data.icon
        ? React.cloneElement(data.icon, {
            style: {
                ...data.icon.props.style,
                width,
                height,
            },
        })
        : null;

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
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Render scaled icon */}
            {scaledIcon}

            {/* Scale X button */}
            <button
                onClick={onScaleX}
                style={{ position: 'absolute', top: -8, right: 8, padding: '2px 4px', fontSize: 10 }}
            >
                X×2
            </button>

            {/* Scale Y button */}
            <button
                onClick={onScaleY}
                style={{ position: 'absolute', top: -8, right: 36, padding: '2px 4px', fontSize: 10 }}
            >
                Y×2
            </button>

            {/* Reset button */}
            <button
                onClick={onReset}
                style={{ position: 'absolute', top: -8, right: 64, padding: '2px 4px', fontSize: 10 }}
            >
                Reset
            </button>

            {/* Handles align to container perimeter */}
            <Handle type="target" position={Position.Left} style={{ top: height / 2 - 8 }} />
            <Handle type="source" position={Position.Right} style={{ top: height / 2 - 8 }} />
        </div>
    );
}
