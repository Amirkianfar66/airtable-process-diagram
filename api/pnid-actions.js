// /api/pnid-actions.js
// Updated to use parseItemLogic from parse-item.js

import { parseItemLogic } from "./parse-item.js";

export default async function handler(req, res) {
    try {
        const { description, nodes = [], edges = [] } = req.body;
        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];
        let mode = "idle";

        if (description) {
            const aiResult = await parseItemLogic(description);
            mode = aiResult.mode || "idle";

            if (aiResult.explanation) {
                messages.push({ sender: "AI", message: aiResult.explanation });
            }

            if (mode === "structured" && aiResult.parsed) {
                const parsed = aiResult.parsed;
                const id = `node-${Date.now()}-${Math.random()}`;

                newNodes.push({
                    id,
                    data: { label: `${parsed.Code || parsed.Name}`, item: parsed },
                    type: parsed.Type || "scalableIcon",
                    position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                });
            }
        }

        res.status(200).json({ mode, nodes: newNodes, edges: newEdges, messages });
    } catch (err) {
        console.error("/api/pnid-actions error:", err);
        res.status(500).json({ error: "PNID actions API failed", details: err.message });
    }
}
