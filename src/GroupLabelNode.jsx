import React, { useState, useEffect } from "react";
import { useReactFlow } from "reactflow";

export default function GroupLabelNode({ id, data }) {
    const rfInstance = useReactFlow();
    const [rect, setRect] = useState(data.rect || { width: 150, height: 100 });
    const [position, setPosition] = useState(data.position || { x: 0, y: 0 });
    const groupName = data.groupName || data.label || "My Group";

    const updateNode = (newData) => {
        rfInstance.setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, ...newData }, position: newData.position || node.position }
                    : node
            )
        );
        if (newData.rect) setRect(newData.rect);
        if (newData.position) setPosition(newData.position);
    };

    const deleteNode = () => {
        if (window.confirm("Delete this group?")) {
            rfInstance.setNodes((nds) => nds.filter((node) => node.id !== id && node.data.groupId !== id));
        }
    };

    const addItemToGroup = () => {
        // Get all nodes that are not in a group
        const availableNodes = rfInstance.getNodes().filter(n => !n.data.groupId);

        if (availableNodes.length === 0) {
            alert("No available nodes to add to this group.");
            return;
        }

        // Let user pick which node to add (simple prompt for demo)
        const options = availableNodes.map((n, i) => `${i + 1}: ${n.data.label || n.id}`).join("\n");
        const choice = prompt(`Select node to add:\n${options}`);
        const index = parseInt(choice) - 1;

        if (isNaN(index) || index < 0 || index >= availableNodes.length) return;

        const nodeToAdd = availableNodes[index];

        // Assign it to this group without creating new node
        rfInstance.setNodes(nds =>
            nds.map(n =>
                n.id === nodeToAdd.id
                    ? { ...n, data: { ...n.data, groupId: id }, position: { x: position.x + 10, y: position.y + 30 } }
                    : n
            )
        );
    };

    const removeItemFromGroup = () => {
        const children = rfInstance.getNodes().filter(n => n.data.groupId === id);
        if (children.length === 0) return;

        // Simple prompt to select which node to remove
        const options = children.map((n, i) => `${i + 1}: ${n.data.label || n.id}`).join("\n");
        const choice = prompt(`Select node to remove from group:\n${options}`);
        const index = parseInt(choice) - 1;

        if (isNaN(index) || index < 0 || index >= children.length) return;

        const nodeToRemove = children[index];

        rfInstance.setNodes(nds =>
            nds.map(n =>
                n.id === nodeToRemove.id
                    ? { ...n, data: { ...n.data, groupId: null } } // just remove from group
                    : n
            )
        );
    };



    // Clamp child nodes inside the group
    useEffect(() => {
        rfInstance.setNodes((nds) =>
            nds.map((node) => {
                if (node.data.groupId === id) {
                    let newX = Math.max(position.x + 10, Math.min(node.position.x, position.x + rect.width - 30));
                    let newY = Math.max(position.y + 30, Math.min(node.position.y, position.y + rect.height - 30));
                    return { ...node, position: { x: newX, y: newY } };
                }
                return node;
            })
        );
    }, [position, rect, rfInstance, id]);

    const handleRename = () => {
        const newName = prompt("Enter new group name:", groupName);
        if (newName) updateNode({ groupName: newName });
    };

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

    return (
        <div
            style={{
                width: rect.width,
                height: rect.height,
                background: "rgba(220,255,255,0.1)",
                border: "1px solid red",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "visible",
                pointerEvents: "auto",
                zIndex: 1000,
            }}
        >
            <div
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
                    <button
                        onClick={addItemToGroup} // assigns an existing node to this group
                        style={{ fontSize: 10, cursor: "pointer" }}
                    >
                        Add Item
                    </button>
                    <button
                        onClick={removeItemFromGroup} // removes selected node from this group
                        style={{ fontSize: 10, cursor: "pointer" }}
                    >
                        Remove Item
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
        </div>
    );
}
