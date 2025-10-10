// src/ThreeDView.jsx
import React, { useEffect, useMemo, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Html } from "@react-three/drei";
import { JsonShape, fetchTypeSpec, guessSpecUrl, normalizeKey } from "./three/TypeShapeRuntime";

/** Lift 2D x,y into 3D x,z with a Y height */
const to3 = (p = { x: 0, y: 0 }, y = 0) => [p.x || 0, y, -(p.y || 0)];

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

function NodeMesh({ node, onPick }) {
    const item = node?.data?.item;
    if (!item) return null;

    const cat = String(item["Category Item Type"] ?? item.Category ?? "");
    const typeKey = normalizeKey(item.TypeKey || item.Type || "");
    const pos = to3(node.position, 20);
    const color = colorFor(cat);

    const [spec, setSpec] = useState(null);
    const [triedUrl, setTriedUrl] = useState("");

    // pick a URL: item override (ModelJSON) or conventional path
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

    return (
        <group
            position={pos}
            onClick={(e) => {
                e.stopPropagation();
                onPick?.(node.id);
            }}
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

function Scene({ nodes = [], edges = [], onPick }) {
    const byId = useMemo(() => new Map(nodes.map((n) => [String(n.id), n])), [nodes]);

    const edgePoints = useMemo(
        () =>
            (edges || [])
                .map((e) => {
                    const a = byId.get(String(e.source));
                    const b = byId.get(String(e.target));
                    if (!a || !b) return null;
                    return [to3(a.position, 0), to3(b.position, 0)];
                })
                .filter(Boolean),
        [edges, byId]
    );

    return (
        <>
            <ambientLight intensity={1} />
            <directionalLight position={[200, 300, 200]} intensity={0.8} />
            <Grid args={[2000, 2000]} cellSize={50} sectionSize={250} />

            {nodes.map((n) => (
                <NodeMesh key={n.id} node={n} onPick={onPick} />
            ))}
            {edgePoints.map((pts, i) => (
                <Line key={i} points={pts} lineWidth={2} />
            ))}
        </>
    );
}

export default function ThreeDView({ nodes = [], edges = [], onSelectNode }) {
    const handlePick = (id) => onSelectNode?.(id);

    return (
        <Canvas camera={{ position: [0, 400, 600], fov: 50 }}>
            <color attach="background" args={["#f7f7f7"]} />
            <Suspense fallback={null}>
                <Scene nodes={nodes} edges={edges} onPick={handlePick} />
            </Suspense>
            <OrbitControls makeDefault enableDamping />
        </Canvas>
    );
}
