import React from "react";

export default function ScalableIconNode({ data }) {
    const icon = data.icon;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                border: "1px solid #aaa",
                borderRadius: 6,
                background: "#fff",
                minWidth: 60,
                minHeight: 60,
            }}
        >
            {icon && (
                // if icon is a string (URL)
                typeof icon === "string" ? (
                    <img
                        src={icon}
                        alt="icon"
                        style={{ width: 40, height: 40, objectFit: "contain", marginBottom: 4 }}
                    />
                ) : (
                    // if icon is a React component
                    React.createElement(icon, { width: 40, height: 40, style: { marginBottom: 4 } })
                )
            )}
            <div style={{ fontSize: 12, textAlign: "center" }}>{data.label}</div>
        </div>
    );
}
