// ValveIcon.jsx
import React from "react";
import { Handle, Position } from "reactflow";

export default function ValveIcon({ data }) {
    const handleStyle = {
        width: 10,
        height: 10,
        background: "#1677ff",
        border: "2px solid white",
    };

    return (
        <div style={{ position: "relative", width: 60, height: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Handle id="left" type="target" position={Position.Left} style={{ ...handleStyle }} />
            <Handle id="right" type="source" position={Position.Right} style={{ ...handleStyle }} />

            {/* placeholder glyph – swap with your SVG like you did for InlineItem */}
            <svg width="60" height="60" viewBox="0 0 200 200">
                <polygon points="70,100 100,70 130,100 100,130" fill="#1677ff" />
                <rect x="20" y="95" width="160" height="10" rx="4" fill="#1677ff" />
            </svg>

            <div style={{ fontSize: 12, marginTop: 6 }}>{data?.label || ""}</div>
        </div>
    );
}
