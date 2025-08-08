import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function EquipmentIcon({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const timeoutRef = useRef(null);

    const scale = data?.scale || 1;

    const updateScale = (newScale) => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, scale: newScale } } : node
            )
        );
    };

    const onScale = (e) => {
        e.stopPropagation();
        updateScale(scale * 2);
    };

    const onReset = (e) => {
        e.stopPropagation();
        updateScale(1);
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setHovered(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setHovered(false), 2000);
    };

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                position: 'relative',
                width: 100,
                height: 120,
                textAlign: 'center',
                userSelect: 'none',
            }}
        >
            <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    pointerEvents: 'none',
                    display: 'block',
                    margin: '0 auto',
                }}
            >
                <rect x="20" y="20" width="60" height="60" fill="green" />
                <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                    EQ
                </text>
            </svg>

            {hovered && (
                <div
                    style={{
                        position: 'absolute',
                        top: -32,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 6,
                        background: 'rgba(255, 255, 255, 0.85)',
                        padding: '2px 6px',
                        borderRadius: 6,
                        boxShadow: '0 0 5px rgba(0,0,0,0.2)',
                        zIndex: 10,
                    }}
                >
                    <button onClick={onScale} style={{ fontSize: 12, cursor: 'pointer' }}>
                        ×2
                    </button>
                    <button onClick={onReset} style={{ fontSize: 12, cursor: 'pointer' }}>
                        Reset
                    </button>
                </div>
            )}

            <Handle
                type="target"
                position={Position.Left}
                style={{
                    top: '50%',
                    background: 'red',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateY(-50%)',
                    opacity: hovered ? 1 : 0.01,
                }}
                id="left"
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: '50%',
                    background: 'blue',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateY(-50%)',
                    opacity: hovered ? 1 : 0.01,
                }}
                id="right"
            />
            <Handle
                type="target"
                position={Position.Top}
                style={{
                    left: '50%',
                    background: 'green',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateX(-50%)',
                    opacity: hovered ? 1 : 0.01,
                }}
                id="top"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                style={{
                    left: '50%',
                    background: 'orange',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    transform: 'translateX(-50%)',
                    opacity: hovered ? 1 : 0.01,
                }}
                id="bottom"
            />
        </div>
    );
}
