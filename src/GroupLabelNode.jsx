// GroupLabelNode.jsx
import React from "react";

export default function GroupLabelNode({ id, data, updateNode, deleteNode }) {
    const handleSize = 12;

    const rect = data.rect || { x: 0, y: 0, width: 150, height: 100 };
    const groupName = data.groupName || "My Group";

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
                    width: Math.max(10, initialWidth + deltaX),
                    height: Math.max(10, initialHeight + deltaY),
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
                position: "relative",
                background: "rgba(255,0,0,0.2)",
                border: "1px solid red",
            }}
        >
            {/* Group Name */}
            <div
                style={{
                    position: "absolute",
                    top: -24,
                    left: 0,
                    fontSize: "12px",
                    fontWeight: "bold",
                    background: "#fff",
                    padding: "2px 4px",
                    borderRadius: "3px",
                    border: "1px solid #ccc",
                    display: "flex",
                    gap: "4px",
                }}
            >
                {groupName}
                <button onClick={handleRename}>Rename</button>
                <button onClick={handleDelete}>Delete</button>
            </div>

            {/* Scale handle */}
            <div
                onPointerDown={onScalePointerDown}
                style={{
                    position: "absolute",
                    width: handleSize,
                    height: handleSize,
                    bottom: -8,
                    right: -8,
                    background: "#00bcd4",
                    cursor: "nwse-resize",
                    borderRadius: 2,
                }}
            />
        </div>
    );
}
