import React, { useState } from "react";

export default function ScalableRect() {
    const handleSize = 12;

    const [rect, setRect] = useState({
        x: 100,
        y: 100,
        width: 150,
        height: 100,
    });

    const [groupName, setGroupName] = useState("My Group");

    const onScalePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const initialWidth = rect.width;
        const initialHeight = rect.height;
        const fixedX = rect.x; // Lock X
        const fixedY = rect.y; // Lock Y

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            setRect((prev) => ({
                ...prev,
                width: Math.max(10, initialWidth + deltaX),
                height: Math.max(10, initialHeight + deltaY),
                x: fixedX,
                y: fixedY,
            }));
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
        if (newName) setGroupName(newName);
    };

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete this group?")) {
            setRect(null); // Removes the rectangle
        }
    };

    if (!rect) return null;

    return (
        <div style={{ position: "relative", width: "100%", height: "50h", background: "#f5f5f5" }}>
            {/* Group Controls */}
            <div
                style={{
                    position: "absolute",
                    left: rect.x,
                    top: rect.y - 38,
                    display: "flex",
                    gap: "3px",
                }}
            >
                
                <button onClick={handleRename}>Rename Group</button>
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
                        top: -40,
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
                    onPointerDown={(e) => onScalePointerDown(e)}
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
