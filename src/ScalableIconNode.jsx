import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const svgRef = useRef(null);

    useEffect(() => {
        if (svgRef.current) {
            const { width, height } = svgRef.current.getBBox();
            setDimensions({ width, height });
        }
    }, [data]);

    const handleMouseEnter = () => setHovered(true);
    const handleMouseLeave = () => setHovered(false);

    return (
        <div style={{ position: 'relative', width: dimensions.width, height: dimensions.height }}>
            {/* LEFT Handle */}
            <Handle
                type="source"
                position={Position.Left}
                style={{
                    top: dimensions.height / 2,
                    left: 0,
                    transform: 'translate(-50%, -50%)',
                }}
                id="left"
            />

            {/* RIGHT Handle */}
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: dimensions.height / 2,
                    left: dimensions.width,
                    transform: 'translate(-50%, -50%)',
                }}
                id="right"
            />

            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                viewBox="0 0 100 100"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <rect x="20" y="20" width="60" height="60" fill="green" stroke="black" strokeWidth="4" />
                {hovered && (
                    <text x="50" y="55" fontSize="10" textAnchor="middle" fill="white">
                        Equipment
                    </text>
                )}
            </svg>
        </div>
    );
}