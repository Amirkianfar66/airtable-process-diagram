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

    const [baseSize] = useState({ width, height });
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

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', onScalePointerMove);
            window.removeEventListener('pointerup', onScalePointerUp);
            window.removeEventListener('pointermove', onDragPointerMove);
            window.removeEventListener('pointerup', onDragPointerUp);
        };
    }, []);

    // Drag handlers with scale compensation for smooth movement anchored top-left
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

        // Compensate movement by scale to keep correct drag speed
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

    // Scale handlers with position compensation so bottom-right corner stays under pointer
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
        const dy = event.clientY - scaleStartPosRef.current.y;

        let newScaleX = scaleStartValueRef.current + dx / baseSize.width;
        let newScaleY = scaleStartValueRef.current + dy / baseSize.height;

        newScaleX = Math.min(Math.max(newScaleX, 0.5), 3);
        newScaleY = Math.min(Math.max(newScaleY, 0.5), 3);

        // For uniform scaling use minimum of newScaleX and newScaleY
        const newScale = Math.min(newScaleX, newScaleY);

        // Calculate size delta for compensation
        const sizeDeltaX = baseSize.width * (newScale - scale);
        const sizeDeltaY = baseSize.height * (newScale - scale);

        // Adjust position so bottom-right corner stays fixed under pointer
        const newPosX = pos.x - sizeDeltaX;
        const newPosY = pos.y - sizeDeltaY;

        setScale(newScale);
        setPos({ x: newPosX, y: newPosY });

        if (onScale) onScale(id, newScale);
        if (onDrag) onDrag(id, { x: newPosX, y: newPosY });
    };

    const onScalePointerUp = () => {
        scalingRef.current = false;
        window.removeEventListener('pointermove', onScalePointerMove);
        window.removeEventListener('pointerup', onScalePointerUp);
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

                {/* Scale handle bottom-right */}
                <div
                    onPointerDown={onScalePointerDown}
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
