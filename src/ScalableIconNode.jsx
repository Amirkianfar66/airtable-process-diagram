// ScalableIconNode.jsx
import React, { useMemo } from "react";
import { getItemIcon } from "./IconManager";

export default function ScalableIconNode({ data = {} }) {
    const item = data?.item || null;

    // Remount the icon when important props change
    const revKey = useMemo(() => {
        if (!item) return "empty";
        return [
            item.TypeKey || "",
            item.Type || "",
            item.__iconRev || "",      // optional manual bump if you ever need it
            item.Icon || "",           // in case you switch by explicit icon name
            item.Category || "",       // safe extra dimension
        ].join("|");
    }, [item]);

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
            title={item?.Type || ""}
        >
            <div key={revKey} style={{ width: 40, height: 40 }}>
                {item ? getItemIcon(item, { width: 40, height: 40 }) : <div style={{ width: 40, height: 40 }} />}
            </div>
            <div style={{ fontSize: 12, textAlign: "center" }}>{data.label}</div>
        </div>
    );
}
