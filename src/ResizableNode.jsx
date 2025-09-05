// ResizableNode.jsx
import React, { useState, useCallback } from 'react';
import { ResizableBox } from 'react-resizable';
import { Handle, Position } from 'reactflow';
import 'react-resizable/css/styles.css';

export default function ResizableNode({ id, data, selected }) {
    const [size, setSize] = useState({
        width: data.width || 200,
        height: data.height || 100,
    });

    // update local state on resize
    const onResizeStop = useCallback((e, { size }) => {
        e.stopPropagation();           // Prevent ReactFlow from dragging node
        setSize(size);
    }, []);

    // Stop propagation on pointer down so ReactFlow never sees it
    const stopDragPropagation = useCallback((e) => {
        e.stopPropagation();
    }, []);

    return (
        <ResizableBox
            width={size.width}
            height={size.height}
            minConstraints={[100, 50]}
            maxConstraints={[800, 600]}
            resizeHandles={['se']}              // only southeast handle
            onResizeStop={onResizeStop}
            handle={
                <div
                    className="custom-handle custom-handle-se"
                    onMouseDown={stopDragPropagation}
                    onTouchStart={stopDragPropagation}
                    style={{
                        position: 'absolute',
                        width: 16,
                        height: 16,
                        bottom: 0,
                        right: 0,
                        cursor: 'se-resize',
                        background: '#007aff',
                        borderRadius: 2,
                        zIndex: 10,
                    }}
                />
            }
            style={{
                border: selected ? '2px solid #007aff' : '1px solid #aaa',
                background: '#fff',
                position: 'relative',
                padding: 8,
                boxSizing: 'border-box',
            }}
        >
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
                {/* pointerEvents none on content so only handle catches down */}
                {data.icon}
                <span style={{ marginLeft: 8 }}>{data.label}</span>
            </div>
            <Handle type="target" position={Position.Left} style={{ pointerEvents: 'auto' }} />
            <Handle type="source" position={Position.Right} style={{ pointerEvents: 'auto' }} />
        </ResizableBox>
    );
}
