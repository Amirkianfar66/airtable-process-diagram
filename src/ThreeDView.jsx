// src/ThreeDView.jsx
import React, { useEffect, useMemo, useState, Suspense, useRef, useLayoutEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { JsonShape, fetchTypeSpec, guessSpecUrl, normalizeKey } from "./three/TypeShapeRuntime.jsx";

/** ---------- helpers ---------- */
const to3 = (p = { x: 0, y: 0 }, y = 0) => [p.x || 0, y, -(p.y || 0)];
const to2 = ([x, _y, z]) => ({ x, y: -z });

const colorFor = (cat = "") =>
    cat === "Equipment" ? "#4e79a7" :
        cat === "Instrument" ? "#f28e2b" :
            cat === "Inline Valve" ? "#e15759" :
                cat === "Pipe" ? "#76b7b2" : "#9c9c9c";

function CategoryFallback({ cat, color }) {
    if (cat === "Inline Valve") {
        return (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[30, 10, 16, 32]} />
                <meshStandardMaterial color={color} />
            </mesh>
        );
    }
    if (cat === "Pipe") {
        return (
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[12, 12, 80, 16]} />
                <meshStandardMaterial color={color} />
            </mesh>
        );
    }
    if (cat === "Instrument") {
        return (
            <mesh>
                <sphereGeometry args={[30, 24, 16]} />
                <meshStandardMaterial color={color} />
            </mesh>
        );
    }
    return (
        <mesh>
            <boxGeometry args={[60, 40, 60]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
}

/** Tube pipe along a path of points */
function Pipe3D({ points = [], radius = 8, radialSegments = 16, color = "#8a8a8a", metalness = 0.2, roughness = 0.6 }) {
    const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
    const segments = useMemo(() => Math.max(8, Math.floor(curve.getLength() / 25)), [curve]);
    return (
        <mesh>
            <tubeGeometry args={[curve, segments, radius, radialSegments, false]} />
            <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        </mesh>
    );
}

/** Try to parse item.Size like "DN50", "2 in", "50mm" → approximate bore radius in scene units */
function boreFromSize(size) {
    if (!size) return null;
    const s = String(size).toLowerCase();
    let mm = null;
    const dn = s.match(/dn\s*([0-9.]+)/);
    const mmx = s.match(/([0-9.]+)\s*mm/);
    const inch = s.match(/([0-9.]+)\s*(in|inch|inches|")/);
    const justNum = s.match(/^([0-9.]+)$/);
    if (dn) mm = parseFloat(dn[1]);
    else if (mmx) mm = parseFloat(mmx[1]);
    else if (inch) mm = parseFloat(inch[1]) * 25.4;
    else if (justNum) mm = parseFloat(justNum[1]);
    if (!isFinite(mm)) return null;
    // scale to your scene (tweak the 0.6 factor to taste)
    return (mm * 0.6) / 2;
}

/** Compute bbox for a group (meshes only) */
function computeBBox(root) {
    const box = new THREE.Box3();
    root.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
            obj.geometry.computeBoundingBox?.();
            const b = obj.geometry.boundingBox;
            if (b) {
                const bb = b.clone();
                bb.applyMatrix4(obj.matrixWorld);
                box.union(bb);
            }
        }
    });
    if (isFinite(box.min.x) && isFinite(box.max.x)) return box;
    return new THREE.Box3(new THREE.Vector3(-30, -20, -30), new THREE.Vector3(30, 20, 30));
}

/** Create default port layout from bbox + category (WORLD positions) */
function defaultPortsFor(cat, bbox) {
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const y = center.y;
    const L = size.x / 2, W = size.z / 2;

    if (cat === "Inline Valve" || cat === "Pipe") {
        return [
            { id: "in", pos: new THREE.Vector3(center.x - L, y, center.z), normal: new THREE.Vector3(-1, 0, 0) },
            { id: "out", pos: new THREE.Vector3(center.x + L, y, center.z), normal: new THREE.Vector3(1, 0, 0) },
        ];
    }
    return [
        { id: "left", pos: new THREE.Vector3(center.x - L, y, center.z), normal: new THREE.Vector3(-1, 0, 0) },
        { id: "right", pos: new THREE.Vector3(center.x + L, y, center.z), normal: new THREE.Vector3(1, 0, 0) },
        { id: "back", pos: new THREE.Vector3(center.x, y, center.z - W), normal: new THREE.Vector3(0, 0, -1) },
        { id: "front", pos: new THREE.Vector3(center.x, y, center.z + W), normal: new THREE.Vector3(0, 0, 1) },
    ];
}

/** ---------- NodeMesh (pivot-aware + gizmo wrapper) ---------- */
function NodeMesh({
    node, pivot, selected,
    onSetPivot, reportPorts,
    isDragging, startDrag, moveDrag, endDrag,
    intersectGround, onPick,
    // NEW:
    gridSnap = 10,
    setControlsEnabled,
    onMoveNode,
}) {
    const item = node?.data?.item;
    if (!item) return null;

    const cat = String(item["Category Item Type"] ?? item.Category ?? "");
    const typeKey = normalizeKey(item.TypeKey || item.Type || "");
    const base = to3(node.position, 20); // world-space from 2D
    const color = colorFor(cat);

    const groupRef = useRef(null);
    const [spec, setSpec] = useState(null);
    const specUrl = item.ModelJSON || guessSpecUrl(typeKey);

    useEffect(() => {
        let alive = true;
        setSpec(null);
        fetchTypeSpec(specUrl).then((s) => alive && setSpec(s));
        return () => { alive = false; };
    }, [specUrl]);

    // compute & report ports (WORLD coords)
    useLayoutEffect(() => {
        if (!groupRef.current) return;
        const bbox = computeBBox(groupRef.current);

        let ports = null;
        try {
            if (item.PortsJSON) {
                const arr = Array.isArray(item.PortsJSON) ? item.PortsJSON : JSON.parse(item.PortsJSON);
                if (Array.isArray(arr) && arr.length) {
                    ports = arr.map((p, i) => ({
                        id: p.id || String(i),
                        pos: new THREE.Vector3().fromArray(p.pos),
                        normal: new THREE.Vector3().fromArray(p.normal || [0, 0, 0]).normalize(),
                    }));
                    ports.forEach((p) => {
                        p.pos.applyMatrix4(groupRef.current.matrixWorld);
                        if (p.normal.lengthSq() === 0) p.normal.set(1, 0, 0);
                    });
                }
            }
        } catch { }

        if (!ports) ports = defaultPortsFor(cat, bbox);

        const bore = boreFromSize(item.Size || item["Nominal Size"] || item.NPS || item.DN);
        reportPorts?.(node.id, { ports, bore, centerY: bbox.getCenter(new THREE.Vector3()).y });
    });

    // plane-drag fallback (disabled while gizmo is active)
    const dragProps = selected
        ? {}
        : {
            onPointerDown: (e) => {
                e.stopPropagation();
                const hit = intersectGround(e.ray);
                if (!hit) return;
                const nodeWorld = new THREE.Vector3(...base); // use base, not base+pivot
                const offset = new THREE.Vector3().subVectors(nodeWorld, hit);
                startDrag(node.id, offset);
            },
            onPointerUp: (e) => { e.stopPropagation(); endDrag(); },
            onPointerMove: (e) => {
                if (!isDragging) return;
                e.stopPropagation();
                const p = intersectGround(e.ray);
                if (!p) return;
                moveDrag(node.id, p);
            },
        };

    // update RF coords when gizmo moves the group
    const commitTo2D = () => {
        const p = groupRef.current?.position;
        if (!p) return;
        const pos2 = to2([p.x, 0, p.z]);
        onMoveNode?.(node.id, pos2);
    };

    const px = pivot?.x || 0, py = pivot?.y || 0, pz = pivot?.z || 0;

    // The world group stays at base (NO pivot added here).
    // The mesh is shifted locally by -pivot so the group's origin is the true pivot.
    const WorldGroup = (
        <group
            ref={groupRef}
            position={base}
            onClick={(e) => { e.stopPropagation(); onPick?.(node.id); }}
            {...dragProps}
        >
            {/* pivot-aware local shift */}
            <group position={[-px, -py, -pz]}>
                {spec ? (
                    <JsonShape spec={spec} item={item} fallbackColor={color} />
                ) : (
                    <CategoryFallback cat={cat} color={color} />
                )}
            </group>

            {/* label */}
            <Html
                distanceFactor={8}
                position={[0, 40, 0]}
                center
                style={{ pointerEvents: "none", fontSize: 12, background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 4 }}
            >
                {(item["Item Code"] || item.Code || "") + " " + (item.Name || "")}
            </Html>

            {/* axes tripod + pivot panel only when selected */}
            {selected && <axesHelper args={[100]} />}

            {selected && (
                <Html distanceFactor={8} position={[0, 100, 0]} center transform>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "auto 80px 80px 80px",
                            gap: 6,
                            padding: 8,
                            background: "rgba(255,255,255,0.95)",
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
                            fontSize: 12,
                        }}
                    >
                        <div style={{ opacity: 0.7, paddingRight: 6 }}>Pivot</div>
                        {["x", "y", "z"].map((axis) => (
                            <input
                                key={axis}
                                type="number"
                                step="1"
                                value={Number(pivot?.[axis] || 0)}
                                onChange={(e) => {
                                    const v = Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0;
                                    onSetPivot?.(node.id, { ...pivot, [axis]: v });
                                }}
                                style={{ width: 70, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 6 }}
                            />
                        ))}
                        <div />
                        {["X", "Y", "Z"].map((axis) => {
                            const key = axis.toLowerCase();
                            return (
                                <div key={axis} style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => onSetPivot?.(node.id, { ...pivot, [key]: (pivot?.[key] || 0) - 10 })}>−10</button>
                                    <button onClick={() => onSetPivot?.(node.id, { ...pivot, [key]: (pivot?.[key] || 0) - 1 })}>−1</button>
                                    <button onClick={() => onSetPivot?.(node.id, { ...pivot, [key]: 0 })}>0</button>
                                    <button onClick={() => onSetPivot?.(node.id, { ...pivot, [key]: (pivot?.[key] || 0) + 1 })}>+1</button>
                                    <button onClick={() => onSetPivot?.(node.id, { ...pivot, [key]: (pivot?.[key] || 0) + 10 })}>+10</button>
                                </div>
                            );
                        })}
                    </div>
                </Html>
            )}
        </group>
    );

    // Wrap with TransformControls ONLY when selected (no object prop!)
    return selected ? (
        <TransformControls
            mode="translate"
            translationSnap={gridSnap || 10}
            onMouseDown={() => setControlsEnabled?.(false)}
            onMouseUp={() => setControlsEnabled?.(true)}
            onObjectChange={commitTo2D}
        >
            {WorldGroup}
        </TransformControls>
    ) : (
        WorldGroup
    );
}



/** ---------- Scene: builds port-aware tube paths ---------- */
function Scene({
    nodes = [],
    edges = [],
    onPick,
    onMoveNode,
    setControlsEnabled,
    gridSnap = 10,
    selectedNodeId,               // NEW
    onSetNodePivot,               // NEW
}) {

    const byId = useMemo(() => new Map(nodes.map((n) => [String(n.id), n])), [nodes]);

    // id -> { ports: [{id,pos,normal}], bore, centerY }
    const portsRef = useRef(new Map());
    const reportPorts = (id, payload) => {
        portsRef.current.set(String(id), payload);
    };

    // Ground plane for dragging
    const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
    const tmp = useRef(new THREE.Vector3());
    const intersectGround = (ray) => {
        const hit = tmp.current;
        const ok = ray.intersectPlane(plane, hit);
        return ok ? hit.clone() : null;
    };

    // Drag state
    const [dragging, setDragging] = useState(null);
    const [coarse, setCoarse] = useState(false);
    const startDrag = (id, offset) => { setDragging({ id, offset: offset.clone() }); setControlsEnabled?.(false); };
    const endDrag = () => { setDragging(null); setControlsEnabled?.(true); };
    const moveDrag = (id, worldPoint, shiftKey = coarse) => {
        if (!dragging || dragging.id !== id) return;
        const desired = worldPoint.clone().add(dragging.offset);
        const snap = shiftKey ? 50 : gridSnap;
        if (snap > 0) {
            desired.x = Math.round(desired.x / snap) * snap;
            desired.z = Math.round(desired.z / snap) * snap;
        }
        const pos2 = to2([desired.x, 0, desired.z]);
        onMoveNode?.(id, pos2);
    };

    useEffect(() => {
        const onKey = (e) => setCoarse(e.shiftKey);
        window.addEventListener("keydown", onKey);
        window.addEventListener("keyup", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("keyup", onKey);
        };
    }, []);

    // Build port-aware pipe segments
    const pipeSegments = useMemo(() => {
        const out = [];
        for (const e of edges || []) {
            const a = byId.get(String(e.source));
            const b = byId.get(String(e.target));
            if (!a || !b) continue;

            const pa = portsRef.current.get(String(a.id));
            const pb = portsRef.current.get(String(b.id));

            const Acenter = new THREE.Vector3(...to3(a.position, 10));
            const Bcenter = new THREE.Vector3(...to3(b.position, 10));

            let srcPt = Acenter.clone();
            let dstPt = Bcenter.clone();
            let srcNormal = new THREE.Vector3(1, 0, 0);
            let dstNormal = new THREE.Vector3(-1, 0, 0);
            let radius = e?.data?.pipeRadius ?? 8;

            const dirAB = Bcenter.clone().sub(Acenter).normalize();

            if (pa?.ports?.length) {
                let bestDot = -Infinity, best = null;
                for (const p of pa.ports) {
                    const d = p.normal.clone().normalize().dot(dirAB);
                    if (d > bestDot) { bestDot = d; best = p; }
                }
                if (best) { srcPt = best.pos.clone(); srcNormal = best.normal.clone().normalize(); }
                if (pa.bore) radius = Math.min(radius, pa.bore);
            }
            if (pb?.ports?.length) {
                const dirBA = Acenter.clone().sub(Bcenter).normalize();
                let bestDot = -Infinity, best = null;
                for (const p of pb.ports) {
                    const d = p.normal.clone().normalize().dot(dirBA);
                    if (d > bestDot) { bestDot = d; best = p; }
                }
                if (best) { dstPt = best.pos.clone(); dstNormal = best.normal.clone().normalize(); }
                if (pb.bore) radius = Math.min(radius, pb.bore);
            }

            // Respect explicit polylines if provided in 2D edge.data.points
            const pts2d = e?.data?.points;
            if (Array.isArray(pts2d) && pts2d.length >= 2) {
                const poly = pts2d.map((p) => new THREE.Vector3(...to3({ x: p.x ?? p[0], y: p.y ?? p[1] }, (pa?.centerY ?? 10))));
                out.push({ id: e.id, color: e?.style?.stroke || "#888", radius, path: poly.map((v) => v.toArray()) });
                continue;
            }

            // lead-outs so the pipe visibly exits/enters bodies
            const lead = Math.max(20, radius * 3);
            const p0 = srcPt.clone();
            const p1 = srcPt.clone().add(srcNormal.clone().multiplyScalar(lead));
            const p3 = dstPt.clone().add(dstNormal.clone().multiplyScalar(lead));
            const p4 = dstPt.clone();

            // Clean Manhattan bend
            let mid;
            if (Math.abs(p1.x - p3.x) > Math.abs(p1.z - p3.z)) {
                mid = new THREE.Vector3(p3.x, (pa?.centerY ?? p1.y), p1.z);
            } else {
                mid = new THREE.Vector3(p1.x, (pa?.centerY ?? p1.y), p3.z);
            }

            const path = [p0, p1, mid, p3, p4].map((v) => v.toArray());
            out.push({ id: e.id, color: e?.style?.stroke || "#888", radius, path });
        }
        return out;
    }, [edges, byId, nodes]);

    return (
        <>
            <ambientLight intensity={1} />
            <directionalLight position={[200, 300, 200]} intensity={0.8} />
            <Grid args={[2000, 2000]} cellSize={50} sectionSize={250} />

            {nodes.map((n) => (
                <NodeMesh
                    key={n.id}
                    node={n}
                    pivot={(n.data && n.data.pivot) || { x: 0, y: 0, z: 0 }}
                    selected={String(n.id) === String(selectedNodeId)}
                    onSetPivot={(id, p) => onSetNodePivot?.(id, p)}
                    reportPorts={reportPorts}
                    isDragging={!!dragging && dragging.id === n.id}
                    startDrag={startDrag}
                    moveDrag={(id, p) => moveDrag(id, p, coarse)}
                    endDrag={endDrag}
                    intersectGround={intersectGround}
                    onPick={onPick}
                    gridSnap={gridSnap}
                    setControlsEnabled= { setControlsEnabled }
                    onMoveNode= { onMoveNode }
                />
            ))}

            <Grid args={[2000, 2000]} cellSize={50} sectionSize={250} />

            {/* Invisible ground that keeps drag alive even off the node */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                onPointerMove={(e) => {
                    if (!dragging) return;
                    const p = intersectGround(e.ray);
                    if (p) moveDrag(dragging.id, p, coarse);
                }}
                onPointerUp={() => endDrag()}
            >
                <planeGeometry args={[10000, 10000]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {pipeSegments.map(({ id, path, color, radius }) => (
                <Pipe3D key={id} points={path} color={color} radius={radius} />

            ))}
        </>
    );
}

export default function ThreeDView({ nodes = [],
    edges = [],
    onSelectNode,
    onMoveNode,
    gridSnap = 10,
    selectedNodeId,                 // NEW: which node is selected (to show the panel)
    onSetNodePivot,                 // NEW: (id, {x,y,z}) -> update node.data.pivot in parent
}) {

    const [controlsEnabled, setControlsEnabled] = useState(true);
    const handlePick = (id) => onSelectNode?.(id);

    return (
        <Canvas camera={{ position: [0, 400, 600], fov: 50 }} onPointerMissed={() => setControlsEnabled(true)}>
            <color attach="background" args={["#f7f7f7"]} />
            <Suspense fallback={null}>
                <Scene
                    nodes={nodes}
                    edges={edges}
                    onPick={handlePick}
                    onMoveNode={onMoveNode}
                    setControlsEnabled={setControlsEnabled}
                    gridSnap={gridSnap}
                    selectedNodeId={selectedNodeId}
                    onSetNodePivot={onSetNodePivot}
                />
            </Suspense>
            <OrbitControls makeDefault enabled={controlsEnabled} enableDamping />
        </Canvas>
    );
}
