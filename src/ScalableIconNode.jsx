import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);
    const iconRef = useRef(null);

    const scale = data.scale || 1;
    const label = data.label || '';  // Name of the item from Airtable

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
                height: size + 20, // extra space for label
                pointerEvents: 'all',
                textAlign: 'center',
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

            {/* Label below SVG */}
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
                {label.substring(0, 5)}
            </div>

            {/* Control buttons */}
            
        </div>
    );
}
