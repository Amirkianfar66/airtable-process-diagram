import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const { xPos, yPos, width, height, scaleX = 1, scaleY = 1 } = data;
    const [hovered, setHovered] = useState(false);
    const svgRef = useRef(null);
    const { setNodes } = useReactFlow();

    const handleSize = 10; // Keep handle size constant

    useEffect(() => {
        if (svgRef.current) {
            const bbox = svgRef.current.getBBox();
            setNodes((nodes) =>
                nodes.map((node) =>
                    node.id === id
                        ? {
                            ...node,
                            data: {
                                ...node.data,
                                width: bbox.width,
                                height: bbox.height,
                            },
                        }
                        : node
                )
            );
        }
    }, [id, setNodes]);

    return (
        <div
            style={{ position: 'relative', width: width || 100, height: height || 100 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <svg
                ref={svgRef}
                width={100 * scaleX}
                height={100 * scaleY}
                viewBox="0 0 100 100"
                style={{ display: 'block' }}
            >
                <rect
                    x={20 * scaleX}
                    y={20 * scaleY}
                    width={60 * scaleX}
                    height={60 * scaleY}
                    fill="green"
                />
                <text
                    x={50 * scaleX}
                    y={55 * scaleY}
                    fontSize={16 * Math.min(scaleX, scaleY)}
                    fill="white"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                >
                    EQ
                </text>
            </svg>

            {hovered && (
                <>
                    {/* Left handle */}
                    <Handle
                        type="source"
                        position={Position.Left}
                        style={{
                            background: '#555',
                            border: '2px solid white',
                            width: handleSize,
                            height: handleSize,
                            borderRadius: '50%',
                            position: 'absolute',
                            left: -handleSize / 2,
                            top: '50%',
                            transform: 'translateY(-50%)',
                        }}
                    />

                    {/* Right handle */}
                    <Handle
                        type="source"
                        position={Position.Right}
                        style={{
                            background: '#555',
                            border: '2px solid white',
                            width: handleSize,
                            height: handleSize,
                            borderRadius: '50%',
                            position: 'absolute',
                            right: -handleSize / 2,
                            top: '50%',
                            transform: 'translateY(-50%)',
                        }}
                    />

                    {/* Top handle */}
                    <Handle
                        type="source"
                        position={Position.Top}
                        style={{
                            background: '#555',
                            border: '2px solid white',
                            width: handleSize,
                            height: handleSize,
                            borderRadius: '50%',
                            position: 'absolute',
                            top: -handleSize / 2,
                            left: '50%',
                            transform: 'translateX(-50%)',
                        }}
                    />

                    {/* Bottom handle */}
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        style={{
                            background: '#555',
                            border: '2px solid white',
                            width: handleSize,
                            height: handleSize,
                            borderRadius: '50%',
                            position: 'absolute',
                            bottom: -handleSize / 2,
                            left: '50%',
                            transform: 'translateX(-50%)',
                        }}
                    />
                </>
            )}
        </div>
    );
}
