// ai/wedgeParse.js
// wedgeParse now handles conversational inputs naturally and structured PNID commands

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function wedgeParse(description) {
    try {
        const trimmed = description.trim();

        // 1️⃣ Handle conversational input
        const conversationalRegex = /^(hi|hello|how are you|what is|please explain)/i;
        if (conversationalRegex.test(trimmed)) {
            return {
                parsed: {},
                explanation: `Hi there! I'm your AI assistant. How can I help with your process diagram?`,
                mode: 'chat'
            };
        }

        // 2️⃣ Handle PNID commands
        const prompt = `
You are a PNID assistant.

Task:
1. If the input is conversational, reply naturally in plain text.
2. If the input is a PNID command, output ONLY structured JSON with fields: Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.

Input: """${trimmed}"""

Respond according to the rules above.
        `;

        const result = await model.generateContent(prompt);
        if (!result || !result.response) {
            console.warn("⚠️ No response from Gemini");
            return { parsed: {}, explanation: "⚠️ No response from AI", mode: "chat" };
        }

        const text = result.response.text ? result.response.text().trim() : "";
        console.log("👉 Gemini raw text:", text);
        if (!text) return { parsed: {}, explanation: "⚠️ AI returned empty response", mode: "chat" };

        try {
            const parsed = JSON.parse(text);
            return { parsed, explanation: parsed.Explanation || "", mode: "structured" };
        } catch (err) {
            console.warn("⚠️ Not JSON, treating as chat:", err.message);
            return { parsed: {}, explanation: text, mode: "chat" };
        }

    } catch (err) {
        console.error("❌ wedgeParse failed:", err);
        return { parsed: {}, explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"), mode: "chat" };
    }
}
