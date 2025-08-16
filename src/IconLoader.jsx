// src/utils/IconLoader.js
import { ReactComponent as PumpIcon } from "../assets/icons/pump.svg";
import { ReactComponent as TankIcon } from "../assets/icons/tank.svg";
import { ReactComponent as ConveyorIcon } from "../assets/icons/conveyor.svg";

// ✅ Map type names to SVGs
const customSVGMap = {
  Pump: PumpIcon,
  Tank: TankIcon,
  Conveyor: ConveyorIcon,
};

export function getIconForItem(item) {
  const { type, category } = item;

  // 1️⃣ Use SVG if available
  if (type && customSVGMap[type]) {
    return customSVGMap[type];
  }

  // 2️⃣ Otherwise fallback to category-based icon/component
  switch (category) {
    case "Pipe":
      return () => <div className="w-8 h-2 bg-gray-500 rounded" />;
    case "Valve":
      return () => <div className="w-6 h-6 border-2 border-black rounded-full" />;
    case "Equipment":
      return () => <div className="w-8 h-8 bg-blue-300 rounded-lg" />;
    default:
      return () => <div className="w-6 h-6 bg-gray-300 rounded" />;
  }
}
