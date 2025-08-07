// ScalableIconNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();

    const onScale = (e) => {
        e.stopPropagation();
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    const newScale = (node.data.scale || 1) * 2;
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            scale: newScale,
                        },
                    };
                }
                return node;
            })
        );
    };

    // Clone and scale the SVG icon
    let scaledIcon = null;
    if (data.icon) {
        scaledIcon = React.cloneElement(data.icon, {
            ...data.icon.props,
            style: {
                ...data.icon.props.style,
                transform: `scale(${data.scale || 1})`,
                transformOrigin: 'center center',
            },
        });
    }

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
                overflow: 'visible',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Render the scaled icon */}
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

            {/* Connection handles */}
            <Handle type="target" position={Position.Left} style={{ pointerEvents: 'auto' }} />
            <Handle type="source" position={Position.Right} style={{ pointerEvents: 'auto' }} />
        </div>
    );
}
