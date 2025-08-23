// /api/pnid-actions.js
import { wedgeParse } from "../ai/wedgeParse.js";

export default async function handler(req, res) {
    try {
        const { description, nodes = [], edges = [] } = req.body;
        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];
        let mode = "idle";

        if (description) {
            const aiResult = await wedgeParse(description);
            mode = aiResult.mode; // "chat" or "structured"

            if (mode === "chat") {
                // ✅ Friendly engineer-like response
                messages.push({ sender: "AI", message: aiResult.explanation });
            }

            if (mode === "structured") {
                const parsed = aiResult.parsed;
                const id = `node-${Date.now()}-${Math.random()}`;

                newNodes.push({
                    id,
                    data: { label: `${parsed.Code || parsed.Name}`, item: parsed },
                    type: parsed.Type || "scalableIcon",
                    position: {
                        x: Math.random() * 600 + 100,
                        y: Math.random() * 400 + 100
                    },
                });

                messages.push({ sender: "AI", message: aiResult.explanation || "Added item" });
            }
        }

        // 👇 Always return mode so frontend can branch properly
        res.status(200).json({ mode, nodes: newNodes, edges: newEdges, messages });
    } catch (err) {
        console.error("/api/pnid-actions error:", err);
        res.status(500).json({ error: "PNID actions API failed" });
    }
}
