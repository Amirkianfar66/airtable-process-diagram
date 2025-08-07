// ./CustomItemNode.jsx
import React from 'react';
import { Handle } from 'reactflow';

export default function CustomItemNode({ data }) {
    return (
        <div
            style={{
                border: '1px solid #555',
                borderRadius: 8,
                padding: 10,
                background: 'white',
                width: 150,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
            }}
        >
            {data.icon && (
                <div style={{ width: 24, height: 24 }}>
                    {data.icon}
                </div>
            )}
            <div style={{ fontSize: 12 }}>{data.label}</div>

            <Handle type="target" position="left" style={{ background: '#555' }} />
            <Handle type="source" position="right" style={{ background: '#555' }} />
        </div>
    );
}
