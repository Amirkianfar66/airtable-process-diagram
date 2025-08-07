import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import EquipmentIcon from '../Icons/EquipmentIcon';

export default function EquipmentNode({ id, data }) {
    const [showHandles, setShowHandles] = useState(false);
    const timeoutRef = useRef(null);

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current);
        setShowHandles(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowHandles(false);
        }, 3000); // Hide after 3 seconds
    };

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    return (
        <div
            style={{ width: 200, height: 200, position: 'relative' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* SVG Icon */}
            <EquipmentIcon />

            {/* Conditional Handles */}
            {showHandles && (
                <>
                    <Handle type="source" position={Position.Top} style={{ top: 0, left: '50%' }} />
                    <Handle type="source" position={Position.Right} style={{ right: 0, top: '50%' }} />
                    <Handle type="source" position={Position.Bottom} style={{ bottom: 0, left: '50%' }} />
                    <Handle type="source" position={Position.Left} style={{ left: 0, top: '50%' }} />
                </>
            )}
        </div>
    );
}
