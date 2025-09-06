import React from "react";
import EquipmentIcon from "./Icons/EquipmentIcon";
import InstrumentIcon from "./Icons/InstrumentIcon";
import InlineValveIcon from "./Icons/InlineValveIcon";
import PipeIcon from "./Icons/PipeIcon";
import ElectricalIcon from "./Icons/ElectricalIcon";

/** Map Category → ReactFlow node type (must match keys in nodeTypes) */
export const categoryTypeMap = {
    Pipe: "pipe",
    Equipment: "scalableIcon",
    Instrument: "scalableIcon",
    "Inline Valve": "scalableIcon",
    Electrical: "scalableIcon",
};

/** Default component per category */
const CATEGORY_DEFAULTS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/**
 * Optional: Category → (TypeName → Component)
 * - Keys under each category should match the readable names coming from Airtable (item.TypeName)
 * - Case-insensitive match will be used.
 */
const CATEGORY_TYPE_COMPONENTS = {
    "Inline Valve": {
        // e.g. "Gate Valve": GateValveIcon,
        //       "Ball Valve": BallValveIcon,
    },
    Equipment: {
        // e.g. "Tank": TankIcon,
        //       "Pump": PumpIcon,
    },
    Instrument: {
        // e.g. "Sensor": SensorIcon,
    },
    Pipe: {
        // ...
    },
    Electrical: {
        // ...
    },
};

function norm(v) {
    if (Array.isArray(v)) return String(v[0] ?? "").trim();
    if (v == null) return "";
    return String(v).trim();
}
function lower(s) {
    return String(s || "").toLowerCase();
}

/** Return a React element for an item icon (Category + TypeName aware) */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    const category = norm(item?.Category ?? item?.["Category Item Type"]);
    const typeIdOrName = norm(item?.Type);       // may be recXXXX or a literal name
    const typeName = norm(item?.TypeName || (typeIdOrName?.startsWith("rec") ? "" : typeIdOrName));

    // 1) Try a category+type specific component (by readable TypeName)
    const perType = CATEGORY_TYPE_COMPONENTS[category];
    let Comp = null;
    if (perType && typeName) {
        // case-insensitive match on keys
        const matchKey = Object.keys(perType).find(k => lower(k) === lower(typeName));
        if (matchKey) Comp = perType[matchKey];
    }

    // 2) Fallback to category default
    if (!Comp) {
        Comp = CATEGORY_DEFAULTS[category] || null;
    }

    if (Comp) {
        // Force remount when either category or type changes to refresh SVG
        const key = `${item.id}-${category}-${typeName || ""}`;
        try {
            return (
                <Comp
                    key={key}
                    id={item.id}
                    data={item}
                    category={category}
                    typeName={typeName}
                    {...props}
                />
            );
        } catch (err) {
            console.error("Icon render failed for", category, typeName, err);
        }
    }

    // graceful fallback box
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
            {(typeName || category || "N/A").slice(0, 3)}
        </div>
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
        Type: "",         // Airtable rec id will go here later
        TypeName: "Tank", // readable default helps icon selection
        Unit: "Unit 1",
        SubUnit: "Sub 1",
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

/** Update an item and its node (reflect Category/TypeName changes) */
export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem, nodes = []) {
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

    // Normalize Type (Airtable rec id array or string) — keep as-is
    if (Array.isArray(next.Type)) next.Type = next.Type[0] ?? "";
    next.Type = String(next.Type ?? "");

    // Keep readable TypeName if present
    if (Array.isArray(next.TypeName)) next.TypeName = next.TypeName[0] ?? "";
    next.TypeName = String(next.TypeName ?? "");

    // Normalize codes
    if (!next.Code && next["Item Code"]) next.Code = next["Item Code"];
    if (!next["Item Code"] && next.Code) next["Item Code"] = next.Code;

    // Update items array
    setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));

    // Optional: if you want to change the ReactFlow node.type when Category changes:
    const nextNodeType = categoryTypeMap[next.Category] || "scalableIcon";

    // Helper for repositioning if Unit/SubUnit changed
    function getUnitSubunitPosition(unit, subUnit, nodesArr) {
        const subUnitNode = nodesArr.find((n) => n.id === `sub-${unit}-${subUnit}`);
        if (!subUnitNode) return { x: 100, y: 100 };

        const siblings = nodesArr.filter(
            (n) => n.data?.item?.Unit === unit && n.data?.item?.SubUnit === subUnit && n.id !== next.id
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

            const shouldReposition = next.Unit !== prevItem.Unit || next.SubUnit !== prevItem.SubUnit;
            const newPos = shouldReposition ? getUnitSubunitPosition(next.Unit, next.SubUnit, nds) : node.position;

            return {
                ...node,
                type: nextNodeType,
                position: newPos,
                data: {
                    ...node.data,
                    label: `${next.Code || ""} - ${next.Name || ""}`,
                    item: next,
                    icon: getItemIcon(next, { width: 40, height: 40 }),
                },
            };
        })
    );

    setSelectedItem(next);
}
