// GroupLabelNode.jsx
import React, { useState, useEffect } from "react";
import { useReactFlow } from "reactflow";

export default function GroupLabelNode({ id, data, selected }) {
    const rfInstance = useReactFlow();
    const [rect, setRect] = useState(data.rect || { x: data.position?.x || 0, y: data.position?.y || 0, width: 300, height: 150 });
    const [groupName, setGroupName] = useState(data.groupName || data.label || "Group");
    const handleSize = 12;

    // Drag logic for group
    const onPointerDown = (e) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = { x: rect.x, y: rect.y };

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            setRect((prev) => ({ ...prev, x: startPos.x + deltaX, y: startPos.y + deltaY }));

            // Move child nodes
            rfInstance.setNodes((nds) =>
                nds.map((node) =>
                    node.data?.groupId === id
                        ? {
                            ...node,
                            position: {
                                x: node.position.x + deltaX,
                                y: node.position.y + deltaY,
                            },
                        }
                        : node
                )
            );
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    // Resize logic
    const onScalePointerDown = (e) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = rect.width;
        const startHeight = rect.height;

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            setRect((prev) => ({
                ...prev,
                width: Math.max(50, startWidth + deltaX),
                height: Math.max(50, startHeight + deltaY),
            }));
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    // Rename
    const handleRename = () => {
        const newName = prompt("Enter new group name:", groupName);
        if (newName) setGroupName(newName);
        rfInstance.setNodes((nds) =>
            nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, groupName: newName } } : n))
        );
    };

    // Delete
    const handleDelete = () => {
        if (window.confirm("Delete this group?")) {
            rfInstance.setNodes((nds) => nds.filter((n) => n.id !== id && n.data?.groupId !== id));
            rfInstance.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        }
    };

    // Compute child nodes
    const childrenNodes = rfInstance.getNodes().filter((n) => n.data?.groupId === id);

    return (
        <div
            style={{
                position: "absolute",
                top: rect.y,
                left: rect.x,
                width: rect.width,
                height: rect.height,
                background: "rgba(255,0,0,0.1)",
                border: "1px solid red",
                zIndex: 1000,
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                overflow: "visible",
            }}
        >
            {/* Top bar */}
            <div
                onPointerDown={onPointerDown}
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fff",
                    borderBottom: "1px solid #ccc",
                    padding: "2px 4px",
                    fontSize: 12,
                    fontWeight: "bold",
                    cursor: "move",
                    pointerEvents: "auto",
                }}
            >
                <span>{groupName}</span>
                <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleRename} style={{ fontSize: 10, cursor: "pointer" }}>Rename</button>
                    <button onClick={handleDelete} style={{ fontSize: 10, cursor: "pointer" }}>Delete</button>
                </div>
            </div>

            {/* Scale handle */}
            <div
                onPointerDown={onScalePointerDown}
                style={{
                    position: "absolute",
                    width: handleSize,
                    height: handleSize,
                    bottom: 0,
                    right: 0,
                    background: "#00bcd4",
                    cursor: "nwse-resize",
                    borderRadius: 2,
                    zIndex: 1001,
                }}
            />

            {/* Render children visually inside group */}
            {childrenNodes.map((child) => (
                <div
                    key={child.id}
                    style={{
                        position: "absolute",
                        left: child.position.x - rect.x,
                        top: child.position.y - rect.y,
                        pointerEvents: "auto",
                    }}
                >
                    {child.data?.label || "Item"}
                </div>
            ))}
        </div>
    );
}
