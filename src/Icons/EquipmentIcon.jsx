import React, { useState, useRef } from 'react';
import { Handle, Position } from 'reactflow';

export default function EquipmentIcon({ scaleX = 1, scaleY = 1 }) {
    const rectLeft = 20 * scaleX;
    const rectRight = (20 + 60) * scaleX;
    const rectTop = 20 * scaleY;
    const rectBottom = (20 + 60) * scaleY;
    const rectTopMid = rectTop + (60 * scaleY) / 2;
    const rectLeftMid = rectLeft;
    const rectRightMid = rectRight;
    const rectMiddleTop = rectTop + 30 * scaleY; // middle Y for top/bottom handles

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
        const mouseY = e.clientY - rect.top;

        // Show handles if mouse near any border (left, right, top, bottom)
        const nearLeft = mouseX <= edgeThreshold;
        const nearRight = mouseX >= rect.width - edgeThreshold;
        const nearTop = mouseY <= edgeThreshold;
        const nearBottom = mouseY >= rect.height - edgeThreshold;

        if (nearLeft || nearRight || nearTop || nearBottom) {
            if (!showHandles) setShowHandles(true);
            clearHideTimeout();
        } else {
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
            style={{ position: 'relative', width: 100 * scaleX, height: 100 * scaleY, backgroundColor: '#eee' }}
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

            {/* Handles NOT scaled, show only when mouse near any border */}
            {showHandles && (
                <>
                    {/* Left handle */}
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="left"
                        style={{
                            position: 'absolute',
                            top: rectTopMid,
                            left: rectLeft,
                            transform: 'translate(-50%, -50%)',
                            width: 16,
                            height: 16,
                            background: 'red',
                            borderRadius: '50%',
                            zIndex: 9999,
                            border: '2px solid white',
                            boxShadow: '0 0 4px black',
                        }}
                    />
                    {/* Right handle */}
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="right"
                        style={{
                            position: 'absolute',
                            top: rectTopMid,
                            left: rectRight,
                            transform: 'translate(-50%, -50%)',
                            width: 16,
                            height: 16,
                            background: 'blue',
                            borderRadius: '50%',
                            zIndex: 9999,
                            border: '2px solid white',
                            boxShadow: '0 0 4px black',
                        }}
                    />
                    {/* Top handle */}
                    <Handle
                        type="target"
                        position={Position.Top}
                        id="top"
                        style={{
                            position: 'absolute',
                            top: rectTop,
                            left: rectLeft + 30 * scaleX,
                            transform: 'translate(-50%, -50%)',
                            width: 16,
                            height: 16,
                            background: 'orange',
                            borderRadius: '50%',
                            zIndex: 9999,
                            border: '2px solid white',
                            boxShadow: '0 0 4px black',
                        }}
                    />
                    {/* Bottom handle */}
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="bottom"
                        style={{
                            position: 'absolute',
                            top: rectBottom,
                            left: rectLeft + 30 * scaleX,
                            transform: 'translate(-50%, -50%)',
                            width: 16,
                            height: 16,
                            background: 'purple',
                            borderRadius: '50%',
                            zIndex: 9999,
                            border: '2px solid white',
                            boxShadow: '0 0 4px black',
                        }}
                    />
                </>
            )}
        </div>
    );
}
