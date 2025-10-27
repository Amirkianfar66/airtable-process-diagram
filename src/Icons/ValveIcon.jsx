// ValveIcon.jsx
import React, { useState } from "react";

// Auto-import all SVGs in ./ValveIcon/*.svg (create this folder and drop valve SVGs)
const modules = import.meta.glob("./ValveIcon/*.svg", { eager: true });

const icons = {};
for (const path in modules) {
    const fileBase = path.split("/").pop().replace(".svg", "");
    const key = fileBase.toLowerCase();
    const mod = modules[path];
    icons[key] = (typeof mod === "object" && typeof mod.default === "function")
        ? mod.default
        : (mod.default || mod);
}

const normalizeKey = (s) =>
    (s || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "");

export default function ValveIcon({ data }) {
    const [hovered, setHovered] = useState(false);
    const primaryKey = (data?.TypeKey || normalizeKey(data?.Type || "")).toLowerCase();

    const tries = [
        primaryKey,
        primaryKey.replace(/[_-]/g, ""),
        primaryKey.replace(/_/g, "-"),
        primaryKey.replace(/-/g, "_"),
    ];

    let Icon = null;
    for (const k of tries) {
        if (k && icons[k]) { Icon = icons[k]; break; }
    }

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative",
                width: 60,
                height: 110,
                background: "none",
                border: "none",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div style={{ width: 60, height: 60 }}>
                {Icon ? (
                    typeof Icon === "string"
                        ? <img src={Icon} alt={data?.Type || "valve"} style={{ width: "100%", height: "100%" }} />
                        : <Icon style={{ width: "100%", height: "100%" }} />
                ) : (
                    <svg width="60" height="60" viewBox="0 0 200 200">
                        <polygon points="60,80 100,100 60,120" fill="orange" stroke="orange" strokeWidth="1" />
                        <polygon points="140,80 100,100 140,120" fill="orange" stroke="orange" strokeWidth="1" />
                        <rect x="95" y="80" width="10" height="40" fill="orange" />
                    </svg>
                )}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{data?.label || ""}</div>
        </div>
    );
}
