import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import './styles.css'; // Include CSS for hover and fade

const ScalableIconNode: React.FC<NodeProps> = ({ data, selected }) => {
    const wrapperRef = useRef < HTMLDivElement > (null);
    const iconRef = useRef < SVGSVGElement > (null);
    const [showButtons, setShowButtons] = useState(false);
    const [iconBox, setIconBox] = useState({ width: 100, height: 100 });

    useEffect(() => {
        if (iconRef.current) {
            const bbox = iconRef.current.getBBox();
            setIconBox({ width: bbox.width, height: bbox.height });
        }
    }, [data]);

    // Auto-hide buttons after 3 seconds
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (showButtons) {
            timeout = setTimeout(() => setShowButtons(false), 3000);
        }
        return () => clearTimeout(timeout);
    }, [showButtons]);

    return (
        <div
            ref={wrapperRef}
            className="node-wrapper"
            style={{
                width: iconBox.width,
                height: iconBox.height,
                position: 'relative',
                transform: `scale(${data.scale || 1})`,
                transformOrigin: 'top left',
            }}
            onMouseEnter={() => setShowButtons(true)}
            onMouseLeave={() => setShowButtons(false)}
        >
            {/* SVG Icon */}
            <svg
                ref={iconRef}
                width={iconBox.width}
                height={iconBox.height}
                viewBox={`0 0 ${iconBox.width} ${iconBox.height}`}
                dangerouslySetInnerHTML={{ __html: data.svg }}
            />

            {/* Buttons (Not scaling) */}
            {showButtons && (
                <div
                    className="node-buttons"
                    style={{
                        position: 'absolute',
                        top: -24,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 6,
                        pointerEvents: 'auto',
                    }}
                >
                    <button style={{ transform: 'scale(1)' }}>⚙</button>
                    <button style={{ transform: 'scale(1)' }}>✖</button>
                </div>
            )}

            {/* Handles (Not scaling, but relocating) */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    top: iconBox.height / 2,
                    left: -8,
                    transform: 'scale(1)',
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    top: iconBox.height / 2,
                    left: iconBox.width,
                    transform: 'scale(1)',
                }}
            />
        </div>
    );
};

export default ScalableIconNode;
