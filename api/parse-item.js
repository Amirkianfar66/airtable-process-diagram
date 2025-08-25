// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Core logic for both chat and structured PNID commands
export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // ✅ Send everything to Gemini; ask it to classify and respond
    const prompt = `
You are a PNID assistant with dual capabilities:

1️⃣ PNID mode: If the input is related to piping, instrumentation, or diagrams, output ONLY structured JSON with fields:
Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.

2️⃣ Chat mode: If the input is general conversation (e.g., greetings, weather, general questions), respond naturally in plain text.

Always include a top-level field "mode" with value "structured" or "chat".

Input: """${trimmed}"""

Respond accordingly.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";
        console.log("👉 Gemini raw text:", text);

        if (!text) {
            return {
                parsed: {},
                explanation: "⚠️ AI returned empty response",
                mode: "chat",
                connection: null,
            };
        }

        // Try to parse JSON
        try {
            const parsed = JSON.parse(text);
            return {
                parsed,
                explanation: parsed.Explanation || "Added PNID item",
                mode: parsed.mode || "structured",
                connection: parsed.Connections || null,
            };
        } catch (err) {
            console.warn("⚠️ Not JSON, treating as chat:", err.message);
            return {
                parsed: {},
                explanation: text, // reply as plain human text
                mode: "chat",
                connection: null,
            };
        }
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return {
            parsed: {},
            explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"),
            mode: "chat",
            connection: null,
        };
    }
}

// Default API handler
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const { description } = req.body;
        if (!description) return res.status(400).json({ error: "Missing description" });

        const aiResult = await parseItemLogic(description);
        res.status(200).json(aiResult);
    } catch (err) {
        console.error("/api/parse-item error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
}
