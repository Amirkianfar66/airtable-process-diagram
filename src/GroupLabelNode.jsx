import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const handleSize = 12;

export default function GroupLabelNode({ id, data }) {
    const {
        width = 200,
        height = 100,
        label,
        position = { x: 0, y: 0 },
        onDrag,
        onScale,
        onRename,
        onDelete,
    } = data;

    const [baseSize] = useState({ width, height });
    const [pos, setPos] = useState(position);
    const [scale, setScale] = useState(1);

    const draggingRef = useRef(false);
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    const dragStartNodePosRef = useRef({ x: 0, y: 0 });

    const scalingRef = useRef(false);
    const scaleStartPosRef = useRef({ x: 0, y: 0 });
    const scaleStartValueRef = useRef(scale);

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', onScalePointerMove);
            window.removeEventListener('pointerup', onScalePointerUp);
            window.removeEventListener('pointermove', onDragPointerMove);
            window.removeEventListener('pointerup', onDragPointerUp);
        };
    }, []);

    // Drag handlers
    const onDragPointerDown = (event) => {
        if (scalingRef.current) return;
        event.stopPropagation();
        draggingRef.current = true;
        dragStartPosRef.current = { x: event.clientX, y: event.clientY };
        dragStartNodePosRef.current = { ...pos };
        window.addEventListener('pointermove', onDragPointerMove);
        window.addEventListener('pointerup', onDragPointerUp);
    };

    const onDragPointerMove = (event) => {
        if (!draggingRef.current) return;
        const dx = event.clientX - dragStartPosRef.current.x;
        const dy = event.clientY - dragStartPosRef.current.y;
        const scaledDx = dx / scale;
        const scaledDy = dy / scale;
        const newX = dragStartNodePosRef.current.x + scaledDx;
        const newY = dragStartNodePosRef.current.y + scaledDy;
        setPos({ x: newX, y: newY });
        if (onDrag) onDrag(id, { x: newX, y: newY });
    };

    const onDragPointerUp = () => {
        draggingRef.current = false;
        window.removeEventListener('pointermove', onDragPointerMove);
        window.removeEventListener('pointerup', onDragPointerUp);
    };

    // Scale handlers
    const onScalePointerDown = (event) => {
        event.stopPropagation();
        scalingRef.current = true;
        scaleStartPosRef.current = { x: event.clientX, y: event.clientY };
        scaleStartValueRef.current = scale;
        window.addEventListener('pointermove', onScalePointerMove);
        window.addEventListener('pointerup', onScalePointerUp);
    };

    const onScalePointerMove = (event) => {
        if (!scalingRef.current) return;
        const dx = event.clientX - scaleStartPosRef.current.x;
        let newScale = scaleStartValueRef.current + dx / baseSize.width;
        newScale = Math.min(Math.max(newScale, 0.5), 3);
        setScale(newScale);
        if (onScale) onScale(id, newScale);
    };

    const onScalePointerUp = () => {
        scalingRef.current = false;
        window.removeEventListener('pointermove', onScalePointerMove);
        window.removeEventListener('pointerup', onScalePointerUp);
    };

    return (
        <>
            {/* Scale debug slider */}
            <div style={{ marginBottom: 8 }}>
                <label>
                    Scale debug:
                    <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.01"
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        style={{ width: 200, marginLeft: 8 }}
                    />
                    <span style={{ marginLeft: 8 }}>{(scale * 100).toFixed(0)}%</span>
                </label>
            </div>

            <div
                onPointerDown={onDragPointerDown}
                style={{
                    position: 'absolute',
                    width: baseSize.width,
                    height: baseSize.height,
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

                {/* Buttons group top right */}
                <div
                    style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        display: 'flex',
                        gap: 4,
                        zIndex: 200,
                        transformOrigin: 'top right',
                    }}
                    onPointerDown={(e) => e.stopPropagation()} // prevent dragging when clicking buttons
                >
                    <button
                        onClick={() => onRename && onRename(id)}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        title="Rename Group"
                    >
                        Rename
                    </button>
                    <button
                        onClick={() => onDelete && onDelete(id)}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        title="Delete Group"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => alert('Group Info clicked!')}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        title="Group Info"
                    >
                        Info
                    </button>
                    {/* Add more buttons if needed */}
                </div>

                {/* Scale handle */}
                <div
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onScalePointerDown(e);
                    }}
                    style={{
                        position: 'absolute',
                        width: handleSize,
                        height: handleSize,
                        bottom: -8,
                        right: -8,
                        background: '#00bcd4',
                        borderRadius: 2,
                        cursor: 'nwse-resize',
                        userSelect: 'none',
                        zIndex: 100,
                        pointerEvents: 'auto',
                        touchAction: 'none',
                    }}
                    title="Scale group"
                />

                {/* React Flow handles */}
                <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
                <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
            </div>
        </>
    );
}
