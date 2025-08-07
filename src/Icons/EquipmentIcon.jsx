import React, { useState, useRef } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ scaleX = 1, scaleY = 1 }) {
    const rectLeft = 20 * scaleX;
    const rectRight = (20 + 60) * scaleX;
    const rectTopMid = 20 * scaleY + (60 * scaleY) / 2;

    const [showHandles, setShowHandles] = useState(false);
    const timeoutRef = useRef(null);

    const edgeThreshold = 15; // px near border to trigger

    const clearHideTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const startHideTimeout = () => {
        clearHideTimeout();
        timeoutRef.current = setTimeout(() => {
            setShowHandles(false);
            timeoutRef.current = null;
        }, 3000);
    };

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        if (mouseX <= edgeThreshold || mouseX >= rect.width - edgeThreshold) {
            // Mouse near border: show handles and clear timeout
            if (!showHandles) setShowHandles(true);
            clearHideTimeout();
        } else {
            // Mouse away from border inside the element: start hide timer
            if (showHandles && !timeoutRef.current) {
                startHideTimeout();
            }
        }
    };

    const handleMouseLeave = () => {
        clearHideTimeout();
        setShowHandles(false);
    };

    return (
        <div
            style={{ position: 'relative', width: 100 * scaleX, height: 100 * scaleY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Scaled SVG */}
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: 100,
                    height: 100,
                }}
            >
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                    <text x="50" y="55" fontSize="16" textAnchor="middle" fill="white">
                        EQ
                    </text>
                </svg>
            </div>

            {/* Handles NOT scaled, show only when mouse near border */}
            {showHandles && (
                <>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="left"
                        style={{
                            position: 'absolute',
                            top: rectTopMid,
                            left: rectLeft,
                            transform: 'translate(-50%, -50%)',
                            width: 12,
                            height: 12,
                            background: 'red',
                            borderRadius: '50%',
                            zIndex: 10,
                        }}
                    />
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="right"
                        style={{
                            position: 'absolute',
                            top: rectTopMid,
                            left: rectRight,
                            transform: 'translate(-50%, -50%)',
                            width: 12,
                            height: 12,
                            background: 'blue',
                            borderRadius: '50%',
                            zIndex: 10,
                        }}
                    />
                </>
            )}
        </div>
    );
}
