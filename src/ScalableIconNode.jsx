// ScalableIconNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();

    // Double the icon scale in node data
    const onScale = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: { ...node.data, scale: (node.data.scale || 1) * 2 },
                    };
                }
                return node;
            })
        );
    };

    // Clone your SVG icon with transform
    const scaledIcon = data.icon
        ? React.cloneElement(data.icon, {
            style: {
                ...data.icon.props.style,
                transform: `scale(${data.scale || 1})`,
                transformOrigin: 'center center',
            },
        })
        : null;

    return (
        <div
            style={{
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
            {scaledIcon}

            {/* Scale button */}
            <button
                onClick={onScale}
                style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    padding: '2px 4px',
                    fontSize: 10,
                    background: '#fff',
                    border: '1px solid #aaa',
                    borderRadius: 2,
                    cursor: 'pointer',
                }}
            >
                ×2
            </button>

            {/* Optional connection handles */}
            <Handle type="target" position={Position.Left} style={{ pointerEvents: 'auto' }} />
            <Handle type="source" position={Position.Right} style={{ pointerEvents: 'auto' }} />
        </div>
    );
}
