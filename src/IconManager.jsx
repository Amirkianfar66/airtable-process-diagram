import React from "react";
import EquipmentIcon from "./Icons/EquipmentIcon";
import InstrumentIcon from "./Icons/InstrumentIcon";
import InlineItemIcon from "./Icons/InlineItemIcon";
import ValveIcon from "./Icons/ValveIcon";
import PipeIcon from "./Icons/PipeIcon";
import ElectricalIcon from "./Icons/ElectricalIcon";

// Normalize a type label into a stable key used by icon lookup
const normalizeTypeKey = (s) =>
    (s || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "");

/** Map Category → ReactFlow node type (must match keys in `nodeTypes` in ProcessDiagram) */
export const categoryTypeMap = {
    Pipe: "pipe",
    Equipment: "scalableIcon",
    Instrument: "scalableIcon",
    Valve: "scalableIcon",
    "Inline Item": "scalableIcon",
    Electrical: "scalableIcon",
};

/** Category components */
const CATEGORY_COMPONENTS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Item": InlineItemIcon,
    Valve: ValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/** Return a React element for an item icon */
// IconManager.jsx (replace getItemIcon)
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    // Normalize category into a string (support arrays & other types)
    const rawCategory = item?.Category ?? item?.['Category Item Type'] ?? '';
    const category =
        typeof rawCategory === 'string'
            ? rawCategory.trim()
            : Array.isArray(rawCategory)
                ? (rawCategory[0] ? String(rawCategory[0]).trim() : '')
                : String(rawCategory || '');

    const CategoryComponent = CATEGORY_COMPONENTS[category];

    if (CategoryComponent) {
        try {
            return <CategoryComponent id={item.id} data={item} {...props} />;
        } catch (err) {
            console.error('Icon render failed for', category, err);
            // fallback visual so render won't crash
            return (
                <div
                    style={{
                        width: props.width || 40,
                        height: props.height || 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#eee',
                        borderRadius: 6,
                        fontSize: 10,
                        color: '#444',
                    }}
                >
                    {category.slice(0, 3) || 'N/A'}
                </div>
            );
        }
    }

    return (
        <div
            style={{
                width: props.width || 40,
                height: props.height || 40,
                background: '#ccc',
                borderRadius: 6,
            }}
        />
    );
}

/** Create a new item node */
export function createNewItemNode(setNodes, setItems, setSelectedItem) {
    const newItem = {
        id: `item-${Date.now()}`,
        Code: "NEW001",
        "Item Code": "NEW001",
        Name: "New Item",
        Category: "Equipment",
        "Category Item Type": "Equipment",
        Type: "Tank",
        Unit: "Unit 1",
        SubUnit: "Sub 1",
        // 🔑 add placeholders
        edgeId: "",
        from: "",
        to: "",
    };


    const newNode = {
        id: newItem.id,
        position: { x: 100, y: 100 },
        data: {
            label: `${newItem.Code} - ${newItem.Name}`,
            item: newItem,
            icon: getItemIcon(newItem, { width: 40, height: 40 }),
        },
        type: categoryTypeMap[newItem.Category] || "scalableIcon",
        sourcePosition: "right",
        targetPosition: "left",
        style: { background: "transparent" },
    };

    setNodes((nds) => [...nds, newNode]);
    setItems((its) => [...its, newItem]);
    setSelectedItem(newItem);
}

/** Add Item Button */
export function AddItemButton({ setNodes, setItems, setSelectedItem }) {
    return (
        <button
            onClick={() => createNewItemNode(setNodes, setItems, setSelectedItem)}
            style={{
                padding: "6px 12px",
                background: "#4CAF50",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
            }}
        >
            Add New Item
        </button>
    );
}

/** Update an item and its node (category/type changes reflected) */
export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem, nodes = []) {
    // merge with existing item
    let prevItem = {};
    setItems((prev) => {
        prevItem = prev.find((it) => it.id === updatedItem.id) || {};
        return prev; // no change yet
    });

    const next = {
        ...prevItem,
        ...updatedItem,
    };

    // --- Normalize Category to a clean string ---
    const rawCategory = next.Category ?? next['Category Item Type'] ?? '';
    next.Category = Array.isArray(rawCategory) ? (rawCategory[0] ?? '') : String(rawCategory || '');
    next['Category Item Type'] = next.Category;

    // --- Normalize Type ---
    if (Array.isArray(next.Type)) next.Type = next.Type[0] ?? '';
    next.Type = String(next.Type ?? '');

    // --- Stable key for SVG lookup ---
    next.TypeKey = normalizeTypeKey(next.Type);

    // Optional: bump to help force icon recompute where memoized
    next.__iconRev = Date.now();

    // --- Normalize code fields ---
    if (!next.Code && next['Item Code']) next.Code = next['Item Code'];
    if (!next['Item Code'] && next.Code) next['Item Code'] = next.Code;

    // ✅ Update items array
    setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));

    // ✅ Update the corresponding node (label, item, and icon)
    setNodes((prevNodes) =>
        prevNodes.map((node) => {
            if (node.id !== next.id) return node;
            const newData = {
                ...node.data,
                label: `${next.Code || ""} - ${next.Name || ""}`,
                item: next,
                // If you use a helper, recompute the icon here:
                icon: getItemIcon ? getItemIcon(next, { width: 40, height: 40 }) : node.data?.icon,
                __iconRev: next.__iconRev, // carry through if your node listens to it
            };
            return {
                ...node,
                data: newData,
            };
        })
    );

    // Keep currently selected item fresh (optional)
    if (typeof setSelectedItem === "function") setSelectedItem(next);
}
