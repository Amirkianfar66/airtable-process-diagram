// ScalableIconNode.jsx
import React from "react";
import { getItemIcon } from "./IconManager";

export default function ScalableIconNode({ data }) {
    const code =
        data?.item?.Code ||
        data?.item?.["Item Code"] ||
        (data?.label ? String(data.label).split(" - ")[0] : "");

    const iconEl = data?.item ? getItemIcon(data.item, { width: 40, height: 40 }) : null;

    return (
        <div
            style={{
                position: "relative",
                display: "inline-block", // wrapper will size to the icon
                background: "transparent",
                cursor: "pointer",
            }}
        >
            {/* Top-centered code badge */}
            {code ? (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: "50%",
                        transform: "translate(-50%, -100%)", // sit just above icon top
                        fontSize: 12,
                        lineHeight: 1,
                        padding: "2px 6px",
                        background: "rgba(255,255,255,0.85)",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                    }}
                >
                    {code}
                </div>
            ) : null}

            {iconEl}

            {/* remove the old bottom text label entirely */}
        </div>
    );
}
