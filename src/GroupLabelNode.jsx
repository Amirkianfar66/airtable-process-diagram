// GroupLabelNode.jsx
import React from "react";

export default function GroupLabelNode({ id, data, updateNode, deleteNode }) {
    const handleSize = 12;

    // Use data from node or fallback defaults
    const rect = data.rect || { x: 100, y: 100, width: 150, height: 100 };
    const groupName = data.groupName || "My Group";

    const onScalePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const initialWidth = rect.width;
        const initialHeight = rect.height;
        const fixedX = rect.x;
        const fixedY = rect.y;

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            const newWidth = Math.max(10, initialWidth + deltaX);
            const newHeight = Math.max(10, initialHeight + deltaY);

            // Update node data in parent state
            updateNode(id, { rect: { ...rect, width: newWidth, height: newHeight, x: fixedX, y: fixedY } });
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
        if (newName) {
            updateNode(id, { groupName: newName });
        }
    };

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete this group?")) {
            deleteNode(id);
        }
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", background: "transparent" }}>
            {/* Group Controls */}
            <div
                style={{
                    position: "absolute",
                    left: rect.x,
                    top: rect.y - 30,
                    display: "flex",
                    gap: "3px",
                }}
            >
                <button onClick={handleRename}>Rename</button>
                <button onClick={handleDelete}>Delete</button>
            </div>

            {/* Rectangle */}
            <div
                style={{
                    position: "absolute",
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                    background: "rgba(255, 0, 0, 0.3)",
                    border: "1px solid red",
                    boxSizing: "border-box",
                }}
            >
                {/* Group Name Label */}
                <div
                    style={{
                        position: "absolute",
                        top: -30,
                        left: 0,
                        fontSize: "12px",
                        fontWeight: "bold",
                        background: "#fff",
                        padding: "2px 4px",
                        borderRadius: "3px",
                        border: "1px solid #ccc",
                    }}
                >
                    {groupName}
                </div>

                {/* Scale handle in bottom-right */}
                <div
                    onPointerDown={onScalePointerDown}
                    style={{
                        position: "absolute",
                        width: handleSize,
                        height: handleSize,
                        bottom: -8,
                        right: -8,
                        background: "#00bcd4",
                        borderRadius: 2,
                        cursor: "nwse-resize",
                        userSelect: "none",
                        zIndex: 100,
                        pointerEvents: "auto",
                        touchAction: "none",
                    }}
                    title="Scale group"
                />
            </div>
        </div>
    );
}
