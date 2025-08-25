// /api/pnid-actions.js
// Handles both chat-mode and structured PNID commands

import { parseItemLogic } from "./parse-item.js"; // ✅ fixed import

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { description, nodes = [], edges = [] } = req.body;
        if (!description) {
            return res.status(400).json({ error: "Missing description" });
        }

        let newNodes = [...nodes];
        let newEdges = [...edges];
        let messages = [];
        let mode = "idle";

        // 🔹 Call Gemini logic
        const aiResult = await parseItemLogic(description);
        mode = aiResult.mode; // 'chat' or 'structured'

        if (mode === "chat") {
            // 🗨️ Conversational mode
            messages.push({ role: "user", content: description });
            messages.push({ role: "assistant", content: aiResult.explanation });
        }
        else if (mode === "structured") {
            // 🔧 Structured PNID mode
            const parsed = Array.isArray(aiResult.parsed) ? aiResult.parsed : [aiResult.parsed];

            parsed.forEach((item) => {
                const id = `node-${crypto.randomUUID()}`;
                newNodes.push({
                    id,
                    data: { label: item.Code || item.Name, item },
                    type: item.Type || "scalableIcon",
                    position: {
                        x: Math.random() * 600 + 100,
                        y: Math.random() * 400 + 100
                    },
                });
            });

            // Add structured explanation
            messages.push({ role: "user", content: description });
            messages.push({
                role: "assistant",
                content: aiResult.explanation || `Added ${parsed.length} item(s)`
            });
        }

        return res.status(200).json({ mode, nodes: newNodes, edges: newEdges, messages });

    } catch (err) {
        console.error("/api/pnid-actions error:", err);
        return res.status(500).json({
            error: "PNID actions API failed",
            details: err.message
        });
    }
}
