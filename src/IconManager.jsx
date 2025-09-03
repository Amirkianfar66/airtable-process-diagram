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

/** Category components */
const CATEGORY_COMPONENTS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
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
/** Update an item and its node (category/type changes reflected) */
export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem, nodes = []) {
    // Keep normalized mirrors in sync
    const next = { ...updatedItem };
    if (!next.Category && next["Category Item Type"]) next.Category = next["Category Item Type"];
    if (!next["Category Item Type"] && next.Category) next["Category Item Type"] = next.Category;
    if (!next.Code && next["Item Code"]) next.Code = next["Item Code"];
    if (!next["Item Code"] && next.Code) next["Item Code"] = next.Code;

    // Update items array
    setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));

    // Helper: calculate new position in Unit/SubUnit
    function getUnitSubunitPosition(unit, subUnit, nodesArr) {
        const unitNode = nodesArr.find(n => n.id === `unit-${unit}`);
        const subUnitNode = nodesArr.find(n => n.id === `sub-${unit}-${subUnit}`);

        if (!subUnitNode) {
            return { x: 100, y: 100 }; // fallback
        }

        const siblings = nodesArr.filter(n =>
            n.data?.item?.Unit === unit && n.data?.item?.SubUnit === subUnit && n.id !== next.id
        );

        const itemWidth = 160;
        const itemGap = 30;

        const x = subUnitNode.position.x + 40 + siblings.length * (itemWidth + itemGap);
        const y = subUnitNode.position.y + 40;

        return { x, y };
    }

    // Update nodes array
    setNodes((nds) =>
        nds.map((node) =>
            node.id === next.id
                ? {
                    ...node,
                    type: categoryTypeMap[next.Category] || "scalableIcon",
                    position: getUnitSubunitPosition(next.Unit, next.SubUnit, nds),
                    data: {
                        ...node.data,
                        label: `${next.Code || ""} - ${next.Name || ""}`,
                        item: next,
                        icon: getItemIcon(next, { width: 40, height: 40 }),
                    },
                }
                : node
        )
    );

    // Update selected item
    setSelectedItem(next);
}

