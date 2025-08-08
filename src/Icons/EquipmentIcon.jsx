import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { setNodes } = useReactFlow();
    const [hovered, setHovered] = useState(false);
    const groupRef = useRef(null);

    const scaleX = data?.scaleX || 1;
    const scaleY = data?.scaleY || 1;

    const iconSize = 60;
    const baseX = 20;
    const baseY = 20;
    const centerX = baseX + iconSize / 2;
    const centerY = baseY + iconSize / 2;

    const handleOffset = 10;

    const handles = [
        { id: 'top', position: Position.Top, x: centerX, y: baseY - handleOffset },
        { id: 'bottom', position: Position.Bottom, x: centerX, y: baseY + iconSize + handleOffset },
        { id: 'left', position: Position.Left, x: baseX - handleOffset, y: centerY },
        { id: 'right', position: Position.Right, x: baseX + iconSize + handleOffset, y: centerY },
    ];

    useEffect(() => {
        const group = groupRef.current;
        if (group) {
            const bbox = group.getBBox();
            setNodes(nodes => nodes.map(node =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            width: bbox.width,
                            height: bbox.height
                        }
                    }
                    : node
            ));
        }
    }, [id, setNodes, scaleX, scaleY]);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ width: 200, height: 200 }}
        >
            <svg width={200} height={200}>
                <g ref={groupRef} transform={`scale(${scaleX}, ${scaleY})`}>
                    <rect x={baseX} y={baseY} width={iconSize} height={iconSize} fill="green" />
                    <text x={centerX} y={centerY + 5} fontSize="16" textAnchor="middle" fill="white">EQ</text>
                </g>

                {hovered && handles.map(h => (
                    <Handle
                        key={h.id}
                        type="source"
                        id={h.id}
                        position={h.position}
                        style={{ left: h.x, top: h.y, transform: 'none', width: 10, height: 10 }}
                    />
                ))}
            </svg>
        </div>
    );
}
