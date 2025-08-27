// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// In-memory storage of items across API calls
let existingItemsArray = [];

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

// Reserved action commands
const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // Check for exact action match
    const actionMatch = ACTION_COMMANDS.find(
        cmd => cmd.toLowerCase() === trimmed.toLowerCase()
    );
    if (actionMatch) {
        return {
            mode: "action",
            action: actionMatch,
            parsed: [],
            explanation: `Triggered action: ${actionMatch}`,
            connection: null,
        };
    }

    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:
1. Structured PNID mode
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- Always set "mode": "structured".
- Type must be a string. If multiple types are mentioned, generate separate JSON objects.
- Fill missing fields with defaults: "" for text, 0 for Unit/SubUnit, 1 for Sequence/Number, [] for Connections.
- Map "Connect X to Y" → {"from": X, "to": Y}.
- Wrap structured PNID JSON in a \`\`\`json ... \`\`\` code block.

2. Chat mode
- Triggered for small talk or unrelated input.
- Output plain text only.

Never mix modes. Default to chat mode if unsure.

User Input: """${trimmed}"""
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";
        console.log("👉 Gemini raw text:", text);

        if (!text) return { parsed: [], explanation: "⚠️ AI returned empty response", mode: "chat", connection: null };

        // Try JSON parse
        try {
            const cleaned = cleanAIJson(text);

            let parsed;
            try {
                parsed = JSON.parse(cleaned);
            } catch {
                const objects = cleaned
                    .split(/}\s*{/)
                    .map((part, idx, arr) => {
                        if (idx === 0 && arr.length > 1) return part + "}";
                        if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                        return "{" + part + "}";
                    });
                parsed = objects.map(obj => JSON.parse(obj));
            }

            // Normalize items
            const newItems = (Array.isArray(parsed) ? parsed : [parsed]).map(item => ({
                mode: "structured",
                Name: (item.Name || "").toString().trim(),
                Category: item.Category || "Equipment",
                Type: item.Type || "Generic",
                Unit: parseInt(item.Unit, 10) || 0,
                SubUnit: parseInt(item.SubUnit, 10) || 0,
                Sequence: parseInt(item.Sequence, 10) || 1,
                Number: parseInt(item.Number, 10) || 1,
                SensorType: item.SensorType || "",
                Explanation: item.Explanation || "Added PNID item",
                Connections: Array.isArray(item.Connections) ? item.Connections : [],
            }));

            // Merge into global array
            const itemsArray = [...existingItemsArray, ...newItems];

            // Collect connections
            const allConnections = itemsArray.flatMap(i => i.Connections);

            // Normalize to avoid mirrored duplicates
            const normalizedConnections = allConnections.map(c => {
                const from = (c.from || "").trim();
                const to = (c.to || "").trim();
                return from < to ? { from, to } : { from: to, to: from };
            });

            // Deduplicate
            const uniqueConnections = Array.from(
                new Map(normalizedConnections.map(c => [c.from + "->" + c.to, c])).values()
            );

            // Code generator helper
            function generateCode({ Unit, SubUnit, Sequence, Number }) {
                const u = String(Unit).padStart(1, "0");
                const su = String(SubUnit).padStart(1, "0");
                const seq = String(Sequence).padStart(2, "0");
                const num = String(Number).padStart(2, "0");
                return `${u}${su}${seq}${num}`;
            }

            // Auto-connect fallback for exactly two new items
            if (newItems.length === 2 && /connect/i.test(trimmed) && uniqueConnections.length === 0) {
                const [first, second] = newItems;
                uniqueConnections.push({ from: generateCode(first), to: generateCode(second) });
            }

            // Update in-memory array
            existingItemsArray = itemsArray;

            return {
                parsed: itemsArray,
                explanation: itemsArray[0]?.Explanation || "Added PNID item(s)",
                mode: "structured",
                connection: uniqueConnections,
            };

        } catch (err) {
            console.warn("⚠️ Not JSON, treating as chat:", err.message);
            return { parsed: [], explanation: text, mode: "chat", connection: null };
        }
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return { parsed: [], explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"), mode: "chat", connection: null };
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
