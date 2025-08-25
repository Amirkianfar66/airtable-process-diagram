// api/parse-item.js
import { wedgeParse } from "../ai/wedgeParse.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ error: "Missing description" });
        }

        const result = await wedgeParse(description);
        return res.status(200).json(result);
    } catch (err) {
        console.error("❌ API /parse-item failed:", err);
        return res.status(500).json({ error: "AI processing failed" });
    }
}
