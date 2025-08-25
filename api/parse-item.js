// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    // Remove ```json ... ``` or ``` ... ``` blocks
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/i, '$1').trim();
}

// Core logic for both chat and structured PNID commands
export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // ✅ Prompt Gemini to classify the input as chat or PNID
    const prompt = `
You are a PNID assistant with two modes: **structured PNID mode** and **chat mode**.

Rules:
1. If the input starts with a command word with a capital first letter 
   (e.g., "Draw", "PnID", "Connect", "Generate", "Add"), 
   or if the input clearly describes equipment, piping, instruments, or diagrams → 
   respond in **structured PNID mode**.

   - Output ONLY valid JSON with fields: 
     { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }

   - Always set "mode": "structured".

2. If the input is general conversation (greetings like "Hi", "Hello", 
   small talk, questions unrelated to PNID, weather, etc.) → 
   respond in **chat mode**.

   - Output ONLY plain text (not JSON).
   - Always set "mode": "chat".

Important:
- Never mix modes.
- If you are unsure, default to "chat" mode.

User Input: """${trimmed}"""
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

        // Try to parse JSON (structured PNID mode)
        try {
            const cleaned = cleanAIJson(text);
            const parsed = JSON.parse(cleaned);
            return {
                parsed,
                explanation: parsed.Explanation || "Added PNID item",
                mode: parsed.mode || "structured",
                connection: parsed.Connections || null,
            };
        } catch (err) {
            // Not valid JSON → treat as human chat
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
