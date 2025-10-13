// src/ThreeDView.jsx
import React, { useEffect, useMemo, useState, Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { JsonShape, fetchTypeSpec, guessSpecUrl, normalizeKey } from "./three/TypeShapeRuntime.jsx";

/** lift 2D x,y into 3D x,z with a Y height */
const to3 = (p = { x: 0, y: 0 }, y = 0) => [p.x || 0, y, -(p.y || 0)];
/** back to 2D (React Flow) */
const to2 = ([x, _y, z]) => ({ x, y: -z });

const colorFor = (cat = "") =>
    cat === "Equipment" ? "#4e79a7" :
        cat === "Instrument" ? "#f28e2b" :
            cat === "Inline Valve" ? "#e15759" :
                cat === "Pipe" ? "#76b7b2" : "#9c9c9c";

/** very simple fallback so empty/missing specs still render */
function CategoryFallback({ cat, color }) {
    if (cat === "Instrument") {
        return (
            <mesh>
                <sphereGeometry args={[30, 24, 16]} />
                <meshStandardMaterial color={color} />
            </mesh>
        );
    }
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
    return (
        <mesh>
            <boxGeometry args={[60, 40, 60]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
}

/** ----- New: Pipe3D (tube along a path) ----- */
function Pipe3D({
    points = [],                  // array of [x,y,z]
    radius = 8,                   // pipe radius in your scene units (px-like)
    radialSegments = 16,
    color = "#8a8a8a",
    metalness = 0.2,
    roughness = 0.6,
}) {
    // Build a curve from the provided points
    const curve = useMemo(
        () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        [points]
    );

    // Segment count scales with curve length (looks smoother on long runs)
    const segments = useMemo(() => Math.max(8, Math.floor(curve.getLength() / 25)), [curve]);

    return (
        <mesh>
            <tubeGeometry args={[curve, segments, radius, radialSegments, false]} />
            <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        </mesh>
    );
}

/** ----- NodeMesh with drag handlers ----- */
function NodeMesh({
    node,
    isDragging,
    startDrag,
    moveDrag,
    endDrag,
    intersectGround,
    onPick,
}) {
    const item = node?.data?.item;
    if (!item) return null;

    const cat = String(item["Category Item Type"] ?? item.Category ?? "");
    const typeKey = normalizeKey(item.TypeKey || item.Type || "");
    const pos = to3(node.position, 20);
    const color = colorFor(cat);

    const [spec, setSpec] = useState(null);
    const [triedUrl, setTriedUrl] = useState("");

    const specUrl = item.ModelJSON || guessSpecUrl(typeKey);

    useEffect(() => {
        let alive = true;
        setSpec(null);
        setTriedUrl(specUrl);
        fetchTypeSpec(specUrl).then((s) => {
            if (!alive) return;
            setSpec(s);
        });
        return () => {
            alive = false;
        };
    }, [specUrl]);

    const onPointerDown = (e) => {
        e.stopPropagation();
        // compute ground intersection point at y=0
        const hit = intersectGround(e.ray);
        if (!hit) return;
        // offset between node center and hit point (so cursor stays relative)
        const nodeWorld = new THREE.Vector3(...pos);
        const offset = new THREE.Vector3().subVectors(nodeWorld, hit);
        startDrag(node.id, offset);
    };

    const onPointerUp = (e) => {
        e.stopPropagation();
        endDrag();
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        const p = intersectGround(e.ray);
        if (!p) return;
        moveDrag(node.id, p);
    };

    return (
        <group
            position={pos}
            onClick={(e) => {
                e.stopPropagation();
                onPick?.(node.id);
            }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={onPointerMove}
        >
            {spec ? (
                <JsonShape spec={spec} item={item} fallbackColor={color} />
            ) : (
                <CategoryFallback cat={cat} color={color} />
            )}

            <Html
                distanceFactor={8}
                position={[0, 40, 0]}
                center
                style={{
                    pointerEvents: "none",
                    fontSize: 12,
                    background: "rgba(255,255,255,0.85)",
                    padding: "2px 6px",
                    borderRadius: 4,
                }}
            >
                {(item["Item Code"] || item.Code || "") + " " + (item.Name || "")}
                {!spec && triedUrl ? (
                    <span style={{ color: "#999", marginLeft: 6 }}>({typeKey})</span>
                ) : null}
            </Html>
        </group>
    );
}

/** Scene wrapper with drag logic and *pipe* edges */
function Scene({
    nodes = [],
    edges = [],
    onPick,
    onMoveNode,
    setControlsEnabled,
    gridSnap = 10,
}) {
    const byId = useMemo(() => new Map(nodes.map((n) => [String(n.id), n])), [nodes]);

    // Choose a path for each edge. Priority:
    // 1) edge.data.points (array of {x,y} or [x,y])
    // 2) L-shaped route for step/smoothstep
    // 3) straight
    const pipeY = 10; // slightly above ground so it’s visible and doesn’t z-fight
    const edgePaths = useMemo(() => {
        const toVec3 = (p2) => new THREE.Vector3(...to3({ x: p2.x ?? p2[0], y: p2.y ?? p2[1] }, pipeY));
        return (edges || [])
            .map((e) => {
                const a = byId.get(String(e.source));
                const b = byId.get(String(e.target));
                if (!a || !b) return null;

                // (1) explicit points from edge.data.points
                const pts = e?.data?.points;
                if (Array.isArray(pts) && pts.length >= 2) {
                    const path = pts.map((p) => toVec3(p).toArray());
                    return { id: e.id, color: e?.style?.stroke || "#888", radius: e?.data?.pipeRadius ?? 8, path };
                }

                // (2) L-route for step/smoothstep edges
                const A = new THREE.Vector3(...to3(a.position, pipeY));
                const B = new THREE.Vector3(...to3(b.position, pipeY));
                let mid;
                if (e.type === "step" || e.type === "smoothstep") {
                    // pick the longer axis to bend across; keeps bends tidy
                    if (Math.abs(A.x - B.x) > Math.abs(A.z - B.z)) {
                        mid = new THREE.Vector3(B.x, pipeY, A.z);
                    } else {
                        mid = new THREE.Vector3(A.x, pipeY, B.z);
                    }
                    return { id: e.id, color: e?.style?.stroke || "#888", radius: e?.data?.pipeRadius ?? 8, path: [A.toArray(), mid.toArray(), B.toArray()] };
                }

                // (3) straight
                return { id: e.id, color: e?.style?.stroke || "#888", radius: e?.data?.pipeRadius ?? 8, path: [A.toArray(), B.toArray()] };
            })
            .filter(Boolean);
    }, [edges, byId]);

    // Ground plane y=0
    const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
    const tmp = useRef(new THREE.Vector3());
    const intersectGround = (ray) => {
        const hit = tmp.current;
        const ok = ray.intersectPlane(plane, hit);
        return ok ? hit.clone() : null;
    };

    // Drag state
    const [dragging, setDragging] = useState(null); // { id, offset: Vector3 }
    const [coarse, setCoarse] = useState(false); // shift for coarse snap

    const startDrag = (id, offset) => {
        setDragging({ id, offset: offset.clone() });
        setControlsEnabled?.(false);
    };
    const endDrag = () => {
        setDragging(null);
        setControlsEnabled?.(true);
    };

    // Move: compute snapped world pos, convert to 2D, call parent
    const moveDrag = (id, worldPoint, shiftKey = coarse) => {
        if (!dragging || dragging.id !== id) return;
        const desired = worldPoint.clone().add(dragging.offset); // keep cursor-relative offset
        const snap = shiftKey ? 50 : gridSnap;
        if (snap > 0) {
            desired.x = Math.round(desired.x / snap) * snap;
            desired.z = Math.round(desired.z / snap) * snap;
        }
        const pos2 = to2([desired.x, 0, desired.z]);
        onMoveNode?.(id, pos2);
    };

    // capture Shift key to toggle coarse snapping
    useEffect(() => {
        const onKey = (e) => setCoarse(e.shiftKey);
        window.addEventListener("keydown", onKey);
        window.addEventListener("keyup", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("keyup", onKey);
        };
    }, []);

    return (
        <>
            <ambientLight intensity={1} />
            <directionalLight position={[200, 300, 200]} intensity={0.8} />
            <Grid args={[2000, 2000]} cellSize={50} sectionSize={250} />

            {nodes.map((n) => (
                <NodeMesh
                    key={n.id}
                    node={n}
                    isDragging={!!dragging && dragging.id === n.id}
                    startDrag={startDrag}
                    moveDrag={(id, p) => moveDrag(id, p, coarse)}
                    endDrag={endDrag}
                    intersectGround={intersectGround}
                    onPick={onPick}
                />
            ))}

            {/* Pipes between items */}
            {edgePaths.map(({ id, path, color, radius }) => (
                <Pipe3D key={id} points={path} color={color} radius={radius} />
            ))}
        </>
    );
}

export default function ThreeDView({
    nodes = [],
    edges = [],
    onSelectNode,
    /** IMPORTANT: wire this to setNodes in your parent */
    onMoveNode,
    gridSnap = 10,
}) {
    const [controlsEnabled, setControlsEnabled] = useState(true);
    const handlePick = (id) => onSelectNode?.(id);

    return (
        <Canvas
            camera={{ position: [0, 400, 600], fov: 50 }}
            onPointerMissed={() => setControlsEnabled(true)}
        >
            <color attach="background" args={["#f7f7f7"]} />
            <Suspense fallback={null}>
                <Scene
                    nodes={nodes}
                    edges={edges}
                    onPick={handlePick}
                    onMoveNode={onMoveNode}
                    setControlsEnabled={setControlsEnabled}
                    gridSnap={gridSnap}
                />
            </Suspense>
            <OrbitControls makeDefault enabled={controlsEnabled} enableDamping />
        </Canvas>
    );
}
