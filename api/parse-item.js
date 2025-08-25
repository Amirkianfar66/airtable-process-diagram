// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); // server-side only
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // Conversational detection
    const conversationalRegex = /^(hi|hello|hey|how are you|what is|please explain)/i;
    if (conversationalRegex.test(trimmed)) {
        return {
            parsed: {},
            explanation: "Hi there! I'm your AI assistant. How can I help with your process diagram?",
            mode: "chat",
            connection: null,
        };
    }

    // PNID structured prompt
    const prompt = `
You are a PNID assistant.

Task:
1. If input is conversational, reply naturally in plain text.
2. If input is a PNID command, output ONLY structured JSON with fields: 
   Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.

Input: """${trimmed}"""

Respond according to the rules above.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";

        if (!text) return { parsed: {}, explanation: "⚠️ AI returned empty response", mode: "chat", connection: null };

        try {
            const parsed = JSON.parse(text);
            return {
                parsed,
                explanation: parsed.Explanation || "Added PNID item",
                mode: "structured",
                connection: parsed.Connections || null,
            };
        } catch {
            return { parsed: {}, explanation: text, mode: "chat", connection: null };
        }
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return { parsed: {}, explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"), mode: "chat", connection: null };
    }
}

// Default API route
export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    const aiResult = await parseItemLogic(description);
    res.status(200).json(aiResult);
}
