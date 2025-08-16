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
