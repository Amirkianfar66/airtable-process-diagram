// InlineItemIcon.jsx
import React, { useState } from "react";

// Auto-import all SVGs in ./InlineItemIcon/*.svg (create this folder and drop inline-item SVGs)
const modules = import.meta.glob("./InlineItemIcon/*.svg", { eager: true });

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

export default function InlineItemIcon({ data }) {
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
                        ? <img src={Icon} alt={data?.Type || "inline item"} style={{ width: "100%", height: "100%" }} />
                        : <Icon style={{ width: "100%", height: "100%" }} />
                ) : (
                    <svg width="60" height="60" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="28" fill="#13c2c2" />
                        <rect x="45" y="95" width="110" height="10" rx="4" fill="#13c2c2" />
                    </svg>
                )}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{data?.label || ""}</div>
        </div>
    );
}
