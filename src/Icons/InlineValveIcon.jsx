// File: InlineValveIcon.jsx
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

// Auto-import all SVGs from InlineValveIcon folder
const modules = import.meta.glob('./InlineValveIcon/*.svg', { eager: true });

const valveIcons = {};
for (const path in modules) {
    const name = path.split('/').pop().replace('.svg', '').toLowerCase();
    const mod = modules[path];

    if (typeof mod === 'object' && 'default' in mod && typeof mod.default === 'function') {
        valveIcons[name] = mod.default; // SVGR component
    } else {
        valveIcons[name] = mod.default || mod; // URL fallback
    }
}

export default function InlineValveIcon({ data }) {
    const [hovered, setHovered] = useState(false);
    const label = data?.label || '';

    // normalize type name
    const key = data?.Type?.toLowerCase();
    const Icon = key && valveIcons[key] ? valveIcons[key] : null;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: 60,
                height: 110,
                background: 'none',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {Icon ? (
                typeof Icon === 'string' ? (
                    <img src={Icon} alt={data?.Type || 'valve'} style={{ width: 60, height: 60 }} />
                ) : (
                    <Icon style={{ width: 60, height: 60 }} />
                )
            ) : (
                // fallback if no SVG found
                <svg width="60" height="60" viewBox="0 0 200 200">
                    <polygon points="60,80 100,100 60,120" fill="orange" stroke="orange" strokeWidth="1" />
                    <polygon points="140,80 100,100 140,120" fill="orange" stroke="orange" strokeWidth="1" />
                    <text
                        x="100"
                        y="108"
                        fontSize="16"
                        textAnchor="middle"
                        fill="black"
                        fontFamily="sans-serif"
                    >
                        IV
                    </text>
                </svg>
            )}

            {/* Label */}
            <div
                style={{
                    fontSize: 13,
                    marginTop: -15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#333',
                    width: '100%',
                    textAlign: 'left',
                    paddingLeft: 5,
                }}
            >
                {label.substring(0, 5)}
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    top: 60,
                    left: -1,
                    width: 2,
                    height: 2,
                    borderRadius: '50%',
                    background: 'red',
                    border: '1px solid white',
                    opacity: hovered ? 1 : 0.4,
                    position: 'absolute',
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    top: 60,
                    right: -1,
                    width: 2,
                    height: 2,
                    borderRadius: '50%',
                    background: 'blue',
                    border: '1px solid white',
                    opacity: hovered ? 1 : 0.4,
                    position: 'absolute',
                }}
            />
        </div>
    );
}
