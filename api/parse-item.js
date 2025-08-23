// api/parse-item.js
import { wedgeParse } from "../ai/wedgeParse.js";
import { generateCode } from "../src/codeGenerator.js";

export default async function handler(req, res) {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    const parsed = await wedgeParse(description);

    // Normalize + code generation
    const code = generateCode({
        Category: parsed.Category || "Equipment",
        Type: parsed.Type || "Generic",
        Unit: parsed.Unit || 0,
        SubUnit: parsed.SubUnit || 0,
        Sequence: parsed.Sequence || 1,
        SensorType: parsed.SensorType || ""
    });

    res.json({
        parsed: { ...parsed, Code: code },
        explanation: parsed.Explanation || "",
        connection: parsed.Connections || []
    });
}
