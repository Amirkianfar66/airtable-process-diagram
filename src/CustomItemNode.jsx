// ✅ Import SVGs as React components
import { ReactComponent as TankSVG } from "../icons/tank.svg";
import { ReactComponent as PumpSVG } from "../icons/pump.svg";

// ✅ Map Airtable type/category to SVG
const ICON_MAP = {
    EquipmentTank: <TankSVG width={40} height={40} />,
    EquipmentPump: <PumpSVG width={40} height={40} />,
};

// ✅ Node renderer
export default function CustomItemNode({ data }) {
    const Icon = ICON_MAP[data.type]; // match by "type" field

    return (
        <div style={{ background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {/* If we have a matching SVG → use it, otherwise fallback to category icon */}
            {Icon || data.icon}
            <span style={{ color: "#000", fontSize: 12 }}>{data.label}</span>
        </div>
    );
}
