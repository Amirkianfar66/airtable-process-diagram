// TransformCard.jsx (minimal pivot UI)
import React from "react";

export default function TransformCard({
    node,                   // selected RF node
    onMoveNode,             // (id, {x,y})
    onSetAltitude,          // (id, altitudeY)
    onSetPivot,             // (id, {x,y,z})
    step = 10,              // move step for X/Z/Y buttons
}) {
    if (!node) return null;

    const item = node?.data?.item || {};
    const pivot = (node.data && node.data.pivot) || { x: 0, y: 0, z: 0 };
    const altY = Number(node?.data?.altitude ?? 20);

    // RF <-> world mapping (worldX = RF.x, worldZ = -RF.y)
    const worldX = Number(node?.position?.x || 0);
    const worldZ = -Number(node?.position?.y || 0);

    const setAxis = (axis, val) => {
        const v = Number.isFinite(val) ? val : 0;
        if (axis === "x") onMoveNode?.(node.id, { x: v, y: node.position?.y || 0 });
        if (axis === "z") onMoveNode?.(node.id, { x: node.position?.x || 0, y: -v });
        if (axis === "y") onSetAltitude?.(node.id, v);
    };

    const Btn = ({ children, onClick, primary }) => (
        <button
            onClick={onClick}
            style={{
                padding: "2px 8px",
                border: "1px solid #ccc",
                borderRadius: 6,
                background: primary ? "#fff" : "#f7f7f7",
                cursor: "pointer",
            }}
        >
            {children}
        </button>
    );

    const MoveRow = ({ label, value, onChange }) => (
        <div style={{ display: "grid", gridTemplateColumns: "30px 120px auto", gap: 8, alignItems: "center" }}>
            <strong style={{ textAlign: "center" }}>{label}</strong>
            <input
                type="number"
                value={Number(value ?? 0)}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") onChange(parseFloat(e.currentTarget.value)); }}
                style={{ width: 120, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn onClick={() => onChange((value ?? 0) - step)}>−{step}</Btn>
                <Btn onClick={() => onChange((value ?? 0) - 1)}>−1</Btn>
                <Btn primary onClick={() => onChange(0)}>0</Btn>
                <Btn onClick={() => onChange((value ?? 0) + 1)}>+1</Btn>
                <Btn onClick={() => onChange((value ?? 0) + step)}>+{step}</Btn>
            </div>
        </div>
    );

    return (
        <div style={{
            padding: 16,
            borderBottom: "1px solid #eee",
            fontSize: 12,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
            margin: 12
        }}>
            {/* header */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#667" }}>Selected item</div>
                <div style={{ fontWeight: 600 }}>
                    {(item["Item Code"] || item.Code || node.id)} {item.Name || ""}
                </div>
            </div>

            {/* MOVE */}
            <div style={{ margin: "10px 0 8px", fontWeight: 600 }}>Move (World X / Y / Z)</div>
            <div style={{ display: "grid", rowGap: 8 }}>
                <MoveRow label="X" value={worldX} onChange={(v) => setAxis("x", v)} />
                <MoveRow label="Y" value={altY} onChange={(v) => setAxis("y", v)} />
                <MoveRow label="Z" value={worldZ} onChange={(v) => setAxis("z", v)} />
            </div>

            {/* PIVOT — minimal: only 3 inputs, no helper buttons */}
            <div style={{ margin: "16px 0 8px", fontWeight: 600 }}>Pivot (Local offset)</div>
            <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 30px 1fr 30px 1fr", columnGap: 8, rowGap: 8 }}>
                <div style={{ textAlign: "center", alignSelf: "center" }}>X</div>
                <input
                    type="number"
                    value={Number(pivot.x || 0)}
                    onChange={(e) => onSetPivot?.(node.id, { ...pivot, x: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                />
                <div style={{ textAlign: "center", alignSelf: "center" }}>Y</div>
                <input
                    type="number"
                    value={Number(pivot.y || 0)}
                    onChange={(e) => onSetPivot?.(node.id, { ...pivot, y: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                />
                <div style={{ textAlign: "center", alignSelf: "center" }}>Z</div>
                <input
                    type="number"
                    value={Number(pivot.z || 0)}
                    onChange={(e) => onSetPivot?.(node.id, { ...pivot, z: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                />
            </div>
        </div>
    );
}
