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
    // Capture prevItem and atomically update items in a single updater
    let prevItem = {};
    setItems((prev) => {
        prevItem = prev.find((it) => it.id === updatedItem.id) || {};
        // Merge updated fields into the matched item while preserving x/y when not explicitly set
        return prev.map((it) => {
            if (it.id !== updatedItem.id) return it;
            return {
                ...it,
                ...updatedItem,
                x: ('x' in updatedItem) ? updatedItem.x : it.x,
                y: ('y' in updatedItem) ? updatedItem.y : it.y,
            };
        });
    });

    // Build the "next" merged item (based on prevItem we just captured)
    const next = {
        ...prevItem,
        ...updatedItem,
    };

    // Normalize Category / Type / Code fields
    const rawCategory = next.Category ?? next['Category Item Type'] ?? '';
    next.Category = Array.isArray(rawCategory) ? (rawCategory[0] ?? '') : String(rawCategory || '');
    next['Category Item Type'] = next.Category;

    if (Array.isArray(next.Type)) next.Type = next.Type[0] ?? '';
    next.Type = String(next.Type ?? '');

    if (!next.Code && next['Item Code']) next.Code = next['Item Code'];
    if (!next['Item Code'] && next.Code) next['Item Code'] = next.Code;

    // Helper for repositioning only when Unit/SubUnit changes
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

    // Update nodes: preserve position unless Unit/SubUnit changed.
    setNodes((nds) =>
        nds.map((node) => {
            if (node.id !== next.id) return node;

            // previous position (may be undefined in edge cases) — prefer actual node.position if present
            const oldPos = node.position;

            // compute whether we should reposition
            const shouldReposition = (next.Unit !== prevItem.Unit) || (next.SubUnit !== prevItem.SubUnit);

            // If node.position undefined, try to fall back to any saved coordinates (node.data.x/y or node.data.item.x/y or next.x/next.y)
            // If node.position undefined, try to fall back to any saved coordinates
            const fallbackPos = (() => {
                if (oldPos && typeof oldPos.x === 'number' && typeof oldPos.y === 'number') {
                    return oldPos;
                }

                if (node.data && typeof node.data.x === 'number' && typeof node.data.y === 'number') {
                    return { x: node.data.x, y: node.data.y };
                }

                if (node.data?.item && typeof node.data.item.x === 'number' && typeof node.data.item.y === 'number') {
                    return { x: node.data.item.x, y: node.data.item.y };
                }

                if (typeof next.x === 'number' && typeof next.y === 'number') {
                    return { x: next.x, y: next.y };
                }

                return undefined;
            })();

            const newPos = shouldReposition ? getUnitSubunitPosition(next.Unit, next.SubUnit, nds) : (fallbackPos ?? { x: 100, y: 100 });

            return {
                ...node,
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

    // Keep selection updated
    setSelectedItem(next);
}

