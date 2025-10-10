// src/ThreeDView.jsx
import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Html } from "@react-three/drei";

/** tiny helper to lift 2D (x,y) into 3D (x, z = -y) */
const to3 = (p = { x: 0, y: 0 }, y = 0) => [p.x, y, -p.y];

function NodeMesh({ node, onPick }) {
    const item = node?.data?.item;
    if (!item) return null;

    const cat = String(item["Category Item Type"] ?? item.Category ?? "");
    const pos = to3(node.position, 20);

    let geom = "box";
    if (cat === "Instrument") geom = "sphere";
    else if (cat === "Inline Valve") geom = "torus";
    else if (cat === "Pipe") geom = "cylinder";

    const color =
        cat === "Equipment" ? "#4e79a7" :
            cat === "Instrument" ? "#f28e2b" :
                cat === "Inline Valve" ? "#e15759" :
                    cat === "Pipe" ? "#76b7b2" : "#9c9c9c";

    return (
        <group position={pos} onClick={(e) => { e.stopPropagation(); onPick?.(node.id); }}>
            {geom === "box" && (
                <mesh>
                    <boxGeometry args={[60, 40, 60]} />
                    <meshStandardMaterial color={color} />
                </mesh>
            )}
            {geom === "sphere" && (
                <mesh>
                    <sphereGeometry args={[30, 24, 16]} />
                    <meshStandardMaterial color={color} />
                </mesh>
            )}
            {geom === "torus" && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[30, 10, 16, 32]} />
                    <meshStandardMaterial color={color} />
                </mesh>
            )}
            {geom === "cylinder" && (
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[12, 12, 80, 16]} />
                    <meshStandardMaterial color={color} />
                </mesh>
            )}
            <Html
                distanceFactor={8}
                position={[0, 40, 0]}
                center
                style={{ pointerEvents: "none", fontSize: 12, background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 4 }}
            >
                {(item["Item Code"] || item.Code || "") + " " + (item.Name || "")}
            </Html>
        </group>
    );
}

function Scene({ nodes = [], edges = [], onPick }) {
    const map = useMemo(() => new Map(nodes.map(n => [String(n.id), n])), [nodes]);

    const edgePoints = useMemo(() =>
        (edges || [])
            .map(e => {
                const a = map.get(String(e.source));
                const b = map.get(String(e.target));
                if (!a || !b) return null;
                return [to3(a.position, 0), to3(b.position, 0)];
            })
            .filter(Boolean),
        [edges, map]
    );

    return (
        <>
            <ambientLight intensity={1} />
            <directionalLight position={[200, 300, 200]} intensity={0.8} />
            <Grid args={[2000, 2000]} cellSize={50} sectionSize={250} />

            {nodes.map(n => <NodeMesh key={n.id} node={n} onPick={onPick} />)}
            {edgePoints.map((pts, i) => <Line key={i} points={pts} lineWidth={2} />)}
        </>
    );
}

export default function ThreeDView({ nodes = [], edges = [], onSelectNode }) {
    const handlePick = (id) => onSelectNode?.(id);

    return (
        <Canvas camera={{ position: [0, 400, 600], fov: 50 }}>
            <color attach="background" args={["#f7f7f7"]} />
            <Scene nodes={nodes} edges={edges} onPick={handlePick} />
            <OrbitControls makeDefault enableDamping />
        </Canvas>
    );
}
