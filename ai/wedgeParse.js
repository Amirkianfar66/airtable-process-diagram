// ai/wedgeParse.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function wedgeParse(description) {
    try {
        const prompt = `
You are a PNID assistant.

Task:
1. If the input is conversational (like "hi", "hello", "how are you?", "what is a pump?"),
   reply naturally as if you are a human process engineer talking to a colleague.
   Do NOT output JSON in this case — just give a friendly, natural response.

2. If the input is a PNID command (like "Draw 1 equipment tank", "Add 2 pumps", "Connect pump to tank"),
   output ONLY structured JSON with the following fields:
   {
     "Name": "...",
     "Category": "...",
     "Type": "...",
     "Unit": "...",
     "SubUnit": "...",
     "Sequence": "...",
     "Number": "...",
     "SensorType": "...",
     "Explanation": "...",
     "Connections": [...]
   }

Input: """${description}"""

Now respond according to the rules above.
    `;

        const result = await model.generateContent(prompt);

        // Defensive: check everything step by step
        if (!result || !result.response) {
            console.warn("⚠️ No response from Gemini");
            return { parsed: {}, explanation: "⚠️ No response from AI", mode: "chat" };
        }

        const text = result.response.text ? result.response.text().trim() : "";
        console.log("👉 Gemini raw text:", text);

        if (!text) {
            return { parsed: {}, explanation: "⚠️ AI returned empty response", mode: "chat" };
        }

        // Try parsing JSON, fallback to chat
        try {
            const parsed = JSON.parse(text);
            return {
                parsed,
                explanation: parsed.Explanation || "",
                mode: "structured",
            };
        } catch (err) {
            console.warn("⚠️ Not JSON, treating as chat:", err.message);
            return { parsed: {}, explanation: text, mode: "chat" };
        }
    } catch (err) {
        console.error("❌ wedgeParse failed:", err);
        return {
            parsed: {},
            explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"),
            mode: "chat",
        };
    }
}
