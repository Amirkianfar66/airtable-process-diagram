import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import EquipmentIcon from '../Icons/EquipmentIcon';

export default function EquipmentNode({ id, data }) {
    const [showHandles, setShowHandles] = useState(false);
    const hideTimeout = useRef(null);
    const nodeRef = useRef(null);

    // Show handles on mouse enter
    const handleMouseEnter = () => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        setShowHandles(true);
    };

    // Hide handles after 3 seconds on mouse leave
    const handleMouseLeave = () => {
        hideTimeout.current = setTimeout(() => {
            setShowHandles(false);
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (hideTimeout.current) clearTimeout(hideTimeout.current);
        };
    }, []);

    return (
        <div
            ref={nodeRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ position: 'relative', width: 200, height: 200 }}
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
