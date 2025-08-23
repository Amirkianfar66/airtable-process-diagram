// /api/pnid-actions.js
// Handles PNID graph updates + human-like chat

import { wedgeParse } from "../ai/wedgeParse.js";
import { generateCode } from "../src/codeGenerator.js";

export default async function handler(req, res) {
    try {
        const { action, nodes = [], edges = [], item, connection, description } = req.body;

        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];

        switch (action) {
            case "add":
                if (description) {
                    // --- 1. Send description to AI ---
                    const aiResult = await wedgeParse(description);

                    // If AI returned chat only → just respond
                    if (aiResult.mode === "chat") {
                        messages.push({ sender: "AI", message: aiResult.reply });
                        break;
                    }

                    // --- 2. AI returned structured object ---
                    const parsed = aiResult.parsed || {};
                    const code = generateCode({
                        Category: parsed.Category || "Equipment",
                        Type: parsed.Type || "Generic",
                        Unit: parsed.Unit || 0,
                        SubUnit: parsed.SubUnit || 0,
                        Sequence: parsed.Sequence || 1,
                        SensorType: parsed.SensorType || ""
                    });

                    const id = `node-${Date.now()}-${Math.random()}`;
                    newNodes.push({
                        id,
                        data: { label: `${code} - ${parsed.Name || parsed.Type}`, item: parsed },
                        type: parsed.Type || "scalableIcon",
                        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                    });

                    messages.push({
                        sender: "AI",
                        message: `Added ${parsed.Type || "item"}: ${code}`
                    });
                } else if (item) {
                    // --- Existing item logic ---
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
                        messages.push({
                            sender: "AI",
                            message: `Connected ${connection.sourceId} → ${connection.targetId}`
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
