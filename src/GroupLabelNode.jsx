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
    } = data;

    // Base size (constant)
    const [baseSize] = useState({ width, height });

    // Position and scale states
    const [pos, setPos] = useState(position);
    const [scale, setScale] = useState(1);

    const nodeRef = useRef(null);

    // Drag refs
    const draggingRef = useRef(false);
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    const dragStartNodePosRef = useRef({ x: 0, y: 0 });

    // Scale refs
    const scalingRef = useRef(false);
    const scaleStartPosRef = useRef({ x: 0, y: 0 });
    const scaleStartValueRef = useRef(scale);

    // Cleanup event listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', onScaleMouseMove);
            window.removeEventListener('mouseup', onScaleMouseUp);
            window.removeEventListener('mousemove', onDragMouseMove);
            window.removeEventListener('mouseup', onDragMouseUp);
        };
    }, []);

    // Drag handlers
    const onDragMouseDown = (event) => {
        if (scalingRef.current) return; // prevent drag while scaling
        event.stopPropagation();
        draggingRef.current = true;
        dragStartPosRef.current = { x: event.clientX, y: event.clientY };
        dragStartNodePosRef.current = { ...pos };
        window.addEventListener('mousemove', onDragMouseMove);
        window.addEventListener('mouseup', onDragMouseUp);
    };

    const onDragMouseMove = (event) => {
        if (!draggingRef.current) return;
        const dx = event.clientX - dragStartPosRef.current.x;
        const dy = event.clientY - dragStartPosRef.current.y;
        const newX = dragStartNodePosRef.current.x + dx;
        const newY = dragStartNodePosRef.current.y + dy;
        setPos({ x: newX, y: newY });
        if (onDrag) onDrag(id, { x: newX, y: newY });
    };

    const onDragMouseUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', onDragMouseMove);
        window.removeEventListener('mouseup', onDragMouseUp);
    };

    // Scale handlers
    const onScaleMouseDown = (event) => {
        console.log('Scale handle mouse down');
        event.stopPropagation();
        scalingRef.current = true;
        scaleStartPosRef.current = { x: event.clientX, y: event.clientY };
        scaleStartValueRef.current = scale;
        window.addEventListener('mousemove', onScaleMouseMove);
        window.addEventListener('mouseup', onScaleMouseUp);
    };

    const onScaleMouseMove = (event) => {
        if (!scalingRef.current) return;
        const dx = event.clientX - scaleStartPosRef.current.x;
        let newScale = scaleStartValueRef.current + dx / baseSize.width;
        newScale = Math.min(Math.max(newScale, 0.5), 3);
        console.log('dx:', dx, 'newScale:', newScale.toFixed(3));
        setScale(newScale);
        if (onScale) onScale(id, newScale);
    };

    const onScaleMouseUp = () => {
        scalingRef.current = false;
        window.removeEventListener('mousemove', onScaleMouseMove);
        window.removeEventListener('mouseup', onScaleMouseUp);
    };

    return (
        <>
            {/* Manual scale slider for debugging */}
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
                ref={nodeRef}
                onMouseDown={onDragMouseDown}
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

                {/* Scale handle bottom-right */}
                <div
                    onMouseDown={onScaleMouseDown}
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
                        zIndex: 100,
                        pointerEvents: 'auto',
                        touchAction: 'none',
                    }}
                    title="Scale group"
                />

                {/* React Flow handles (hidden) */}
                <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
                <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
            </div>
        </>
    );
}
