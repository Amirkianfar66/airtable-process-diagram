//ScalableIconNode.jsx
import React from "react";
import { getItemIcon } from "./IconManager";

export default function ScalableIconNode({ data }) {
    const renderIcon = () => {
        if (!data.item) return <div style={{ width: 40, height: 40 }} />;

        return getItemIcon(data.item, { width: 40, height: 40 });
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                borderRadius: 6,
                background: "transparent",
                minWidth: 60,
                minHeight: 60,
                cursor: "pointer",
            }}
        >
            {renderIcon()}
            <div style={{ fontSize: 12, textAlign: "center" }}>{data.label}</div>
        </div>
    );
}
