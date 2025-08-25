// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parsePNIDCommand } from "../../utils/pnidParser"; // optional helper for local PNID parsing

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    try {
        const trimmed = description.trim();

        // --------------------------
        // 1️⃣ Detect if input is a PNID command
        // Keywords indicating PNID intent
        const pnidRegex = /unit|sub[- ]?unit|sequence|category|type/i;
        const isPNID = pnidRegex.test(trimmed);

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        if (!isPNID) {
            // --------------------------
            // Human chat
            const chatPrompt = `You are a helpful assistant. Reply naturally in human language to: "${trimmed}"`;
            const result = await model.generateContent(chatPrompt);
            const text = result?.response?.text?.().trim() || "Sorry, I couldn't get a response.";

            return res.status(200).json({
                parsed: {},
                explanation: text,
                mode: "chat",
                connection: null,
            });
        }

        // --------------------------
        // PNID command: structured output
        const pnidPrompt = `
You are a PNID assistant.

Task:
1. If input is conversational, reply naturally.
2. If input is a PNID command, output ONLY structured JSON:
   { "Name", "Category", "Type", "Unit", "SubUnit", "Sequence", "Number", "SensorType", "Explanation", "Connections" }

Input: """${trimmed}"""
`;

        const result = await model.generateContent(pnidPrompt);
        const text = result?.response?.text?.().trim() || "";

        try {
            const parsed = JSON.parse(text);
            return res.status(200).json({
                parsed,
                explanation: parsed.Explanation || "PNID item parsed",
                mode: "structured",
                connection: parsed.Connections || null,
            });
        } catch (err) {
            // Fallback: treat as chat if JSON parsing fails
            return res.status(200).json({
                parsed: {},
                explanation: text,
                mode: "chat",
                connection: null,
            });
        }
    } catch (err) {
        console.error("❌ parse-item error:", err);
        return res.status(500).json({ error: err.message || "Server error" });
    }
}
