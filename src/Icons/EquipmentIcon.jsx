import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function EquipmentIcon({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [scale, setScale] = useState(data?.scale || 1);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (data?.scale !== undefined && data.scale !== scale) {
            setScale(data.scale);
        }
    }, [data?.scale]);

    const updateScale = (newScale) => {
        setScale(newScale);
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
                width: 180,
                height: 180,
                textAlign: 'center',
                userSelect: 'none',
            }}
        >
            {/* Scalable container with both SVG and handles */}
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'relative',
                    width: 150,
                    height: 150,
                }}
            >
                <svg
                    width="150"
                    height="150"
                    viewBox="0 0 200 200"
                    style={{
                        pointerEvents: 'none',
                        display: 'block',
                        margin: '0 auto',
                    }}
                >
                    <rect x="0" y="0" width="150" height="150" fill="green" />
                    <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                        EQ
                    </text>
                </svg>

                {/* Handles inside scaled container */}
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: -7,
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
                        position: 'absolute',
                        top: '50%',
                        right: -7,
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
                        position: 'absolute',
                        top: -7,
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
                        position: 'absolute',
                        bottom: -7,
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

            {/* Floating scale/reset buttons */}
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

            {/* Label */}
            <div
                style={{
                    fontSize: 13,
                    marginTop: 3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#333',
                }}
            >
                {data?.label?.substring(0, 5)}
            </div>
        </div>
    );
}
