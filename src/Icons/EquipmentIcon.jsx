import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { x = 0, y = 0, scaleX = 1, scaleY = 1 } = data;
    const iconRef = useRef(null);
    const [rect, setRect] = useState({ left: 0, top: 0, right: 0, bottom: 0 });

    useEffect(() => {
        if (iconRef.current) {
            const iconRect = iconRef.current.getBoundingClientRect();
            setRect({
                left: iconRect.left,
                top: iconRect.top,
                right: iconRect.right,
                bottom: iconRect.bottom,
            });
        }
    }, [scaleX, scaleY]);

    const handleSize = 10; // fixed size

    return (
        <div style={{ position: 'relative', width: 100 * scaleX, height: 100 * scaleY }}>
            <svg
                ref={iconRef}
                width={100 * scaleX}
                height={100 * scaleY}
                viewBox="0 0 100 100"
                style={{ display: 'block' }}
            >
                <rect x={20} y={20} width={60} height={60} fill="green" stroke="black" strokeWidth="2" />
            </svg>

            {/* Top Handle */}
            <Handle
                type="source"
                position={Position.Top}
                id="top"
                style={{
                    position: 'absolute',
                    left: `calc(50% - ${handleSize / 2}px)`,
                    top: -handleSize / 2,
                    width: handleSize,
                    height: handleSize,
                    background: 'black',
                    border: 'none',
                }}
            />

            {/* Bottom Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                style={{
                    position: 'absolute',
                    left: `calc(50% - ${handleSize / 2}px)`,
                    bottom: -handleSize / 2,
                    width: handleSize,
                    height: handleSize,
                    background: 'black',
                    border: 'none',
                }}
            />

            {/* Left Handle */}
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                style={{
                    position: 'absolute',
                    left: -handleSize / 2,
                    top: `calc(50% - ${handleSize / 2}px)`,
                    width: handleSize,
                    height: handleSize,
                    background: 'black',
                    border: 'none',
                }}
            />

            {/* Right Handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    position: 'absolute',
                    right: -handleSize / 2,
                    top: `calc(50% - ${handleSize / 2}px)`,
                    width: handleSize,
                    height: handleSize,
                    background: 'black',
                    border: 'none',
                }}
            />
        </div>
    );
}
