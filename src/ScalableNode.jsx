// ScalableNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableNode({ id, data }) {
    const { setNodes } = useReactFlow();

    const onScale = () => {
        // Double the width and height of this node
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    const curWidth = (node.style?.width || data.width || 160);
                    const curHeight = (node.style?.height || data.height || 60);
                    return {
                        ...node,
                        style: {
                            ...node.style,
                            width: curWidth * 2,
                            height: curHeight * 2,
                        },
                        data: {
                            ...node.data,
                            width: curWidth * 2,
                            height: curHeight * 2,
                        },
                    };
                }
                return node;
            })
        );
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: '#fff',
                border: '1px solid #888',
                borderRadius: 4,
                width: data.width || 160,
                height: data.height || 60,
                position: 'relative',
                boxSizing: 'border-box',
            }}
        >
            {/* Icon and label */}
            {data.icon}
            <span>{data.label}</span>

            {/* Scale button */}
            <button
                onClick={(e) => { e.stopPropagation(); onScale(); }}
                style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    cursor: 'pointer',
                }}
            >
                ×2
            </button>

            {/* Connection handles */}
            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />
        </div>
    );
}
