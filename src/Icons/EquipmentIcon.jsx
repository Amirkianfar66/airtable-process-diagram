// ScalableIconNode.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);
    const iconRef = useRef(null);
    const [iconBBox, setIconBBox] = useState({ width: 100, height: 100 });

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

    // Icon box position and size (based on SVG <rect x="20" width="60">)
    const rectLeft = 20 * scaleX;
    const rectRight = (20 + 60) * scaleX;
    const rectTop = 20 * scaleY;
    const rectBottom = (20 + 60) * scaleY;
    const centerY = rectTop + (60 * scaleY) / 2;
    const centerX = rectLeft + (60 * scaleX) / 2;

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
                ref={iconRef}
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: baseSize,
                    height: baseSize,
                    pointerEvents: 'none',
                }}
            >
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                    <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                        EQ
                    </text>
                </svg>
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

            {/* Handles positioned exactly at the border of the rect */}
            {visible && (
                <>
                    <Handle
                        type="target"
                        position={Position.Left}
                        style={{
                            top: `${centerY}px`,
                            left: `${rectLeft}px`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'auto',
                            position: 'absolute'
                        }}
                    />
                    <Handle
                        type="source"
                        position={Position.Right}
                        style={{
                            top: `${centerY}px`,
                            left: `${rectRight}px`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'auto',
                            position: 'absolute'
                        }}
                    />
                    <Handle
                        type="target"
                        position={Position.Top}
                        style={{
                            top: `${rectTop}px`,
                            left: `${centerX}px`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'auto',
                            position: 'absolute'
                        }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        style={{
                            top: `${rectBottom}px`,
                            left: `${centerX}px`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'auto',
                            position: 'absolute'
                        }}
                    />
                </>
            )}
        </div>
    );
}