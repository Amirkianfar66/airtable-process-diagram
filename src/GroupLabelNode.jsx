import React, { useState, useEffect } from "react";
import { useReactFlow } from "reactflow";

export default function GroupLabelNode({ id, data }) {
    const rfInstance = useReactFlow();
    const [rect, setRect] = useState(data.rect || { width: 150, height: 100 });
    const [position, setPosition] = useState(data.position || { x: 0, y: 0 });
    const groupName = data.groupName || data.label || "My Group";

    const [selectingNode, setSelectingNode] = useState(false);

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

    // -------------------
    // Add Item to Group
    // -------------------
    const startAddItem = () => {
        alert("Click on a node on the canvas to add it to this group.");
        setSelectingNode(true);
    };

    useEffect(() => {
        if (!selectingNode) return;

        const handleClick = (event) => {
            const clickedNodeId = event?.target?.dataset?.id;
            if (!clickedNodeId || clickedNodeId === id) return;

            // Add clicked node to this group's children
            rfInstance.setNodes((nds) =>
                nds.map((n) => {
                    if (n.id === clickedNodeId) {
                        return { ...n, data: { ...n.data, groupId: id } };
                    }
                    if (n.id === id) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                children: [...(n.data.children || []), clickedNodeId],
                            },
                        };
                    }
                    return n;
                })
            );
            setSelectingNode(false);
        };

        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, [selectingNode, rfInstance, id]);

    const removeItemFromGroup = () => {
        const children = data.children || [];
        if (children.length === 0) return;

        const options = children.map((nId, i) => `${i + 1}: ${rfInstance.getNodes().find(n => n.id === nId)?.data?.label || nId}`).join("\n");
        const choice = prompt(`Select node to remove from group:\n${options}`);
        const index = parseInt(choice) - 1;
        if (isNaN(index) || index < 0 || index >= children.length) return;

        const nodeToRemoveId = children[index];
        rfInstance.setNodes((nds) =>
            nds.map((n) => {
                if (n.id === nodeToRemoveId) return { ...n, data: { ...n.data, groupId: null } };
                if (n.id === id) {
                    return { ...n, data: { ...n.data, children: n.data.children.filter(cid => cid !== nodeToRemoveId) } };
                }
                return n;
            })
        );
    };

    // -------------------
    // Resize Handle
    // -------------------
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
                    <button onClick={() => startAddItemToGroup(id)} style={{ fontSize: 10, cursor: "pointer" }}>
                        Add Item
                    </button>

                    <button onClick={removeItemFromGroup} style={{ fontSize: 10, cursor: "pointer" }}>
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
