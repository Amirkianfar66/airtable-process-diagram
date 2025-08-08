import React, { useState, useEffect } from 'react';

export default function EquipmentIcon({ data, scaleX = 1, scaleY = 1 }) {
    const [scale, setScale] = useState(1);
    const [showButtons, setShowButtons] = useState(false);

    const handleClick = () => {
        setShowButtons(true);
        setTimeout(() => setShowButtons(false), 2000);
    };

    const handleScaleUp = () => setScale((prev) => prev * 1.2);
    const handleReset = () => setScale(1);

    const width = 60 * scale;
    const height = 60 * scale;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={handleClick}>
            <svg width={width} height={height}>
                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill="white"
                    stroke="black"
                    strokeWidth={2}
                />
                <circle
                    cx={width / 2}
                    cy={height / 2}
                    r={width / 4}
                    fill="none"
                    stroke="black"
                    strokeWidth={2}
                />
            </svg>

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
                {data?.label?.substring(0, 5)}
            </div>

            {/* Buttons */}
            {showButtons && (
                <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                    <button onClick={handleScaleUp}>Scale</button>
                    <button onClick={handleReset}>Reset</button>
                </div>
            )}
        </div>
    );
}
