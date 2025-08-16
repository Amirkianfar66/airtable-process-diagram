import React from "react";
import TankSVG from "./Icons/tank.svg";
import PumpSVG from "./Icons/pump.svg";
import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

/** Type-specific icons for Equipment */
const EQUIPMENT_TYPE_ICONS = {
    Tank: TankSVG,
    Pump: PumpSVG,
};

/** Fallback icons for other categories */
const CATEGORY_ICONS = {
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/** Return a React element for an item icon */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    if (item.Category === "Equipment") {
        if (item.Type && EQUIPMENT_TYPE_ICONS[item.Type]) {
            const typeIcon = EQUIPMENT_TYPE_ICONS[item.Type];
            return typeof typeIcon === "string"
                ? <img src={typeIcon} alt={item.Type} {...props} />
                : React.createElement(typeIcon, props);
        }
        return <EquipmentIcon id={item.id} data={item} {...props} />;
    }

    const CategoryComponent = CATEGORY_ICONS[item.Category];
    if (CategoryComponent) return <CategoryComponent {...props} />;

    // fallback for unknown category
    return <EquipmentIcon id={item.id} data={item} {...props} />;
}

/** Create a new item node */
export function createNewItemNode(setNodes, setItems, setSelectedItem) {
    const newItem = {
        id: `item-${Date.now()}`,
        Code: 'NEW001',
        Name: 'New Item',
        Category: 'Equipment',
        Type: 'Tank',
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

    setNodes(nds => [...nds, newNode]);
    setItems(its => [...its, newItem]);
    setSelectedItem(newItem);
}

/** Add Item Button */
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

/** Update an item and its node (category/type changes reflected) */
export function handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem) {
    setItems(prev => prev.map(it => it.id === updatedItem.id ? updatedItem : it));

    setNodes(nds =>
        nds.map(node => {
            if (node.id === updatedItem.id) {
                const newIcon = getItemIcon(updatedItem, { width: 20, height: 20 });
                const iconWithKey = React.isValidElement(newIcon)
                    ? React.cloneElement(newIcon, { key: `${updatedItem.id}-${updatedItem.Category}-${updatedItem.Type}` })
                    : newIcon;

                return {
                    ...node,
                    type: updatedItem.Category === 'Equipment'
                        ? 'equipment'
                        : (updatedItem.Category === 'Pipe' ? 'pipe' : 'scalableIcon'),
                    data: {
                        ...node.data,
                        label: `${updatedItem.Code || ''} - ${updatedItem.Name || ''}`,
                        icon: iconWithKey,
                    },
                };
            }
            return node;
        })
    );

    setSelectedItem(updatedItem);
}

