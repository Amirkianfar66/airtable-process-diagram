// ScalableIconNode.jsx
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;

    // Determine original icon dimensions
    const origWidth = data.icon?.props?.style?.width || 20;
    const origHeight = data.icon?.props?.style?.height || 20;
    const width = origWidth * scaleX;
    const height = origHeight * scaleY;

    // Handler functions...

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
