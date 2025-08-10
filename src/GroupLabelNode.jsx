import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const handleSize = 12;

export default function GroupLabelNode({ id, data }) {
    const {
        width = 200,
        height = 100,
        label,
        position = { x: 0, y: 0 },
        onResize,
        onDrag,
    } = data;

    const [size, setSize] = useState({ width, height });
    const [pos, setPos] = useState(position);
    const [scale, setScale] = useState(1);

    const resizingRef = useRef(false);
    const draggingRef = useRef(false);

    const startPosRef = useRef({ x: 0, y: 0 });
    const startSizeRef = useRef({ width, height });
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    const dragStartNodePosRef = useRef({ x: 0, y: 0 });

    // Resize handlers (adjusted for scale)
    const onResizeMouseDown = (event) => {
        event.stopPropagation();
        resizingRef.current = true;
        startPosRef.current = { x: event.clientX, y: event.clientY };
        startSizeRef.current = { ...size };
        window.addEventListener('mousemove', onResizeMouseMove);
        window.addEventListener('mouseup', onResizeMouseUp);
    };

    const onResizeMouseMove = (event) => {
        if (!resizingRef.current) return;
        const dx = (event.clientX - startPosRef.current.x) / scale; // divide by scale!
        const dy = (event.clientY - startPosRef.current.y) / scale;

        const newWidth = Math.max(50, startSizeRef.current.width + dx);
        const newHeight = Math.max(40, startSizeRef.current.height + dy);

        setSize({ width: newWidth, height: newHeight });
        if (onResize) {
            onResize(id, { width: newWidth, height: newHeight });
        }
    };

    const onResizeMouseUp = () => {
        resizingRef.current = false;
        window.removeEventListener('mousemove', onResizeMouseMove);
        window.removeEventListener('mouseup', onResizeMouseUp);
    };

    // Drag handlers (adjusted for scale)
    const onDragMouseDown = (event) => {
        if (resizingRef.current) return;
        event.stopPropagation();
        draggingRef.current = true;
        dragStartPosRef.current = { x: event.clientX, y: event.clientY };
        dragStartNodePosRef.current = { ...pos };
        window.addEventListener('mousemove', onDragMouseMove);
        window.addEventListener('mouseup', onDragMouseUp);
    };

    const onDragMouseMove = (event) => {
        if (!draggingRef.current) return;
        const dx = (event.clientX - dragStartPosRef.current.x) / scale; // divide by scale
        const dy = (event.clientY - dragStartPosRef.current.y) / scale;

        const newX = dragStartNodePosRef.current.x + dx;
        const newY = dragStartNodePosRef.current.y + dy;

        setPos({ x: newX, y: newY });
        if (onDrag) {
            onDrag(id, { x: newX, y: newY });
        }
    };

    const onDragMouseUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', onDragMouseMove);
        window.removeEventListener('mouseup', onDragMouseUp);
    };

    return (
        <>
            {/* Scale slider control */}
            <div style={{ marginBottom: 8 }}>
                <label>
                    Scale: {(scale * 100).toFixed(0)}%
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.01"
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        style={{ width: 200, marginLeft: 8 }}
                    />
                </label>
            </div>

            <div
                ref={nodeRef}
                onMouseDown={onDragMouseDown}
                style={{
                    position: 'absolute',
                    width: size.width,
                    height: size.height,
                    transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                    transformOrigin: 'top left',
                    border: '2px dashed #00bcd4',
                    borderRadius: 6,
                    background: 'rgba(0, 188, 212, 0.05)',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    cursor: draggingRef.current ? 'grabbing' : 'grab',
                }}
            >
                {/* Label */}
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

                {/* Resize handle */}
                <div
                    onMouseDown={onResizeMouseDown}
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

                {/* Hidden React Flow handles */}
                <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
                <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
            </div>
        </>
    );
}
