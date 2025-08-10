import React, { useState } from "react";

export default function ScalableRect() {
    const handleSize = 12;

    const [rect, setRect] = useState({
        x: 100,
        y: 100,
        width: 150,
        height: 100,
    });

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
                width: Math.max(10, initialWidth + deltaX),   // Minimum width
                height: Math.max(10, initialHeight + deltaY), // Minimum height
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

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh", background: "#f5f5f5" }}>
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
                {/* Scale handle in bottom-right */}
                <div
                    onPointerDown={(e) => onScalePointerDown(e)}
                    style={{
                        position: "absolute",
                        width: handleSize,
                        height: handleSize,
                        bottom: -8,     // outside the rectangle
                        right: -8,      // outside the rectangle
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
