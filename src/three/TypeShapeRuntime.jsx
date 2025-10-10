// src/three/TypeShapeRuntime.jsx
import React, { useMemo } from "react";
import { Line, RoundedBox, useGLTF } from "@react-three/drei";

export const normalizeKey = (s) =>
    (s ?? "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\(.+?\)/g, "")
        .replace(/[\/]/g, " ")
        .replace(/&/g, " and ")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "")
        .replace(/_+$/g, "");

export function guessSpecUrl(typeKey) {
    return `/type-specs/${normalizeKey(typeKey)}.json`;
}

// simple in-memory cache
const SPEC_CACHE = new Map();
export async function fetchTypeSpec(url) {
    if (!url) return null;
    if (SPEC_CACHE.has(url)) return SPEC_CACHE.get(url);
    const p = fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    SPEC_CACHE.set(url, p);
    return p;
}

const isNumLike = (v) => typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v);

// replace ${Field} with values from item; number-like strings → Numbers
function resolveTemplates(value, item) {
    if (typeof value === "string") {
        const out = value.replace(/\$\{([^}]+)\}/g, (_, key) => {
            const k = key.trim();
            const val = item?.[k];
            if (val == null) return "";
            return Array.isArray(val) ? (val[0] ?? "") : String(val);
        });
        return isNumLike(out) ? Number(out) : out;
    }
    if (Array.isArray(value)) return value.map((v) => resolveTemplates(v, item));
    if (value && typeof value === "object") {
        const o = {};
        for (const k in value) o[k] = resolveTemplates(value[k], item);
        return o;
    }
    return value;
}

function MeshMat({ node, fallbackColor }) {
    const {
        color = fallbackColor,
        metalness = 0,
        roughness = 1,
        transparent = false,
        opacity = 1,
    } = node;
    return (
        <meshStandardMaterial
            color={color}
            metalness={metalness}
            roughness={roughness}
            transparent={transparent}
            opacity={opacity}
        />
    );
}

const degToRad = (a) => (typeof a === "number" ? (a * Math.PI) / 180 : a);
function applyDeg(rot, deg) {
    if (!rot || !deg) return rot;
    return rot.map(degToRad);
}

function NodeContent({ node, fallbackColor }) {
    const t = node.type;

    if (t === "box") {
        return (
            <mesh>
                <boxGeometry args={node.args || [1, 1, 1]} />
                <MeshMat node={node} fallbackColor={fallbackColor} />
            </mesh>
        );
    }

    if (t === "roundedBox") {
        const [x = 1, y = 1, z = 1] = node.args || [];
        const radius = node.radius ?? 0.05;
        return (
            <RoundedBox args={[x, y, z]} radius={radius}>
                <MeshMat node={node} fallbackColor={fallbackColor} />
            </RoundedBox>
        );
    }

    if (t === "sphere") {
        return (
            <mesh>
                <sphereGeometry args={node.args || [1, 16, 12]} />
                <MeshMat node={node} fallbackColor={fallbackColor} />
            </mesh>
        );
    }

    if (t === "cylinder") {
        return (
            <mesh>
                <cylinderGeometry args={node.args || [1, 1, 1, 16]} />
                <MeshMat node={node} fallbackColor={fallbackColor} />
            </mesh>
        );
    }

    if (t === "torus") {
        return (
            <mesh>
                <torusGeometry args={node.args || [1, 0.25, 12, 24]} />
                <MeshMat node={node} fallbackColor={fallbackColor} />
            </mesh>
        );
    }

    if (t === "capsule") {
        return (
            <mesh>
                <capsuleGeometry args={node.args || [0.5, 1, 8, 16]} />
                <MeshMat node={node} fallbackColor={fallbackColor} />
            </mesh>
        );
    }

    if (t === "line") {
        const pts = node.points || [
            [-0.5, 0, 0],
            [0.5, 0, 0],
        ];
        return <Line points={pts} lineWidth={node.lineWidth ?? 2} />;
    }

    if (t === "glb") {
        const { url, scale = 1 } = node;
        const { scene } = useGLTF(url);
        return <primitive object={scene} scale={scale} />;
    }

    // unknown → handled if node.type === "group" by NodeTree children
    return null;
}

function NodeTree({ node, fallbackColor }) {
    const {
        position = [0, 0, 0],
        rotation = [0, 0, 0],
        scale = 1,
        children = [],
        deg = false,
    } = node;
    const rot = applyDeg(rotation, deg);

    return (
        <group position={position} rotation={rot} scale={scale}>
            <NodeContent node={node} fallbackColor={fallbackColor} />
            {children.map((c, i) => (
                <NodeTree key={i} node={c} fallbackColor={fallbackColor} />
            ))}
        </group>
    );
}

export function JsonShape({ spec, item, fallbackColor }) {
    const hydrated = useMemo(() => resolveTemplates(spec, item), [spec, item]);
    const root = Array.isArray(hydrated)
        ? { type: "group", children: hydrated }
        : hydrated;
    return <NodeTree node={root} fallbackColor={fallbackColor} />;
}
