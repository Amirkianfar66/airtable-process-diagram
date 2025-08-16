import React from "react";
import TankSVG from "./Icons/tank.svg";
import PumpSVG from "./Icons/pump.svg";
import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

/**
 * Type-specific icons (only Equipment types)
 */
const EQUIPMENT_TYPE_ICONS = {
    Tank: TankSVG,
    Pump: PumpSVG,
};

/**
 * Category fallback icons
 */
const CATEGORY_ICONS = {
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/**
 * Wrapper for scalable EquipmentIcon
 */
export function EquipmentNodeWrapper({ item, ...props }) {
    return <EquipmentIcon id={item.id} data={item} {...props} />;
}

/**
 * Get icon for an item (used in React Flow nodes)
 */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    if (item.Category === "Equipment") {
        if (item.Type && EQUIPMENT_TYPE_ICONS[item.Type]) {
            const typeIcon = EQUIPMENT_TYPE_ICONS[item.Type];
            return typeof typeIcon === "string"
                ? <img src={typeIcon} alt={item.Type} {...props} />
                : React.createElement(typeIcon, props);
        }
        // fallback to scalable EquipmentIcon
        return <EquipmentNodeWrapper item={item} {...props} />;
    }

    const CategoryComponent = CATEGORY_ICONS[item.Category];
    if (CategoryComponent) return React.createElement(CategoryComponent, props);

    return null;
}

/**
 * Create a new item and React Flow node
 */
export function createNewItemNode(setNodes, setItems, setSelectedItem) {
    const newItem = {
        id: `item-${Date.now()}`,
        Code: 'NEW001',
        Name: 'New Item',
        Category: 'Equipment',
        Type: 'Tank', // default Equipment type
        Unit: 'Unit 1',
        SubUnit: 'Sub 1',
    };

    const newNode = {
        id: newItem.id,
        position: { x: 100, y: 100 },
        data: {
            label: `${newItem.Code} - ${newItem.Name}`,
            icon: getItemIcon(newItem), // automatic fallback handled
        },
        type: 'equipment',
        sourcePosition: 'right',
        targetPosition: 'left',
        style: { background: 'transparent' },
    };

    setNodes((nds) => [...nds, newNode]);
    setItems((its) => [...its, newItem]);
    setSelectedItem(newItem);
}

/**
 * Button component to add new item
 */
export function AddItemButton({ setNodes, setItems, setSelectedItem }) {
    return (
        <button
            onClick={() => createNewItemNode(setNodes, setItems, setSelectedItem)}
            style={{
                padding: '6px 12px',
                background: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
            }}
        >
            Add New Item
        </button>
    );
}

/**
 * Update an item and its node in React Flow
 */
// IconManager.js

export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem) {
    // Update the item in the items state
    setItems((prev) => prev.map(it => it.id === updatedItem.id ? updatedItem : it));

    // Update the node in the nodes state
    setNodes((nds) =>
        nds.map((node) => {
            if (node.id === updatedItem.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: `${updatedItem.Code || ''} - ${updatedItem.Name || ''}`,
                        // Automatically get the correct icon based on current Category/Type
                        icon: getItemIcon(updatedItem),
                    },
                    // Optional: you can also change node type dynamically if needed
                    type: updatedItem.Category === 'Equipment'
                        ? 'equipment'
                        : (updatedItem.Category === 'Pipe' ? 'pipe' : 'scalableIcon'),
                };
            }
            return node;
        })
    );

    setSelectedItem(updatedItem);
}

