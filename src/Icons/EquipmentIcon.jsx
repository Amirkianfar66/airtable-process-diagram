import React, { useState, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import EquipmentIcon from './EquipmentIcon'; // Pure icon, no handles

export default function EquipmentNode({ data, scaleX = 1, scaleY = 1 }) {
    const [showHandles, setShowHandles] = useState(false);
    const timeoutRef = useRef(null);

    const clearTimeoutFn = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const startTimeout = () => {
        clearTimeoutFn();
        timeoutRef.current = setTimeout(() => {
            setShowHandles(false);
            timeoutRef.current = null;
        }, 3000);
    };

    const onMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const edgeThreshold = 15;

        if (mouseX <= edgeThreshold || mouseX >= rect.width - edgeThreshold) {
            if (!showHandles) setShowHandles(true);
            clearTimeoutFn();
        } else {
            if (showHandles && !timeoutRef.current) {
                startTimeout();
            }
        }
    };

    const onMouseLeave = () => {
        clearTimeoutFn();
        setShowHandles(false);
    };

    // Positions of handles on scaled rectangle
    const rectLeft = 20 * scaleX;
    const rectRight = (20 + 60) * scaleX;
    const rectTopMid = 20 * scaleY + (60 * scaleY) / 2;

    return (
        <div
            style={{
                position: 'relative',
                width: 100 * scaleX,
                height: 100 * scaleY,
                backgroundColor: '#eee',
                cursor: 'default',
            }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        >
            {/* Scaled icon */}
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: 100,
                    height: 100,
                    pointerEvents: 'none', // so mouse events bubble to container div
                }}
            >
                <EquipmentIcon />
            </div>

            {/* Handles only shown when hovering near edges */}
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
                            width: 16,
                            height: 16,
                            background: 'red',
                            borderRadius: '50%',
                            zIndex: 9999,
                            border: '2px solid white',
                            boxShadow: '0 0 4px black',
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
                            width: 16,
                            height: 16,
                            background: 'blue',
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
