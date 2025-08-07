import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ScalableIconNode({ id, data }) {
    const iconRef = useRef(null);
    const { setNodes } = useReactFlow();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (iconRef.current) {
            const bbox = iconRef.current.getBBox();
            setDimensions({ width: bbox.width, height: bbox.height });
        }
    }, [data]);

    const handleStyle = {
        position: 'absolute',
        background: '#555',
        width: 10,
        height: 10,
    };

    const leftHandleStyle = {
        ...handleStyle,
        left: `-${handleStyle.width / 2}px`,
        top: `${dimensions.height / 2}px`,
    };

    const rightHandleStyle = {
        ...handleStyle,
        left: `${dimensions.width - handleStyle.width / 2}px`,
        top: `${dimensions.height / 2}px`,
    };

    return (
        <div style={{ position: 'relative', width: dimensions.width, height: dimensions.height }}>
            <svg
                ref={iconRef}
                width={dimensions.width || 100}
                height={dimensions.height || 100}
                viewBox="0 0 100 100"
            >
                <rect x="20" y="20" width="60" height="60" fill="lightblue" stroke="black" strokeWidth="3" />
            </svg>

            <Handle type="target" position={Position.Left} style={leftHandleStyle} />
            <Handle type="source" position={Position.Right} style={rightHandleStyle} />
        </div>
    );
}
