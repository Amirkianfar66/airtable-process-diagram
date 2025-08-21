// GroupLabelNode.jsx
import React, { useState, useRef, useEffect } from "react";
import { useReactFlow } from "reactflow";

export default function GroupLabelNode({ id, data }) {
    const rfInstance = useReactFlow();
    const [rect, setRect] = useState(data.rect || { width: 150, height: 100 });
    const groupName = data.groupName || data.label || "My Group";
    const groupRef = useRef(null);

    // Helpers
    const updateNode = (newData) => {
        rfInstance.setNodes((nds) =>
            nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
            )
        );
        setRect(newData.rect || rect);
    };

    const deleteNode = () => {
        if (window.confirm("Delete this group?")) {
            rfInstance.setNodes((nds) =>
                nds.filter((node) => node.id !== id && node.data?.groupId !== id)
            );
        }
    };

    // Resize logic
    const handleSize = 12;
    const onScalePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const initialWidth = rect.width;
        const initialHeight = rect.height;

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            updateNode({
                rect: {
                    width: Math.max(50, initialWidth + deltaX),
                    height: Math.max(50, initialHeight + deltaY),
                },
            });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    const handleRename = () => {
        const newName = prompt("Enter new group name:", groupName);
        if (newName) updateNode({ groupName: newName });
    };

    // Dragging the group along with its children
    const onDragPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const groupPos = data.position || { x: 0, y: 0 };

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            // Move the group
            updateNode({ position: { x: groupPos.x + deltaX, y: groupPos.y + deltaY } });

            // Move child nodes
            const children = rfInstance.getNodes().filter((n) => n.data?.groupId === id);
            rfInstance.setNodes((nds) =>
                nds.map((n) => {
                    if (n.data?.groupId === id) {
                        return {
                            ...n,
                            position: {
                                x: n.position.x + deltaX,
                                y: n.position.y + deltaY,
                            },
                        };
                    }
                    return n;
                })
            );
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    // Keep child nodes within group boundaries
    useEffect(() => {
        const nodes = rfInstance.getNodes().filter((n) => n.data?.groupId === id);
        rfInstance.setNodes((nds) =>
            nds.map((n) => {
                if (n.data?.groupId === id) {
                    let x = Math.min(Math.max(n.position.x, (data.position?.x || 0) + 0), (data.position?.x || 0) + rect.width - 20);
                    let y = Math.min(Math.max(n.position.y, (data.position?.y || 0) + 30), (data.position?.y || 0) + rect.height - 20);
                    return { ...n, position: { x, y } };
                }
                return n;
            })
        );
    }, [rect, data.position, rfInstance, id]);

    const childrenNodes = rfInstance.getNodes().filter((n) => n.data?.groupId === id);

    return (
        <div
            ref={groupRef}
            style={{
                width: rect.width,
                height: rect.height,
                background: "rgba(255,0,0,0.1)",
                border: "1px solid red",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
                zIndex: 1000,
            }}
        >
            <div
                onPointerDown={onDragPointerDown}
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fff",
                    borderBottom: "1px solid #ccc",
                    padding: "2px 4px",
                    fontSize: 12,
                    fontWeight: "bold",
                    zIndex: 1001,
                    pointerEvents: "auto",
                    cursor: "move",
                }}
            >
                <span>{groupName}</span>
                <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleRename} style={{ fontSize: 10, cursor: "pointer" }}>
                        Rename
                    </button>
                    <button onClick={deleteNode} style={{ fontSize: 10, cursor: "pointer" }}>
                        Delete
                    </button>
                </div>
            </div>

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

            {childrenNodes.map((child) => (
                <div
                    key={child.id}
                    style={{
                        position: "absolute",
                        left: child.position.x - (data.position?.x || 0),
                        top: child.position.y - (data.position?.y || 0),
                        pointerEvents: "auto",
                    }}
                >
                    {child.data?.label || "Item"}
                </div>
            ))}
        </div>
    );
}
