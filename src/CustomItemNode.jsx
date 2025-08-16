// ✅ Import SVGs as React components
import { ReactComponent as TankSVG } from "'./Icons/tank.svg";
import { ReactComponent as PumpSVG } from './Icons/pump.svg";

// ✅ Map types to SVG icons
const ICON_MAP = {
    EquipmentTank: <TankSVG width={40} height={40} />,
    EquipmentPump: <PumpSVG width={40} height={40} />,
};

export default function CustomItemNode({ data }) {
    const icon = ICON_MAP[data.type] || data.icon; // fallback to category-based icon

    return (
        <div
            style={{
                background: "transparent",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
            }}
        >
            {icon}
            <span style={{ color: "#000", fontSize: 12 }}>{data.label}</span>
        </div>
    );
}
