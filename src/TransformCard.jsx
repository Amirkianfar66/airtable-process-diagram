// TransformCard.jsx — minimal UI (no step buttons)
import React from "react";

export default function TransformCard({
    node,             // selected RF node
    onMoveNode,       // (id, {x,y})
    onSetAltitude,    // (id, altitudeY)
    onSetPivot,       // (id, {x,y,z})
}) {
    if (!node) return null;

    const item = node?.data?.item || {};
    const pivot = (node.data && node.data.pivot) || { x: 0, y: 0, z: 0 };
    const altY = Number(node?.data?.altitude ?? 20);

    // RF <-> world mapping (worldX = RF.x, worldZ = -RF.y)
    const worldX = Number(node?.position?.x || 0);
    const worldZ = -Number(node?.position?.y || 0);

    // local UI state so you can type freely; commit on Enter/blur
    const [mx, setMx] = React.useState(worldX);
    const [my, setMy] = React.useState(altY);
    const [mz, setMz] = React.useState(worldZ);

    React.useEffect(() => {
        setMx(worldX);
        setMy(altY);
        setMz(worldZ);
    }, [worldX, altY, worldZ, node?.id]);

    const commitAxis = (axis, val) => {
        const v = Number.isFinite(val) ? val : 0;
        if (axis === "x") onMoveNode?.(node.id, { x: v, y: node.position?.y || 0 });
        if (axis === "z") onMoveNode?.(node.id, { x: node.position?.x || 0, y: -v });
        if (axis === "y") onSetAltitude?.(node.id, v);
    };

    const Input = ({ value, setValue, onCommit, width = 120 }) => (
        <input
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            onBlur={() => onCommit(value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCommit(value); }}
            style={{ width, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
        />
    );

    const Row = ({ label, children }) => (
        <div style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr",
            alignItems: "center",
            gap: 10
        }}>
            <strong style={{ textAlign: "center" }}>{label}</strong>
            <div>{children}</div>
        </div>
    );

    return (
        <div style={{
            margin: 12,
            padding: 16,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 10,
            boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
            fontSize: 12
        }}>
            {/* header */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#667" }}>Selected item</div>
                <div style={{ fontWeight: 600 }}>
                    {(item["Item Code"] || item.Code || node.id)} {item.Name || ""}
                </div>
            </div>

            {/* MOVE (World) */}
            <div style={{ margin: "10px 0 8px", fontWeight: 600 }}>Move (World X / Y / Z)</div>
            <div style={{ display: "grid", rowGap: 8 }}>
                <Row label="X">
                    <Input value={mx} setValue={setMx} onCommit={(v) => commitAxis("x", v)} />
                </Row>
                <Row label="Y">
                    <Input value={my} setValue={setMy} onCommit={(v) => commitAxis("y", v)} />
                </Row>
                <Row label="Z">
                    <Input value={mz} setValue={setMz} onCommit={(v) => commitAxis("z", v)} />
                </Row>
            </div>

            {/* PIVOT (Local) */}
            <div style={{ margin: "16px 0 8px", fontWeight: 600 }}>Pivot (Local offset)</div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 28px 1fr 28px 1fr",
                columnGap: 10,
                rowGap: 8,
                alignItems: "center"
            }}>
                <strong style={{ textAlign: "center" }}>X</strong>
                <input
                    type="number"
                    value={Number(pivot.x || 0)}
                    onChange={(e) => onSetPivot?.(node.id, { ...pivot, x: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                />
                <strong style={{ textAlign: "center" }}>Y</strong>
                <input
                    type="number"
                    value={Number(pivot.y || 0)}
                    onChange={(e) => onSetPivot?.(node.id, { ...pivot, y: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                />
                <strong style={{ textAlign: "center" }}>Z</strong>
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
