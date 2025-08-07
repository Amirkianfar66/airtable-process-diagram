import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import EquipmentIcon from '../Icons/EquipmentIcon';

export default function EquipmentNode({ id, data }) {
    const [showHandles, setShowHandles] = useState(false);
    const hideTimeoutRef = useRef(null);

    const handleMouseEnter = () => {
        clearTimeout(hideTimeoutRef.current); // cancel any pending hide
        setShowHandles(true);
    };

    const handleMouseLeave = () => {
        hideTimeoutRef.current = setTimeout(() => {
            setShowHandles(false);
        }, 3000); // hide after 3 seconds
    };

    useEffect(() => {
        return () => clearTimeout(hideTimeoutRef.current); // cleanup on unmount
    }, []);

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                position: 'relative',
                width: 200,
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {showHandles && (
                <>
                    <Handle type="source" position={Position.Top} />
                    <Handle type="source" position={Position.Right} />
                    <Handle type="source" position={Position.Bottom} />
                    <Handle type="source" position={Position.Left} />
                </>
            )}
            <EquipmentIcon />
        </div>
    );
}
