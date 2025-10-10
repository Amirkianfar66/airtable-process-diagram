// src/three/TypeShapeRuntime.jsx
import React, { useMemo } from "react";
import { Line, RoundedBox, useGLTF } from "@react-three/drei";

/** ---- utilities ---- */
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

/** simple in-memory cache */
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

/** replace ${Field} with values from item (numbers become Numbers) */
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

/** ---- primitives from JSON ---- */
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
    if (!rot) return rot;
    if (!deg) return rot;
    return rot.map(degToRad);
}

function NodeContent({ node, fallbackColor }) {
    const t = node.type;
    if (t === "box") {
        return (
            <mesh>
                <boxGeometry args={node.args || [1, 1,]()
