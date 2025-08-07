import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import EquipmentIcon from '../icons/Equipment';
import PipeIcon from '../icons/Pipe';
import InstrumentIcon from '../icons/Instrument';
import InlineValveIcon from '../icons/InlineValve';
import ElectricalIcon from '../icons/Electrical';

const categoryToIcon: Record<string, React.ElementType> = {
    Equipment: EquipmentIcon,
    Pipe: PipeIcon,
    Instrument: InstrumentIcon,
    'Inline Valve': InlineValveIcon,
    Electrical: ElectricalIcon,
};

const iconSize = 80;

export default function ScalableIconNode({ data }: NodeProps) {
    const [showButtons, setShowButtons] = useState(false);

    const Icon = categoryToIcon[data.category] || EquipmentIcon;

    useEffect(() => {
        if (showButtons) {
            const timeout = setTimeout(() => setShowButtons(false), 3000);
            return () => clearTimeout(timeout);
        }
    }, [showButtons]);

    const handleMouseEnter = () => setShowButtons(true);
    const handleMouseLeave = () => setShowButtons(false);

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative flex items-center justify-center"
            style={{ width: iconSize, height: iconSize }}
        >
            {/* Scalable SVG Icon */}
            <Icon className="w-full h-full" />

            {/* Top Buttons */}
            {showButtons && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-1 transition-opacity duration-300 opacity-100">
                    <button className="text-xs bg-white border rounded px-1 shadow">Edit</button>
                    <button className="text-xs bg-white border rounded px-1 shadow">Delete</button>
                </div>
            )}

            {/* Static-size Handles positioned at the border */}
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    background: '#555',
                    width: 8,
                    height: 8,
                    top: iconSize / 2 - 4,
                    right: -4,
                }}
            />
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    background: '#555',
                    width: 8,
                    height: 8,
                    top: iconSize / 2 - 4,
                    left: -4,
                }}
            />
        </div>
    );
}
