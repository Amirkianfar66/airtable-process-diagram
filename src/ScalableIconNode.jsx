import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(true);
    const nodeRef = useRef(null);
    const baseSize = 100;

    // Default scale = 1
    const [scale, setScale] = useState(1);

    const onResetScale = () => setScale(1);
    const onZoomIn = () => setScale(prev => Math.min(prev + 0.2, 2));
    const onZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

    useEffect(() => {
        if (!nodeRef.current) return;
        const observer = new ResizeObserver(() => {
            const bounds = nodeRef.current.getBoundingClientRect();
            setNodes(prevNodes =>
                prevNodes.map(node =>
                    node.id === id ? {
                        ...node,
                        width: bounds.width,
                        height: bounds.height
                    } : node
                )
            );
        });
        observer.observe(nodeRef.current);
        return () => observer.disconnect();
    }, [id, setNodes]);

    const IconComponent = data?.icon || (() => <rect width={baseSize} height={baseSize} fill="#ccc" />);

    const label = data?.label ? data.label.substring(0, 5) : "";

    return (
        <div
            ref={nodeRef}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ textAlign: 'center', padding: 4 }}
        >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
                <svg width={baseSize} height={baseSize}>
                    <IconComponent scaleX={scale} scaleY={scale} />
                </svg>
            </div>

            {/* Label under icon (first 5 chars only) */}
            <div style={{ fontSize: 12, marginTop: 4 }}>{label}</div>

            {/* Only show zoom/reset for EquipmentIcon */}
            {hovered && data?.type === "equipment" && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                    <button onClick={onZoomOut}>−</button>
                    <button onClick={onResetScale}>⟳</button>
                    <button onClick={onZoomIn}>＋</button>
                </div>
            )}

            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />
        </div>
    );
}
