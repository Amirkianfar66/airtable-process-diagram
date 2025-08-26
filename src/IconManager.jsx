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
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    // Normalize category text
    const category = (item.Category || item["Category Item Type"] || "").trim();
    const CategoryComponent = CATEGORY_COMPONENTS[category];

    if (CategoryComponent) {
        return <CategoryComponent id={item.id} data={item} {...props} />;
    }

    return <div style={{ width: props.width || 40, height: props.height || 100, background: "#ccc" }} />;
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
export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem) {
    // Keep normalized mirrors in sync
    const next = { ...updatedItem };
    if (!next.Category && next["Category Item Type"]) next.Category = next["Category Item Type"];
    if (!next["Category Item Type"] && next.Category) next["Category Item Type"] = next.Category;
    if (!next.Code && next["Item Code"]) next.Code = next["Item Code"];
    if (!next["Item Code"] && next.Code) next["Item Code"] = next.Code;

    setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));

    setNodes((nds) =>
        nds.map((node) =>
            node.id === next.id
                ? {
                    ...node,
                    type: categoryTypeMap[next.Category] || "scalableIcon",
- position : {
- x: next.x ?? node.position.x,
            -                   y: next.y ?? node.position.y,
            -               },
+               position: (next.Unit && next.SubUnit)
    +                   ? getUnitSubunitPosition(next.Unit, next.SubUnit, nds)
+                   : { x: next.x ?? node.position.x, y: next.y ?? node.position.y },
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


    setSelectedItem(next);
}
