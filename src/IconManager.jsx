// src/IconManager.jsx
import React from "react";

// ✅ Import SVGs as React components (requires vite-plugin-svgr)
import { ReactComponent as TankSVG } from "./Icons/tank.svg";
import { ReactComponent as PumpSVG } from "./Icons/pump.svg";

// ✅ Import category React components
import EquipmentIcon from "./Icons/EquipmentIcon";
import InstrumentIcon from "./Icons/InstrumentIcon";
import InlineValveIcon from "./Icons/InlineValveIcon";
import PipeIcon from "./Icons/PipeIcon";
import ElectricalIcon from "./Icons/ElectricalIcon";

// Map of Type-specific SVGs
const TYPE_SVGS = {
    EquipmentTank: (props) => <TankSVG {...props} />,
    EquipmentPump: (props) => <PumpSVG {...props} />,
};

// Map of Category default icons
const CATEGORY_ICONS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/**
 * Get the icon component for a given item
 * @param {Object} item - The item object
 * @param {string} item.Category - Category name
 * @param {string} item.Type - Type name (optional)
 * @param {Object} props - Props to pass to the component (style, width, height, etc.)
 * @returns JSX.Element
 */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    const typeKey = `${item.Category}${item.Type || ""}`; // e.g., "EquipmentTank"

    // 1️⃣ Try type-specific SVG first
    if (TYPE_SVGS[typeKey]) {
        return TYPE_SVGS[typeKey](props);
    }

    // 2️⃣ Fallback to category component
    const CategoryComponent = CATEGORY_ICONS[item.Category];
    if (CategoryComponent) {
        return <CategoryComponent {...props} />;
    }

    // 3️⃣ Default fallback (optional)
    return null;
}
