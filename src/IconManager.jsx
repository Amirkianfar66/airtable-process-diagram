import TankSVG from "./Icons/tank.svg";
import PumpSVG from "./Icons/pump.svg";
import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

/**
 * Map of Type-specific icons (can be URLs or React components)
 */
const TYPE_ICONS = {
    EquipmentTank: TankSVG,
    EquipmentPump: PumpSVG,
};

/**
 * Map of Category default icons (React components)
 */
const CATEGORY_ICONS = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    "Inline Valve": InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

/**
 * Get the icon for a given item
 * @param {Object} item - { Category, Type }
 * @param {Object} props - optional props for React components (width, height, style)
 * @returns string|ReactComponent
 */
export function getItemIcon(item, props = {}) {
    if (!item) return null;

    const typeKey = `${item.Category}${item.Type || ""}`;

    // 1️⃣ Type-specific icon (URL or component)
    const typeIcon = TYPE_ICONS[typeKey];
    if (typeIcon) {
        // if it's a string (URL), return <img>
        if (typeof typeIcon === "string") return <img src={typeIcon} alt={item.Type} {...props} />;
        // if it's a React component
        return React.createElement(typeIcon, props);
    }

    // 2️⃣ Category fallback
    const CategoryComponent = CATEGORY_ICONS[item.Category];
    if (CategoryComponent) return React.createElement(CategoryComponent, props);

    // 3️⃣ No icon
    return null;
}
