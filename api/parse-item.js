// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Core logic for both chat and structured PNID commands
export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // 1️⃣ Detect conversational input (any non-PNID command)
    const pnidKeywords = /unit|sub[- ]?unit|sequence|category|type/i;
    const isPNID = pnidKeywords.test(trimmed);

    if (!isPNID) {
        // Send to Gemini as natural chat
        try {
            const chatPrompt = `You are a helpful assistant. Reply in natural human language to: "${trimmed}"`;
            const result = await model.generateContent(chatPrompt);
            const text = result?.response?.text?.().trim() || "I couldn't get a response";

            return {
                parsed: {},
                explanation: text,
                mode: "chat",
                connection: null,
            };
        } catch (err) {
            console.error("❌ Chat AI failed:", err);
            return {
                parsed: {},
                explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"),
                mode: "chat",
                connection: null,
            };
        }
    }

    // 2️⃣ Otherwise treat as PNID structured command
    const prompt = `
You are a PNID assistant.

Task:
1. If the input is conversational, reply naturally in plain text.
2. If the input is a PNID command, output ONLY structured JSON with fields: 
   Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.

Input: """${trimmed}"""

Respond according to the rules above.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";

        if (!text) {
            return {
                parsed: {},
                explanation: "⚠️ AI returned empty response",
                mode: "chat",
                connection: null,
            };
        }

        try {
            const parsed = JSON.parse(text);
            return {
                parsed,
                explanation: parsed.Explanation || "Added PNID item",
                mode: "structured",
                connection: parsed.Connections || null,
            };
        } catch (err) {
            // Not JSON, treat as human chat
            return {
                parsed: {},
                explanation: text,
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
