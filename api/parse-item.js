import { wedgeParse } from "../ai/wedgeParse.js";
import { generateCode } from "../src/codeGenerator.js";

export default async function handler(req, res) {
    try {
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ error: "Missing description" });
        }

        const aiResult = await wedgeParse(description);

        if (aiResult.mode === "chat") {
            return res.json({
                mode: "chat",
                messages: [{ sender: "AI", message: aiResult.explanation }],
            });
        }

        if (aiResult.mode === "structured") {
            const parsed = aiResult.parsed;

            const code = generateCode({
                Category: parsed.Category || "Equipment",
                Type: parsed.Type || "Generic",
                Unit: parsed.Unit || 0,
                SubUnit: parsed.SubUnit || 0,
                Sequence: parsed.Sequence || 1,
                SensorType: parsed.SensorType || "",
            });

            return res.json({
                mode: "structured",
                parsed: { ...parsed, Code: code },
                explanation: parsed.Explanation || "",
                connection: parsed.Connections || [],
            });
        }

        res.status(500).json({ error: "Unexpected AI result" });
    } catch (err) {
        console.error("❌ API /parse-item failed:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
}
