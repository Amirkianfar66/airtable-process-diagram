import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const handleSize = 12; // size of resize handle square

export default function GroupLabelNode({ id, data }) {
    const { width = 200, height = 100, label, onResize } = data;

    const [size, setSize] = useState({ width, height });
    const nodeRef = useRef(null);
    const resizingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const startSizeRef = useRef({ width, height });

    useEffect(() => {
        setSize({ width, height }); // update size if props change
    }, [width, height]);

    const onMouseDown = (event) => {
        event.stopPropagation();
        resizingRef.current = true;
        startPosRef.current = { x: event.clientX, y: event.clientY };
        startSizeRef.current = { ...size };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (event) => {
        if (!resizingRef.current) return;
        const dx = event.clientX - startPosRef.current.x;
        const dy = event.clientY - startPosRef.current.y;

        const newWidth = Math.max(50, startSizeRef.current.width + dx);
        const newHeight = Math.max(40, startSizeRef.current.height + dy);

        setSize({ width: newWidth, height: newHeight });

        if (onResize) {
            onResize(id, { width: newWidth, height: newHeight });
        }
    };

    const onMouseUp = () => {
        resizingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    return (
        <div
            ref={nodeRef}
            style={{
                border: '2px dashed #00bcd4',
                borderRadius: 6,
                background: 'rgba(0, 188, 212, 0.05)',
                width: size.width,
                height: size.height,
                position: 'relative',
                boxSizing: 'border-box',
                userSelect: 'none',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: -24,
                    left: 4,
                    background: '#00bcd4',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 'bold',
                    fontSize: 12,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </div>

            {/* Resize handle bottom-right */}
            <div
                onMouseDown={onMouseDown}
                style={{
                    position: 'absolute',
                    width: handleSize,
                    height: handleSize,
                    bottom: 0,
                    right: 0,
                    background: '#00bcd4',
                    borderRadius: 2,
                    cursor: 'nwse-resize',
                    userSelect: 'none',
                    zIndex: 10,
                }}
                title="Resize group"
            />

            {/* Optional handles hidden */}
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </div>
    );
}
