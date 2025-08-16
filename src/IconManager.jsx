// src/IconManager.js
import TankSVG from "./Icons/tank.svg";
import PumpSVG from "./Icons/pump.svg";

// Category default icons (you can replace these with other URLs or components)
import EquipmentIcon from "./Icons/EquipmentIcon";
import InstrumentIcon from "./Icons/InstrumentIcon";
import InlineValveIcon from "./Icons/InlineValveIcon";
import PipeIcon from "./Icons/PipeIcon";
import ElectricalIcon from "./Icons/ElectricalIcon";

// Map of Type-specific icons (just URLs)
const TYPE_ICONS = {
    EquipmentTank: TankSVG,
    EquipmentPump: PumpSVG,
};

// Map of Category default icons (could be React components)
const CATEGORY_ICONS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/**
 * Get the icon URL or component for a given item
 * @param {Object} item - item object
 * @returns string|ReactComponent
 */
export function getItemIcon(item) {
    if (!item) return null;

    const typeKey = `${item.Category}${item.Type || ""}`;

    // 1️⃣ Try type-specific icon
    if (TYPE_ICONS[typeKey]) return TYPE_ICONS[typeKey];

    // 2️⃣ Fallback to category icon
    const CategoryComponent = CATEGORY_ICONS[item.Category];
    if (CategoryComponent) return CategoryComponent;

    return null;
}
