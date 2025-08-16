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
 * Get icon for an item
 */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    // Equipment handled separately
    if (item.Category === "Equipment") {
        const typeIcon = EQUIPMENT_TYPE_ICONS[item.Type];
        if (typeIcon) {
            // SVG URL
            if (typeof typeIcon === "string") return <img src={typeIcon} alt={item.Type} {...props} />;
            // React component
            return React.createElement(typeIcon, props);
        }
        // fallback generic Equipment icon
        return <EquipmentIcon {...props} />;
    }

    // Non-Equipment categories
    const CategoryComponent = CATEGORY_ICONS[item.Category];
    if (CategoryComponent) return React.createElement(CategoryComponent, props);

    return null;
}

/**
 * Create a new item and node
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
            icon: getItemIcon(newItem, { width: 40, height: 40 }),
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
 * Add Item Button component
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
 * Handle updates to an item and its node
 */
export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem) {
    setItems((prev) => prev.map(it => it.id === updatedItem.id ? updatedItem : it));

    setNodes((nds) =>
        nds.map((node) => {
            if (node.id === updatedItem.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: `${updatedItem.Code || ''} - ${updatedItem.Name || ''}`,
                        icon: getItemIcon(updatedItem, { width: 20, height: 20 }),
                    },
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
