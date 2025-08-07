import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import EquipmentIcon from '../Icons/EquipmentIcon';

export default function EquipmentNode({ data }) {
    const [showHandles, setShowHandles] = useState(false);
    const timeoutRef = useRef(null);

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current);
        setShowHandles(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowHandles(false);
        }, 3000); // Hide after 3s
    };

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                width: 100,
                height: 100,
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            {/* Equipment SVG */}
            <EquipmentIcon />

            {/* Handles on border */}
            {showHandles && (
                <>
                    <Handle type="source" position={Position.Top} style={{ top: -8 }} />
                    <Handle type="source" position={Position.Right} style={{ right: -8 }} />
                    <Handle type="source" position={Position.Bottom} style={{ bottom: -8 }} />
                    <Handle type="source" position={Position.Left} style={{ left: -8 }} />
                </>
            )}
        </div>
    );
}
