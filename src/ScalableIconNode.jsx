import React, { useState, useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);
    const iconRef = useRef(null);

    const scale = data.scale || 1;
    const label = data.label || '';

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
                height: size + 20,
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
                    marginTop: -8,     // small negative margin to move label up
                    position: 'relative',
                    top: -8,           // shift label upward
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#333',
                    width: '100%',
                    textAlign: 'center',
                    paddingLeft: 5,
                }}
            >
                {label.substring(0, 10)}
            </div>
        </div>
    );
}
