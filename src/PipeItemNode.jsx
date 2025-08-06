import React, { useState, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import PipeIcon from '../icons/PipeIcon';

const PipeItemNode = ({ id, data }) => {
  const reactFlowInstance = useReactFlow();

  // Keep local width state (start with data.width or default)
  const [width, setWidth] = useState(data.width || 160);

  const nodeRef = useRef(null);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  // Mouse down on resize handle
  const onMouseDown = (event) => {
    event.stopPropagation();
    resizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Mouse move handler for resizing
  const onMouseMove = (event) => {
    if (!resizingRef.current) return;

    const deltaX = event.clientX - startXRef.current;
    let newWidth = startWidthRef.current + deltaX;

    // Minimum width to prevent collapsing
    if (newWidth < 50) newWidth = 50;

    setWidth(newWidth);

    // Update node size in React Flow instance
    reactFlowInstance.setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          node.style = { ...node.style, width: newWidth };
          return { ...node, style: node.style };
        }
        return node;
      })
    );
  };

  // Mouse up handler to stop resizing
  const onMouseUp = () => {
    resizingRef.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={nodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 6,
        border: '1px solid #00acc1',
        borderRadius: 4,
        background: '#e0f7fa',
        width, // dynamic width
        height: 60,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <PipeIcon />
      <strong>{data.label}</strong>

      {/* Handles for connections */}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />

      {/* Resize handle on right edge */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 10,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 10,
          backgroundColor: 'transparent',
        }}
        title="Drag to resize"
      />
    </div>
  );
};

export default PipeItemNode;
