// InlineValveIcon.jsx
import React from 'react';

export default function InlineValveIcon({ data }) {
    return (
        <div
            style={{
                position: 'relative',
                width: 100,
                height: 100,
                background: 'none',
                border: 'none',
                borderRadius: 8,
            }}
        >
            <svg width="100" height="100" viewBox="0 0 200 200">
                {/* Bow-tie shape with half-height wings */}
                <polygon
                    points="60,80 100,100 60,120"
                    fill="none"
                    stroke="orange"
                    strokeWidth="4"
                />
                <polygon
                    points="140,80 100,100 140,120"
                    fill="none"
                    stroke="orange"
                    strokeWidth="4"
                />

                {/* Label stays centered */}
                <text
                    x="100"
                    y="108"
                    fontSize="16"
                    textAnchor="middle"
                    fill="white"
                    fontFamily="sans-serif"
                >
                    IV
                </text>
            </svg>
        </div>
    );
}
