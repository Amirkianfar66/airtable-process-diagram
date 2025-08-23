// /api/pnid-actions.js
// Backend API handler for PNID actions

export default function handler(req, res) {
    try {
        let { action, nodes = [], edges = [], item, connection, description } = req.body;

        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];

        // 🔎 If description is provided (like "Draw 1 Equipment Tank") and no item yet, parse it
        if (description && action === "add" && !item) {
            const match = description.match(/(\d+)?\s*Equipment\s*Tank/i);
            if (match) {
                const count = parseInt(match[1] || "1", 10);
                for (let i = 0; i < count; i++) {
                    const id = `tank-${Date.now()}-${Math.random()}`;
                    item = {
                        id,
                        Code: `T-${i + 1}`,
                        Name: "Equipment Tank",
                        Type: "scalableIcon",
                        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 }
                    };
                    newNodes.push({
                        id: item.id,
                        data: { label: `${item.Code} - ${item.Name}`, item },
                        type: item.Type,
                        position: item.position,
                    });
                    messages.push({ sender: "AI", message: `Added ${item.Name} (${item.Code})` });
                }
            }
        }

        switch (action) {
            case "add":
                if (item) {
                    const id = item.id || `node-${Date.now()}-${Math.random()}`;
                    newNodes.push({
                        id,
                        data: { label: `${item.Code} - ${item.Name}`, item },
                        type: item.Type || "scalableIcon",
                        position: item.position || { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                    });
                    messages.push({ sender: "AI", message: `Added item ${item.Code}` });
                }
                break;

            case "connect":
                if (connection?.sourceId && connection?.targetId) {
                    const exists = newEdges.some(
                        (e) => e.source === connection.sourceId && e.target === connection.targetId
                    );
                    if (!exists) {
                        newEdges.push({
                            id: `edge-${connection.sourceId}-${connection.targetId}`,
                            source: connection.sourceId,
                            target: connection.targetId,
                            animated: true,
                        });
                        messages.push({ sender: "AI", message: `Connected ${connection.sourceId} → ${connection.targetId}` });
                    }
                }
                break;

            case "delete":
                if (item?.id) {
                    newNodes = newNodes.filter((n) => n.id !== item.id);
                    newEdges = newEdges.filter((e) => e.source !== item.id && e.target !== item.id);
                    messages.push({ sender: "AI", message: `Deleted item ${item.id}` });
                }
                break;

            default:
                messages.push({ sender: "AI", message: `Unknown action: ${action}` });
                break;
        }

        // Ensure all nodes have positions
        newNodes = newNodes.map((n) => ({
            ...n,
            position: n.position || { x: 100, y: 100 },
        }));

        res.status(200).json({ nodes: newNodes, edges: newEdges, messages });
    } catch (err) {
        console.error("/api/pnid-actions error:", err);
        res.status(500).json({ error: "PNID actions API failed" });
    }
}
