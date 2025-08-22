import React, { useState, useEffect } from "react";

export default function GroupLabelNode({ id, data = {}, childrenNodes = [] }) {
    // keep local rect/position state but update from data when it changes
    const [rect, setRect] = useState(data.rect || { width: 150, height: 100 });
    const [position, setPosition] = useState(data.position || { x: 0, y: 0 });
    const groupName = data.groupName || data.label || "My Group";

    useEffect(() => {
        if (data.rect) setRect(data.rect);
    }, [data.rect]);

    useEffect(() => {
        if (data.position) setPosition(data.position);
    }, [data.position]);

    const handleRename = () => {
        const newName = prompt("Enter new group name:", groupName);
        if (newName && data.updateNode) data.updateNode({ groupName: newName });
    };

    const deleteNode = () => {
        if (window.confirm("Delete this group?") && data.deleteNode) {
            data.deleteNode(id);
        }
    };

    const removeItemFromGroup = () => {
        if (!data.removeItemFromGroup) return;
        data.removeItemFromGroup(id);
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
            const newRect = {
                width: Math.max(50, initialWidth + deltaX),
                height: Math.max(50, initialHeight + deltaY),
            };
            setRect(newRect);
            if (data.updateNode)
                data.updateNode({
                    rect: newRect,
                });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    // ---------- derive display items (prefer childrenNodes, then data.children, then data.childIds) ----------
    const deriveDisplayItems = () => {
        if (Array.isArray(childrenNodes) && childrenNodes.length > 0) {
            return childrenNodes.map((n) =>
                typeof n === "string" ? n : n?.data?.item?.Code ?? n?.data?.label ?? n?.id ?? String(n)
            );
        }

        if (Array.isArray(data?.children) && data.children.length > 0) {
            return data.children.map((c) =>
                typeof c === "string" ? c : c?.Code ?? String(c)
            );
        }

        if (Array.isArray(data?.childIds) && data.childIds.length > 0) {
            const mapping = data.childLabels || {};
            return data.childIds.map((cid) => mapping[cid] ?? cid);
        }

        return [];
    };


    const displayItems = deriveDisplayItems();

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
                padding: 4,
            }}
        >
            {/* Header */}
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
                        onClick={() => data.startAddItemToGroup?.(id)}
                        style={{ fontSize: 10, cursor: "pointer" }}
                    >
                        Add Item
                    </button>
                    <button onClick={removeItemFromGroup} style={{ fontSize: 10, cursor: "pointer" }}>
                        Remove Item
                    </button>
                </div>
            </div>

            {/* Items list */}
            <div
                style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: "#333",
                    maxHeight: rect.height - 30,
                    overflowY: "auto",
                    paddingLeft: 2,
                }}
            >
                {displayItems.length === 0
                    ? "No items inside"
                    : `Items: ${displayItems.join(", ")}`}
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
                    zIndex: 1001,
                }}
            />
        </div>
    );
}
