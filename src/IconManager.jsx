// File: src/components/IconManager.jsx
import React from "react";
import EquipmentIcon from "./Icons/EquipmentIcon";
import InstrumentIcon from "./Icons/InstrumentIcon";
import InlineValveIcon from "./Icons/InlineValveIcon";
import PipeIcon from "./Icons/PipeIcon";
import ElectricalIcon from "./Icons/ElectricalIcon";

/** Map Category → ReactFlow node type (must match keys in `nodeTypes` in ProcessDiagram) */
export const categoryTypeMap = {
    Pipe: "pipe",
    Equipment: "scalableIcon",
    Instrument: "scalableIcon",
    "Inline Valve": "scalableIcon",
    Electrical: "scalableIcon",
};

/** Category → default component */
const CATEGORY_COMPONENTS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/**
 * Optional: (Category, Type) → specific component map.
 * If you have separate icons per valve type, register them here:
 * e.g.
 * const GateValveIcon = ...;
 * TYPE_COMPONENTS["Inline Valve"]["Gate Valve"] = GateValveIcon;
 */
const TYPE_COMPONENTS = {
    "Inline Valve": {
        // "Gate Valve": GateValveIcon,
        // "Ball Valve": BallValveIcon,
    },
};

/** Small helper to normalize values coming from Airtable arrays, etc. */
function normalize(val) {
    if (Array.isArray(val)) return String(val[0] ?? "").trim();
    if (val == null) return "";
    return String(val).trim();
}

/** Public: pick node type for a category (with fallback) */
export function getNodeTypeForCategory(category) {
    return categoryTypeMap[category] || "scalableIcon";
}

/** Return a React element for an item icon (remounts when Category/Type changes) */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    const category = normalize(item?.Category ?? item?.["Category Item Type"]);
    const type = normalize(item?.Type);

    const TypeComponent = TYPE_COMPONENTS?.[category]?.[type];
    const CategoryComponent = CATEGORY_COMPONENTS[category] || null;
    const Comp = TypeComponent || CategoryComponent;

    if (Comp) {
        try {
            // key forces a remount when either category or type changes
            return (
                <Comp
                    key={`${item.id}-${category}-${type}`}
                    id={item.id}
                    data={item}
                    type={type}
                    category={category}
                    {...props}
                />
            );
        } catch (err) {
            console.error("Icon render failed for", category, type, err);
            return (
                <div
                    style={{
                        width: props.width || 40,
                        height: props.height || 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#eee",
                        borderRadius: 6,
                        fontSize: 10,
                        color: "#444",
                    }}
                >
                    {(type || category || "N/A").slice(0, 3)}
                </div>
            );
        }
    }

    // Fallback gray box
    return (
        <div
            style={{
                width: props.width || 40,
                height: props.height || 40,
                background: "#ccc",
                borderRadius: 6,
            }}
        />
    );
}

/** Create a new item and its node */
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
        // placeholders for edge helpers if you use them elsewhere
        edgeId: "",
        from: "",
        to: "",
    };

    const nodeType = getNodeTypeForCategory(newItem.Category);

    const newNode = {
        id: newItem.id,
        position: { x: 100, y: 100 },
        data: {
            label: `${newItem.Code} - ${newItem.Name}`,
            item: newItem,
            icon: getItemIcon(newItem, { width: 40, height: 40 }),
        },
        type: nodeType,
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

/** Update an item + its node (reflect Category/Type changes in both icon and node.type) */
export function handleItemChangeNode(
    updatedItem,
    setItems,
    setNodes,
    setSelectedItem,
    nodes = []
) {
    // Read previous item to compare Unit/SubUnit changes for repositioning
    let prevItem = {};
    setItems((prev) => {
        prevItem = prev.find((it) => it.id === updatedItem.id) || {};
        return prev;
    });

    const next = { ...prevItem, ...updatedItem };

    // Normalize Category
    const rawCategory = next.Category ?? next["Category Item Type"] ?? "";
    next.Category = Array.isArray(rawCategory) ? (rawCategory[0] ?? "") : String(rawCategory);
    next["Category Item Type"] = next.Category;

    // Normalize Type
    if (Array.isArray(next.Type)) next.Type = next.Type[0] ?? "";
    next.Type = String(next.Type ?? "");

    // Normalize code fields
    if (!next.Code && next["Item Code"]) next.Code = next["Item Code"];
    if (!next["Item Code"] && next.Code) next["Item Code"] = next.Code;

    // ✅ Update items array
    setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));

    // Helper: compute a position when Unit/SubUnit changes
    function getUnitSubunitPosition(unit, subUnit, nodesArr) {
        const subUnitNode = nodesArr.find((n) => n.id === `sub-${unit}-${subUnit}`);
        if (!subUnitNode) return { x: 100, y: 100 };

        const siblings = nodesArr.filter(
            (n) =>
                n.data?.item?.Unit === unit &&
                n.data?.item?.SubUnit === subUnit &&
                n.id !== next.id
        );

        const itemWidth = 160;
        const itemGap = 30;

        return {
            x: subUnitNode.position.x + 40 + siblings.length * (itemWidth + itemGap),
            y: subUnitNode.position.y + 40,
        };
    }

    setNodes((nds) =>
        nds.map((node) => {
            if (node.id !== next.id) return node;

            const shouldReposition =
                next.Unit !== prevItem.Unit || next.SubUnit !== prevItem.SubUnit;
            const position = shouldReposition
                ? getUnitSubunitPosition(next.Unit, next.SubUnit, nds)
                : node.position;

            // 🔑 Update the ReactFlow node.type if Category changed
            const nextNodeType = getNodeTypeForCategory(next.Category);

            return {
                ...node,
                type: nextNodeType,
                position,
                data: {
                    ...node.data,
                    label: `${next.Code || ""} - ${next.Name || ""}`,
                    item: next,
                    // This React element carries a key that changes with Category/Type → remounts SVG
                    icon: getItemIcon(next, { width: 40, height: 40 }),
                },
            };
        })
    );

    setSelectedItem(next);
}
