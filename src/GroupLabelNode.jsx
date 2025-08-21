// GroupLabelNode.jsx
import React from "react";

export default function GroupLabelNode({ id, data, selected, updateNode, deleteNode }) {
    const handleSize = 12;

    const rect = data.rect || { width: 150, height: 100 };
    const groupName = data.groupName || "My Group";

    // Resize logic
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

            updateNode(id, {
                rect: {
                    ...rect,
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

    // Rename / Delete
    const handleRename = () => {
        const newName = prompt("Enter new group name:", groupName);
        if (newName) updateNode(id, { groupName: newName });
    };
    const handleDelete = () => {
        if (window.confirm("Delete this group?")) deleteNode(id);
    };

    return (
        <div
            style={{
                width: rect.width,
                height: rect.height,
                background: "rgba(255,0,0,0.2)",
                border: "1px solid red",
                position: "relative",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Top controls always visible inside node */}
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
                    zIndex: 10,
                }}
            >
                <span>{groupName}</span>
                <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleRename} style={{ fontSize: 10 }}>Rename</button>
                    <button onClick={handleDelete} style={{ fontSize: 10 }}>Delete</button>
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
                }}
            />
        </div>
    );
}
