// GroupLabelNode.jsx
import React from "react";

export default function GroupLabelNode({
    id,
    data,
    selected,
    updateNode,
    deleteNode,
    childrenNodes,
}) {
    const handleSize = 12;
    const rect = data.rect || { width: 200, height: 120 }; // ensure enough height for buttons
    const groupName = data.groupName || data.label || "My Group";

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
                    width: Math.max(100, initialWidth + deltaX),
                    height: Math.max(60, initialHeight + deltaY),
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

    const handleUngroup = () => {
        if (window.confirm("Ungroup all items inside this group?")) {
            if (childrenNodes) {
                childrenNodes.forEach((child) => updateNode(child.id, { group: null }));
            }
            deleteNode(id);
        }
    };

    return (
        <div
            style={{
                width: rect.width,
                height: rect.height,
                background: "rgba(255,0,0,0.1)",
                border: "1px solid red",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "visible",
            }}
        >
            {/* Top controls */}
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
                    pointerEvents: "auto",
                }}
            >
                <span>{groupName}</span>
                <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleRename} style={{ fontSize: 10 }}>Rename</button>
                    <button onClick={handleDelete} style={{ fontSize: 10 }}>Delete</button>
                    <button onClick={handleUngroup} style={{ fontSize: 10 }}>Ungroup</button>
                </div>
            </div>

            {/* Resize handle */}
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
                    zIndex: 5,
                }}
            />

            {/* Optional: render children nodes visually inside group */}
            {childrenNodes && (
                <div
                    style={{
                        position: "absolute",
                        top: 28,
                        left: 0,
                        width: "100%",
                        height: `calc(100% - 28px)`,
                        pointerEvents: "none", // children labels are not interactive
                    }}
                >
                    {childrenNodes.map((child) => (
                        <div
                            key={child.id}
                            style={{
                                position: "absolute",
                                left: child.position.x - rect.x || 0,
                                top: child.position.y - rect.y || 0,
                                fontSize: 10,
                                background: "rgba(0,0,0,0.05)",
                                padding: "1px 2px",
                                borderRadius: 2,
                            }}
                        >
                            {child.data?.label || "Item"}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
