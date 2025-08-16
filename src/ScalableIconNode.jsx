import React from "react";

export default function ScalableIconNode({ data }) {
    const icon = data.icon;

    const renderIcon = () => {
        if (!icon) return <div style={{ width: 40, height: 40 }} />; // placeholder
        if (React.isValidElement(icon)) return React.cloneElement(icon, { width: 40, height: 40, style: { marginBottom: 4 } });
        if (typeof icon === "string") return <img src={icon} alt="icon" style={{ width: 40, height: 40, objectFit: "contain", marginBottom: 4 }} />;
        return null;
    };

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
                cursor: "pointer",
            }}
        >
            {renderIcon()}
            <div style={{ fontSize: 12, textAlign: "center" }}>{data.label}</div>
        </div>
    );
}
