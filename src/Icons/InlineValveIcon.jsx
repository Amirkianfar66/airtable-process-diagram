// File: InlineValveIcon.jsx
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

// Auto-import all SVGs from InlineValveIcon folder
const modules = import.meta.glob('./InlineValveIcon/*.svg', { eager: true });

const valveIcons = {};
for (const path in modules) {
    const fileBase = path.split('/').pop().replace('.svg', '');
    const name = fileBase.toLowerCase();
    const mod = modules[path];

    // support SVGR (component) or plain url
    if (typeof mod === 'object' && 'default' in mod && typeof mod.default === 'function') {
        valveIcons[name] = mod.default;
    } else {
        valveIcons[name] = mod.default || mod;
    }
}

// Normalizer used when fallback to data.Type is needed
const normalizeKey = (s) =>
    (s || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_') // map spaces -> underscores
        .replace(/[^a-z0-9_-]/g, ''); // remove other chars

export default function InlineValveIcon({ data }) {
    const [hovered, setHovered] = useState(false);
    const label = data?.label || '';

    // Prefer explicit TypeKey (saved from ItemDetailCard). Fallback to normalized Type name.
    const primaryKey = (data?.TypeKey || normalizeKey(data?.Type || '')).toString().toLowerCase();

    // Try a few variants to be tolerant to filename conventions:
    const keysToTry = [
        primaryKey,
        primaryKey.replace(/[_-]/g, ''),   // no separators
        primaryKey.replace(/_/g, '-'),     // underscores -> dashes
        primaryKey.replace(/-/g, '_'),     // dashes -> underscores
    ];

    let Icon = null;
    for (const k of keysToTry) {
        if (k && valveIcons[k]) {
            Icon = valveIcons[k];
            break;
        }
    }

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
            <div style={{ width: 60, height: 60 }}>
                {Icon ? (
                    typeof Icon === 'string' ? (
                        <img src={Icon} alt={data?.Type || 'valve'} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        // SVGR component
                        <Icon style={{ width: '100%', height: '100%' }} />
                    )
                ) : (
                    // fallback if no SVG found
                    <svg width="60" height="60" viewBox="0 0 200 200">
                        <polygon points="60,80 100,100 60,120" fill="orange" stroke="orange" strokeWidth="1" />
                        <polygon points="140,80 100,100 140,120" fill="orange" stroke="orange" strokeWidth="1" />
                        <text x="100" y="108" fontSize="16" textAnchor="middle" fill="black" fontFamily="sans-serif">
                            IV
                        </text>
                    </svg>
                )}
            </div>

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
                    width: 8,
                    height: 8,
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
                    width: 8,
                    height: 8,
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
