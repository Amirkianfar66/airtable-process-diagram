// pages/api/parse-item.js  (Next.js style API route)

import { wedgeParse } from "../../ai/wedgeParse.js";
import { generateCode } from "../../src/codeGenerator.js";

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ error: "Missing description" });
        }

        const aiResult = await wedgeParse(description);

        // If AI returned structured mode
        if (aiResult.mode === "structured") {
            const parsed = aiResult.parsed || {};

            // Normalize + code generation
            const code = generateCode({
                Category: parsed.Category || "Equipment",
                Type: parsed.Type || "Generic",
                Unit: parsed.Unit || 0,
                SubUnit: parsed.SubUnit || 0,
                Sequence: parsed.Sequence || 1,
                SensorType: parsed.SensorType || "",
            });

            return res.status(200).json({
                mode: "structured",
                parsed: { ...parsed, Code: code },
                explanation: parsed.Explanation || "",
                connection: parsed.Connections || [],
            });
        }

        // Otherwise → treat as chat
        return res.status(200).json({
            mode: "chat",
            messages: [{ sender: "AI", message: aiResult.explanation }],
        });
    } catch (err) {
        console.error("❌ API /parse-item failed:", err);

        // Always return 200 with safe fallback
        return res.status(200).json({
            mode: "chat",
            messages: [
                {
                    sender: "System",
                    message: "⚠️ AI service unavailable: " + (err.message || "Unknown error"),
                },
            ],
        });
    }
}
