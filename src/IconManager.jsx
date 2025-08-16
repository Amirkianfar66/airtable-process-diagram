import React from "react";

// Import all SVG files
import { ReactComponent as TankSVG } from "./tank.svg";
import { ReactComponent as PumpSVG } from "./pump.svg";

// Import category React components
import EquipmentIcon from "../components/Icons/EquipmentIcon";
import InstrumentIcon from "../components/Icons/InstrumentIcon";
import InlineValveIcon from "../components/Icons/InlineValveIcon";
import PipeIcon from "../components/Icons/PipeIcon";
import ElectricalIcon from "../components/Icons/ElectricalIcon";

// Map of Type-specific SVGs
const TYPE_SVGS = {
  EquipmentTank: <TankSVG width={40} height={40} />,
  EquipmentPump: <PumpSVG width={40} height={40} />,
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
 * @param {Object} props - Props to pass to the component (style, etc.)
 * @returns JSX.Element
 */
export function getItemIcon(item, props = {}) {
  if (!item) return null;

  const typeKey = `${item.Category}${item.Type || ""}`; // e.g. "EquipmentTank"

  // 1️⃣ Try type-specific SVG first
  if (TYPE_SVGS[typeKey]) {
    return TYPE_SVGS[typeKey];
  }

  // 2️⃣ Fallback to category icon
  const CategoryComponent = CATEGORY_ICONS[item.Category];
  if (CategoryComponent) {
    return <CategoryComponent {...props} />;
  }

  // 3️⃣ Default fallback (optional)
  return null;
}
