import React, { useState, useEffect } from "react";

export default function GroupLabelNode({ id, data = {}, childrenNodes = [] }) {
    const [rect, setRect] = useState(data.rect || { width: 220, height: 120 });
    const groupName = data.groupName || data.label || "My Group";

    useEffect(() => {
        if (data.rect) setRect(data.rect);
    }, [data.rect]);

    const handleRename = () => {
        const newName = prompt("Enter new group name:", groupName);
        if (newName && data.updateNode) data.updateNode({ groupName: newName });
    };

    const deleteNode = () => {
        if (window.confirm("Delete this group?") && data.deleteNode) data.deleteNode(id);
    };

    const removeItemFromGroup = () => {
        if (!data.removeItemFromGroup) return;
        data.removeItemFromGroup(id);
    };

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
                width: Math.max(120, initialWidth + deltaX),
                height: Math.max(70, initialHeight + deltaY),
            };
            setRect(newRect);
            if (data.updateNode) data.updateNode({ rect: newRect });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    // Derive items (prefer full node objects passed in, otherwise data.children / data.childIds)
    const deriveDisplayItems = () => {
        if (Array.isArray(childrenNodes) && childrenNodes.length > 0) {
            return childrenNodes.map((n) =>
                typeof n === "string" ? n : n?.data?.label ?? n?.label ?? n?.id ?? String(n)
            );
        }
        if (Array.isArray(data?.children) && data.children.length > 0) {
            return data.children.map((c) => (typeof c === "string" ? c : String(c)));
        }
        if (Array.isArray(data?.childIds) && data.childIds.length > 0) {
            const mapping = data.childLabels || {};
            return data.childIds.map((cid) => mapping[cid] ?? cid);
        }
        return [];
    };

    const displayItems = deriveDisplayItems();

    // format for readability (you can change maxLen or set to null to disable truncation)
    const maxLen = null; // set to e.g. 40 to truncate visually but keep tooltip
    const pretty = (s) => {
        if (!s) return "";
        const str = String(s);
        if (!maxLen) return str;
        return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
    };

    return (
        <div
            style={{
                width: rect.width,
                height: rect.height,
                background: "rgba(220,255,255,0.08)",
                border: "1px solid rgba(200,40,40,0.9)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
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
                    borderBottom: "1px solid #ddd",
                    padding: "4px 6px",
                    fontSize: 12,
                    fontWeight: 700,
                    pointerEvents: "auto",
                }}
            >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={groupName}>
                    {groupName}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleRename} style={{ fontSize: 11, cursor: "pointer" }}>Rename</button>
                    <button onClick={deleteNode} style={{ fontSize: 11, cursor: "pointer" }}>Delete</button>
                    <button onClick={() => data.startAddItemToGroup?.(id)} style={{ fontSize: 11, cursor: "pointer" }}>Add</button>
                    <button onClick={removeItemFromGroup} style={{ fontSize: 11, cursor: "pointer" }}>Remove</button>
                </div>
            </div>

            {/* Items list: render each on its own line, allow wrapping, show full text on hover */}
            <div
                style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#222",
                    padding: "4px 6px",
                    overflowY: "auto",
                    flex: 1,
                    lineHeight: "1.25",
                }}
            >
                {displayItems.length === 0 ? (
                    <div style={{ color: "#666", fontStyle: "italic" }}>No items inside</div>
                ) : (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {displayItems.map((it, i) => (
                            <li
                                key={`${id}-child-${i}`}
                                title={String(it)}
                                style={{
                                    marginBottom: 4,
                                    wordBreak: "break-word",       // allow long words / ids to wrap
                                    overflowWrap: "anywhere",      // aggressive wrap for long tokens
                                    whiteSpace: "normal",          // allow multi-line
                                }}
                            >
                                {pretty(it)}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Resize handle */}
            <div
                onPointerDown={onScalePointerDown}
                style={{
                    position: "absolute",
                    width: 12,
                    height: 12,
                    bottom: 2,
                    right: 2,
                    background: "#00bcd4",
                    cursor: "nwse-resize",
                    borderRadius: 2,
                }}
            />
        </div>
    );
}
