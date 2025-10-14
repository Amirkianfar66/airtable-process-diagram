// TransformCard.jsx
import React from "react";

export default function TransformCard({
    node,                      // the selected RF node
    onMoveNode,                // (id, {x,y})
    onSetAltitude,             // (id, altitudeY)
    onSetPivot,                // (id, {x,y,z})
    step = 10,
}) {
    if (!node) return null;
    const pivot = (node.data && node.data.pivot) || { x: 0, y: 0, z: 0 };
    const altitude = Number(node?.data?.altitude ?? 20);

    // World X = RF x; World Z = -RF y
    const worldX = Number(node?.position?.x || 0);
    const worldZ = -Number(node?.position?.y || 0);

    const setAxis = (axis, val) => {
        const v = Number.isFinite(val) ? val : 0;
        if (axis === "x") onMoveNode?.(node.id, { x: v, y: node.position?.y || 0 });
        else if (axis === "z") onMoveNode?.(node.id, { x: node.position?.x || 0, y: -v });
        else if (axis === "y") onSetAltitude?.(node.id, v);
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

    const Row = ({ axis, label, value, onChange }) => (
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
        <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Item</div>
                <div style={{ fontWeight: 600 }}>
                    {(node?.data?.item?.["Item Code"] || node?.data?.item?.Code || node?.id) + " "}
                    {(node?.data?.item?.Name || "")}
                </div>
            </div>

            <div style={{ marginBottom: 10, fontWeight: 600 }}>Move (X / Y / Z)</div>
            <div style={{ display: "grid", rowGap: 8 }}>
                <Row axis="x" label="X" value={worldX} onChange={(v) => setAxis("x", v)} />
                <Row axis="y" label="Y" value={altitude} onChange={(v) => setAxis("y", v)} />
                <Row axis="z" label="Z" value={worldZ} onChange={(v) => setAxis("z", v)} />
            </div>

            <div style={{ marginTop: 16, marginBottom: 10, fontWeight: 600 }}>Pivot (local)</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 80px 80px 80px", gap: 6 }}>
                <div style={{ opacity: 0.7, alignSelf: "center" }}>Offset</div>
                {["x", "y", "z"].map((axis) => (
                    <input
                        key={axis}
                        type="number"
                        value={Number(pivot?.[axis] || 0)}
                        onChange={(e) => {
                            const v = Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0;
                            onSetPivot?.(node.id, { ...pivot, [axis]: v });
                        }}
                        style={{ width: 70, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                    />
                ))}
            </div>
        </div>
    );
}
