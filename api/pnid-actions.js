// /api/pnid-actions.js
// Backend API handler for PNID actions

export default function handler(req, res) {
    try {
        const { action, nodes = [], edges = [], item, connection, description } = req.body;

        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];

        switch (action) {
            case "add": {
                let finalItem = item;

                // 👇 Parse description if no explicit item is passed
                if (!finalItem && description) {
                    const match = description.match(/draw\s+(\d+)?\s*(equipment|pump|valve|tank)/i);
                    if (match) {
                        const qty = parseInt(match[1] || "1", 10);
                        const type = match[2].toLowerCase();

                        // Create N items if quantity > 1
                        for (let i = 0; i < qty; i++) {
                            const id = `node-${Date.now()}-${Math.random()}`;
                            newNodes.push({
                                id,
                                data: { label: `${type} ${i + 1}` },
                                type: "scalableIcon",
                                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                            });
                            messages.push({ sender: "AI", message: `Added ${type} ${i + 1}` });
                        }
                    } else {
                        messages.push({ sender: "AI", message: `Could not understand: "${description}"` });
                    }
                }

                if (finalItem) {
                    const id = finalItem.id || `node-${Date.now()}-${Math.random()}`;
                    newNodes.push({
                        id,
                        data: { label: `${finalItem.Code || finalItem.Name || "Item"}`, item: finalItem },
                        type: finalItem.Type || "scalableIcon",
                        position: finalItem.position || { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                    });
                    messages.push({ sender: "AI", message: `Added item ${finalItem.Code || id}` });
                }
                break;
            }

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
                        messages.push({
                            sender: "AI",
                            message: `Connected ${connection.sourceId} → ${connection.targetId}`,
                        });
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
