import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';

export default function ResizableNode({ data }) {
    const [size, setSize] = useState({ width: 200, height: 100 });

    return (
        <ResizableBox
            width={size.width}
            height={size.height}
            minConstraints={[100, 50]}
            maxConstraints={[600, 300]}
            onResizeStop={(e, { size }) => setSize(size)}
            resizeHandles={['e', 's']} // east and south edges
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    border: '2px solid #007aff',
                    backgroundColor: '#f0f8ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'center',
                    userSelect: 'none',
                    boxSizing: 'border-box',
                    padding: 10,
                    position: 'relative',
                }}
            >
                {data.icon}
                <span>{data.label || 'Resizable Node'}</span>
                <Handle type="target" position={Position.Left} />
                <Handle type="source" position={Position.Right} />
            </div>
        </ResizableBox>
    );
}
