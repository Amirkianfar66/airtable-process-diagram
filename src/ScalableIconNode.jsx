import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);
    const iconRef = useRef(null);
    const rectRef = useRef(null);
    const [rectPos, setRectPos] = useState({ left: 0, top: 0, width: 0, height: 0 });

    const scaleX = data.scaleX || 1;
    const scaleY = data.scaleY || 1;
    const baseSize = 100;
    const width = baseSize * scaleX;
    const height = baseSize * scaleY;

    // Your existing updateScale, onScaleX, onScaleY, onReset, handleMouseEnter, handleMouseLeave...

    useEffect(() => {
        if (rectRef.current && iconRef.current) {
            const rectBox = rectRef.current.getBoundingClientRect();
            const iconBox = iconRef.current.getBoundingClientRect();

            // Calculate rect position relative to icon container
            setRectPos({
                left: rectBox.left - iconBox.left,
                top: rectBox.top - iconBox.top,
                width: rectBox.width,
                height: rectBox.height,
            });
        }
    }, [scaleX, scaleY, data.icon]);

    return (
        <div
            style={{
                position: 'relative',
                width,
                height,
                pointerEvents: 'all',
            }}
            onMouseEnter={() => { setHovered(true); setVisible(true); if (timeoutRef.current) clearTimeout(timeoutRef.current); }}
            onMouseLeave={() => { setHovered(false); timeoutRef.current = setTimeout(() => setVisible(false), 3000); }}
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
                    position: 'relative',
                }}
            >
                {/* Clone icon and attach ref to rect */}
                {React.cloneElement(data.icon, {
                    children: React.Children.map(data.icon.props.children, child => {
                        if (child.type === 'rect') {
                            return React.cloneElement(child, { ref: rectRef });
                        }
                        return child;
                    }),
                })}
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
                    <button onClick={(e) => { e.stopPropagation(); setNodes(nodes => nodes.map(node => node.id === id ? { ...node, data: { ...node.data, scaleX: scaleX * 2, scaleY } } : node)); }} style={{ fontSize: 10 }}>X×2</button>
                    <button onClick={(e) => { e.stopPropagation(); setNodes(nodes => nodes.map(node => node.id === id ? { ...node, data: { ...node.data, scaleX, scaleY: scaleY * 2 } } : node)); }} style={{ fontSize: 10 }}>Y×2</button>
                    <button onClick={(e) => { e.stopPropagation(); setNodes(nodes => nodes.map(node => node.id === id ? { ...node, data: { ...node.data, scaleX: 1, scaleY: 1 } } : node)); }} style={{ fontSize: 10 }}>Reset</button>
                </div>
            )}

            {/* Handles positioned exactly at the rect border in the outer container */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    top: `${rectPos.top + rectPos.height / 2}px`,
                    left: `${rectPos.left}px`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    position: 'absolute',
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: `${rectPos.top + rectPos.height / 2}px`,
                    left: `${rectPos.left + rectPos.width}px`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    position: 'absolute',
                }}
            />
        </div>
    );
}
