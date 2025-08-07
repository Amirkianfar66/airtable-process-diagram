import React, { useEffect, useState, useRef } from 'react';
import { Handle } from 'reactflow';
import EquipmentIcon from '../icons/Equipment';

const ICON_WIDTH = 100;
const ICON_HEIGHT = 100;

const ScalableIconNode = ({ data, selected }) => {
    const [scaleX, setScaleX] = useState(1);
    const [scaleY, setScaleY] = useState(1);
    const [showButtons, setShowButtons] = useState(false);
    const hoverTimer = useRef(null);

    const handleMouseEnter = () => {
        setShowButtons(true);
        clearTimeout(hoverTimer.current);
    };

    const handleMouseLeave = () => {
        hoverTimer.current = setTimeout(() => {
            setShowButtons(false);
        }, 3000); // 3 seconds
    };

    const handleScaleXUp = () => setScaleX(prev => prev + 0.1);
    const handleScaleXDown = () => setScaleX(prev => Math.max(0.1, prev - 0.1));
    const handleScaleYUp = () => setScaleY(prev => prev + 0.1);
    const handleScaleYDown = () => setScaleY(prev => Math.max(0.1, prev - 0.1));
    const resetScale = () => {
        setScaleX(1);
        setScaleY(1);
    };

    const width = ICON_WIDTH * scaleX;
    const height = ICON_HEIGHT * scaleY;

    const centerX = width / 2;
    const centerY = height / 2;

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                width,
                height,
                transformOrigin: 'top left',
                position: 'relative',
            }}
        >
            <div
                style={{
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'top left',
                    width: ICON_WIDTH,
                    height: ICON_HEIGHT,
                }}
            >
                <EquipmentIcon width={ICON_WIDTH} height={ICON_HEIGHT} />
            </div>

            {/* Top Center Handle */}
            <Handle
                type="target"
                position="top"
                style={{
                    left: centerX - 5,
                    top: -10,
                    width: 10,
                    height: 10,
                    background: 'blue',
                    position: 'absolute',
                }}
            />
            {/* Bottom Center Handle */}
            <Handle
                type="source"
                position="bottom"
                style={{
                    left: centerX - 5,
                    top: height,
                    width: 10,
                    height: 10,
                    background: 'blue',
                    position: 'absolute',
                }}
            />
            {/* Left Center Handle */}
            <Handle
                type="target"
                position="left"
                style={{
                    top: centerY - 5,
                    left: -10,
                    width: 10,
                    height: 10,
                    background: 'blue',
                    position: 'absolute',
                }}
            />
            {/* Right Center Handle */}
            <Handle
                type="source"
                position="right"
                style={{
                    top: centerY - 5,
                    left: width,
                    width: 10,
                    height: 10,
                    background: 'blue',
                    position: 'absolute',
                }}
            />

            {showButtons && (
                <div
                    style={{
                        position: 'absolute',
                        top: -30,
                        left: 0,
                        display: 'flex',
                        gap: '5px',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        padding: '4px',
                        borderRadius: '4px',
                        zIndex: 10,
                    }}
                >
                    <button onClick={handleScaleXUp}>+X</button>
                    <button onClick={handleScaleXDown}>-X</button>
                    <button onClick={handleScaleYUp}>+Y</button>
                    <button onClick={handleScaleYDown}>-Y</button>
                    <button onClick={resetScale}>Reset</button>
                </div>
            )}
        </div>
    );
};

export default ScalableIconNode;
