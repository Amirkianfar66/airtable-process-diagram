// ScalableIconNode.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);
    const iconRef = useRef(null);

    const scale = data.scale || 1;

    const updateScale = (newScale) => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, scale: newScale } }
                    : node
            )
        );
    };

    const onScale = (e) => { e.stopPropagation(); updateScale(scale * 2); };
    const onReset = (e) => { e.stopPropagation(); updateScale(1); };

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
    const size = baseSize * scale;

    return (
        <div
            style={{
                position: 'relative',
                width: size,
                height: size,
                pointerEvents: 'all',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            {/* SVG Icon scaled inside */}
            <div
                ref={iconRef}
                style={{
                    transform: `scale(${scale})`,
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
                    <button onClick={onScale} style={{ fontSize: 10 }}>×2</button>
                    <button onClick={onReset} style={{ fontSize: 10 }}>Reset</button>
                </div>
            )}
        </div>
    );
}
