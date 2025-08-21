import React from "react";

export default function MainToolbar({ selectedNodes, setNodes, updateNode, deleteNode }) {
    const handleGroup = () => {
        if (!selectedNodes || selectedNodes.length < 2) {
            alert("Select at least 2 nodes to group.");
            return;
        }

        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.style?.width || 100)));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.style?.height || 40)));

        const groupId = `group-${Date.now()}`;

        setNodes(nds => [
            ...nds,
            {
                id: groupId,
                type: "groupLabel",
                position: { x: minX - 20, y: minY - 40 },
                data: {
                    label: "New Group",
                    groupName: "New Group",
                    rect: { width: maxX - minX + 40, height: maxY - minY + 60 },
                    children: selectedNodes.map(n => n.id)   // ✅ now groups children
                },
                style: { background: "transparent", border: "1px dashed red" }
            }
        ]);
    }; // ✅ properly closed here

    const handleUngroup = () => {
        if (!selectedNodes || selectedNodes.length === 0) {
            alert("Select a group to ungroup.");
            return;
        }

        selectedNodes.forEach(node => {
            if (node.type === "groupLabel") {
                deleteNode(node.id);
            }
        });
    };

    const handleRename = () => {
        if (!selectedNodes || selectedNodes.length !== 1) {
            alert("Select exactly one group to rename.");
            return;
        }

        const node = selectedNodes[0];
        if (node.type !== "groupLabel") {
            alert("Only group nodes can be renamed.");
            return;
        }

        const newName = prompt("Enter new group name:", node.data.groupName || node.data.label);
        if (newName) updateNode(node.id, { groupName: newName });
    };

    return (
        <div
            style={{
                display: "flex",
                gap: 8,
                padding: 8,
                background: "rgba(255,255,255,0.9)",
                borderBottom: "1px solid #ccc",
                position: "sticky",
                top: 0,
                zIndex: 2000,
            }}
        >
            <button onClick={handleGroup}>Group</button>
            <button onClick={handleUngroup}>Ungroup</button>
            <button onClick={handleRename}>Rename Group</button>
        </div>
    );
}
