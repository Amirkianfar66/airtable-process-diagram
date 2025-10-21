// EquipmentIcon.jsx — with Edit button + Line / Circle / Rect annotate tools
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Handle, Position, useReactFlow } from "reactflow";

// --- auto-import your SVGs (adjust the glob path if needed) ---
const modules = import.meta.glob("./EquipmentIcon/*.svg", { eager: true });

const typeIcons = {};
for (const path in modules) {
    const name = path.split("/").pop().replace(".svg", "").toLowerCase();
    const mod = modules[path];
    typeIcons[name] = (mod && mod.default) || mod;
}

const normalizeKey = (s) =>
    (s || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "");

const pickIcon = (data) => {
    const primary = (data?.TypeKey || normalizeKey(data?.Type || "")).toLowerCase();
    const cleaned = primary
        .replace(/\(.+?\)/g, "")
        .replace(/_+from_.+$/, "")
        .replace(/[_-]+$/, "")
        .trim();
    const baseWord = cleaned.split(/[_-]/)[0] || cleaned;
    const keysToTry = [
        primary,
        cleaned,
        cleaned.replace(/[_-]/g, ""),
        cleaned.replace(/_/g, "-"),
        cleaned.replace(/-/g, "_"),
        baseWord,
    ];
    for (const k of keysToTry) if (k && typeIcons[k]) return typeIcons[k];
    return null;
};

// ----- overlay renderer (reads saved shapes) -----
function Overlay({ overlays = [] }) {
    return (
        <svg
            width="150"
            height="150"
            viewBox="0 0 150 150"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
            {overlays.map((o, i) => {
                const common = {
                    key: i,
                    stroke: o.stroke ?? "#222",
                    strokeWidth: o.strokeWidth ?? 2,
                    fill: o.fill ?? "none",
                };
                if (o.type === "line") return <line {...common} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} />;
                if (o.type === "rect") return <rect {...common} x={o.x} y={o.y} width={o.w} height={o.h} />;
                if (o.type === "circle") return <circle {...common} cx={o.cx} cy={o.cy} r={o.r} />;
                return null;
            })}
        </svg>
    );
}

// pointer → local SVG coords
function svgPointFromEvent(evt, svgEl) {
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svgEl.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
}

export default function EquipmentIcon({ id, data }) {
    const { setNodes } = useReactFlow();

    // UI state
    const [hovered, setHovered] = useState(false);
    const [editing, setEditing] = useState(false);       // toggled by the "Edit" button
    const [tool, setTool] = useState("line");            // 'line' | 'circle' | 'rect'
    const [scale, setScale] = useState(data?.scale || 1);

    // overlay data
    const [overlays, setOverlays] = useState(() => (Array.isArray(data?.overlays) ? data.overlays : []));
    const [draft, setDraft] = useState(null); // current shape being drawn

    const svgRef = useRef(null);
    const hoverHide = useRef(null);

    // keep scale in sync with node data
    useEffect(() => {
        if (data?.scale !== undefined && data.scale !== scale) setScale(data.scale);
    }, [data?.scale]);

    // pull overlays from node data on re-render
    useEffect(() => {
        if (Array.isArray(data?.overlays)) setOverlays(data.overlays);
    }, [data?.overlays]);

    useEffect(() => () => hoverHide.current && clearTimeout(hoverHide.current), []);

    // ✅ when editing toggles, disable RIGHT pan on the canvas (zoom still works)
    useEffect(() => {
        window.rfDisableRightPan?.(editing);
        return () => window.rfDisableRightPan?.(false);
    }, [editing]);

    // ✅ while editing, also prevent this node from being dragged
    useEffect(() => {
        setNodes((nodes) =>
            nodes.map((n) => (n.id === id ? { ...n, draggable: !editing } : n))
        );
    }, [editing, id, setNodes]);

    const Icon = useMemo(() => pickIcon(data), [data?.TypeKey, data?.Type]);

    // persist helper
    const persistOverlays = (next) => {
        setOverlays(next);
        setNodes((nodes) =>
            nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, overlays: next } } : n))
        );
    };

    // scale helpers
    const updateScale = (newScale) => {
        setScale(newScale);
        setNodes((nodes) =>
            nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, scale: newScale } } : n))
        );
    };
    const onScale = (e) => { e.stopPropagation(); updateScale(scale * 2); };
    const onReset = (e) => { e.stopPropagation(); updateScale(1); };

    // hover helpers
    const onEnter = () => {
        if (hoverHide.current) clearTimeout(hoverHide.current);
        setHovered(true);
    };
    const onLeave = () => {
        hoverHide.current = setTimeout(() => setHovered(false), 800);
    };

    // drawing handlers
    const onPointerDown = (e) => {
        if (!editing || !svgRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const p = svgPointFromEvent(e, svgRef.current);

        if (tool === "line") {
            setDraft({ type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: "#222", strokeWidth: 2 });
        } else if (tool === "rect") {
            setDraft({ type: "rect", x: p.x, y: p.y, w: 0, h: 0, stroke: "#222", strokeWidth: 2, fill: "none" });
        } else if (tool === "circle") {
            setDraft({ type: "circle", cx: p.x, cy: p.y, r: 0, stroke: "#222", strokeWidth: 2, fill: "none" });
        }
    };

    const onPointerMove = (e) => {
        if (!editing || !draft || !svgRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const p = svgPointFromEvent(e, svgRef.current);

        setDraft((d) => {
            if (!d) return d;
            if (d.type === "line") return { ...d, x2: p.x, y2: p.y };
            if (d.type === "rect") return { ...d, w: Math.max(0, p.x - d.x), h: Math.max(0, p.y - d.y) };
            if (d.type === "circle") {
                const dx = p.x - d.cx, dy = p.y - d.cy;
                return { ...d, r: Math.hypot(dx, dy) };
            }
            return d;
        });
    };

    const onPointerUp = (e) => {
        if (!editing || !draft) return;
        e.preventDefault();
        e.stopPropagation();
        const finalized = draft;
        setDraft(null);
        persistOverlays([...overlays, finalized]);
    };

    const clearAll = () => {
        if (!window.confirm("Clear all annotations for this equipment?")) return;
        persistOverlays([]);
    };

    const undoOne = () => {
        if (!overlays.length) return;
        persistOverlays(overlays.slice(0, -1));
    };
    const handleDown = (e) => {
        if (!editing || !svgRef.current) return;
        if (e.button !== 0) return; // only left button draws
        e.preventDefault();
        e.stopPropagation();

        // keep receiving move/up even if pointer leaves the SVG
        try { svgRef.current.setPointerCapture(e.pointerId); } catch { }

        const p = svgPointFromEvent(e, svgRef.current);
        if (tool === "line") {
            setDraft({ type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: "#222", strokeWidth: 2 });
        } else if (tool === "rect") {
            setDraft({ type: "rect", x: p.x, y: p.y, w: 0, h: 0, stroke: "#222", strokeWidth: 2, fill: "none" });
        } else if (tool === "circle") {
            setDraft({ type: "circle", cx: p.x, cy: p.y, r: 0, stroke: "#222", strokeWidth: 2, fill: "none" });
        }
    };

    const handleMove = (e) => {
        if (!editing || !draft || !svgRef.current) return;
        e.preventDefault();
        e.stopPropagation();

        const p = svgPointFromEvent(e, svgRef.current);
        setDraft((d) => {
            if (!d) return d;
            if (d.type === "line") return { ...d, x2: p.x, y2: p.y };
            if (d.type === "rect") return { ...d, w: Math.max(0, p.x - d.x), h: Math.max(0, p.y - d.y) };
            if (d.type === "circle") return { ...d, r: Math.hypot(p.x - d.cx, p.y - d.cy) };
            return d;
        });
    };

    const handleUp = (e) => {
        if (!editing || !draft) return;
        e.preventDefault();
        e.stopPropagation();
        try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { }
        const finalized = draft;
        setDraft(null);
        persistOverlays([...overlays, finalized]);
    };

    return (
        <div
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            style={{ position: "relative", width: 200, height: 220, userSelect: "none" }}
        >
            {/* icon box (150×150 scaled) */}
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    position: "relative",
                    width: 150,
                    height: 150,
                }}
            >
                {/* Base icon */}
                {Icon ? (
                    typeof Icon === "string" ? (
                        <img src={Icon} alt={data?.Type || "equipment"} style={{ width: "100%", height: "100%" }} />
                    ) : (
                        // Some Vite svg imports are React components:
                        <Icon style={{ width: "100%", height: "100%" }} />
                    )
                ) : (
                    <svg width="150" height="150" viewBox="0 0 150 150">
                        <rect x="0" y="0" width="150" height="150" fill="#2f6" />
                        <text x="75" y="80" fontSize="16" textAnchor="middle" fill="white">EQ</text>
                    </svg>
                )}

                {/* Saved overlays (always on) */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    <Overlay overlays={overlays} />
                </div>

                {/* Editor layer */}
                {editing && (
                    <svg
                        ref={svgRef}
                        width="150"
                        height="150"
                        viewBox="0 0 150 150"
                        style={{ position: "absolute", inset: 0, cursor: "crosshair", pointerEvents: "all", touchAction: "none" }}
                        onPointerDown={handleDown}
                        onPointerMove={handleMove}
                        onPointerUp={handleUp}
                        onPointerCancel={handleUp}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                        {draft?.type === "line" && <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#222" strokeWidth="2" />}
                        {draft?.type === "rect" && <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} stroke="#222" strokeWidth="2" fill="none" />}
                        {draft?.type === "circle" && <circle cx={draft.cx} cy={draft.cy} r={draft.r || 0} stroke="#222" strokeWidth="2" fill="none" />}
                    </svg>
                )}


                {/* React Flow handles (hidden while editing) */}
                {!editing && (
                    <>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id="left"
                            style={{
                                position: "absolute", top: "50%", left: -7, background: "red",
                                borderRadius: "50%", width: 14, height: 14, transform: "translateY(-50%)",
                                opacity: hovered ? 1 : 0.01
                            }}
                        />
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="right"
                            style={{
                                position: "absolute", top: "50%", right: -7, background: "blue",
                                borderRadius: "50%", width: 14, height: 14, transform: "translateY(-50%)",
                                opacity: hovered ? 1 : 0.01
                            }}
                        />
                        <Handle
                            type="target"
                            position={Position.Top}
                            id="top"
                            style={{
                                position: "absolute", top: -7, left: "50%", background: "green",
                                borderRadius: "50%", width: 14, height: 14, transform: "translateX(-50%)",
                                opacity: hovered ? 1 : 0.01
                            }}
                        />
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id="bottom"
                            style={{
                                position: "absolute", bottom: -7, left: "50%", background: "orange",
                                borderRadius: "50%", width: 14, height: 14, transform: "translateX(-50%)",
                                opacity: hovered ? 1 : 0.01
                            }}
                        />
                    </>
                )}
            </div>

            {/* Top toolbar (appears on hover) */}
            {(hovered || editing) && (
                <div
                    style={{
                        position: "absolute",
                        top: -40,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: 6,
                        background: "rgba(255,255,255,0.95)",
                        padding: "4px 6px",
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        zIndex: 10,
                        alignItems: "center",
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                >
                    {/* Scale */}
                    <button onClick={onScale} style={{ fontSize: 12 }}>×2</button>
                    <button onClick={onReset} style={{ fontSize: 12 }}>Reset</button>

                    {/* Edit toggle */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditing((v) => !v);
                        }}
                        style={{ fontSize: 12, fontWeight: 600 }}
                        title="Edit (draw overlays on this icon)"
                    >
                        {editing ? "Done" : "Edit"}
                    </button>

                    {/* Tools (only when editing) */}
                    {editing && (
                        <>
                            <span style={{ fontSize: 12, opacity: 0.75 }}>Tool:</span>
                            <button onClick={() => setTool("line")} style={{ fontSize: 12, fontWeight: tool === "line" ? 700 : 400 }}>Line</button>
                            <button onClick={() => setTool("circle")} style={{ fontSize: 12, fontWeight: tool === "circle" ? 700 : 400 }}>Circle</button>
                            <button onClick={() => setTool("rect")} style={{ fontSize: 12, fontWeight: tool === "rect" ? 700 : 400 }}>Rect</button>
                            <button onClick={undoOne} style={{ fontSize: 12 }}>Undo</button>
                            <button onClick={clearAll} style={{ fontSize: 12, color: "#b00" }}>Clear</button>
                        </>
                    )}
                </div>
            )}

            {/* (Optional) label under icon */}
            {data?.label && (
                <div style={{ position: "absolute", top: 160, left: 0, width: 150, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                    <div style={{ fontSize: 12, textAlign: "center", width: 150 }}>{data.label}</div>
                </div>
            )}
        </div>
    );
}
