// ScalableIconNode.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);
    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;

    const updateScale = (newScaleX, newScaleY) => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, scaleX: newScaleX, scaleY: newScaleY } }
                    : node
            )
        );
    };

    const onScaleX = (e) => { e.stopPropagation(); updateScale(scaleX * 2, scaleY); };
    const onScaleY = (e) => { e.stopPropagation(); updateScale(scaleX, scaleY * 2); };
    const onReset = (e) => { e.stopPropagation(); updateScale(1, 1); };

    const handleMouseEnter = () => {
        setHovered(true);
        setVisible(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const handleMouseLeave = () => {
        setHovered(false);
        timeoutRef.current = setTimeout(() => setVisible(false), 3000);
    };

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const baseSize = 100;
    const width = baseSize * scaleX;
    const height = baseSize * scaleY;

    return (
        <div
            style={{
                position: 'relative',
                width,
                height,
                pointerEvents: 'all',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            {/* SVG Icon scaled inside */}
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: baseSize,
                    height: baseSize,
                    pointerEvents: 'none',
                }}
            >
                {data.icon}
            </div>

            {/* Control buttons */}
            {visible && (
                <div
                    style={{
                        position: 'absolute',
                        top: -32,
                        left: '50%',
                        transform: 'translateX(-50%) scale(1)',
                        pointerEvents: 'auto',
                        display: 'flex',
                        gap: '4px',
                        background: 'rgba(255,255,255,0.8)',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        zIndex: 10,
                    }}
                >
                    <button onClick={onScaleX} style={{ fontSize: 10 }}>X×2</button>
                    <button onClick={onScaleY} style={{ fontSize: 10 }}>Y×2</button>
                    <button onClick={onReset} style={{ fontSize: 10 }}>Reset</button>
                </div>
            )}

            {/* Handles locked to container edge, not scaled */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'auto',
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'auto',
                }}
            />
        </div>
    );
}
