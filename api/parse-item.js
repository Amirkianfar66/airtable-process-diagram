// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import examples from "./gemini_pid_dataset.json";

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1").trim();
}

const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // --- Action commands ---
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
            connectionResolved: []
        };
    }

    // --- Extract Unit / Number (defaults) ---
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    const inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    const numberMatch = trimmed.match(/Draw\s+(\d+)\s+/i);
    const inputNumber = numberMatch ? parseInt(numberMatch[1], 10) : 1;

    // --- Few-shot batching ---
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
        const batch = examples.slice(i, i + BATCH_SIZE).map(e => {
            return `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`;
        }).join("\n\n");
        batches.push(batch);
    }
    const fewShots = batches.join("\n\n");

    // --- Prompt with Option B rule ---
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Always merge "Draw" and "Connect" into one JSON object with this structure:

\`\`\`json
{
  "mode": "structured",
  "items": [
    { "Name": "...", "Category": "...", "Type": "...", "Unit": 1, "SubUnit": 0, "Sequence": 1, "Number": 1, "SensorType": "", "Explanation": "", "Connections": [] }
  ],
  "connections": [
    { "from": "Tank1", "to": "Tank2" }
  ]
}
\`\`\`

- All fields must be non-null. Use:
  - "" for text
  - 0 for Unit/SubUnit
  - 1 for Sequence/Number
  - [] for arrays

2. Chat mode
- Triggered if input is small talk or unrelated to PNID.
- Output plain text only.
- Always set "mode": "chat".

### Few-shot examples (all):
${fewShots}

User Input: """${trimmed}"""
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";
        console.log("👉 Gemini raw text:", text);

        if (!text) {
            return { parsed: [], explanation: "⚠️ AI returned empty response", mode: "chat", connection: null, connectionResolved: [] };
        }

        const cleaned = cleanAIJson(text);
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.warn("⚠️ Not clean JSON, fallback parse:", e.message);
            return { parsed: [], explanation: text, mode: "chat", connection: null, connectionResolved: [] };
        }

        // ✅ Option A: Handle both old ("orders") and new ("items"+"connections") schema
        let itemsArray = [];
        let normalizedConnections = [];

        if (parsed.orders) {
            // Old schema: flatten "Draw" + "Connect"
            parsed.orders.forEach(order => {
                if (order.action === "Draw" && Array.isArray(order.items)) {
                    itemsArray.push(...order.items);
                }
                if (order.action === "Connect" && Array.isArray(order.connections)) {
                    normalizedConnections.push(...order.connections);
                }
            });
        } else {
            // New schema (preferred with Option B)
            itemsArray = parsed.items || [];
            normalizedConnections = parsed.connections || [];
        }

        // Normalize items
        const items = itemsArray.map(item => ({
            mode: "structured",
            Name: (item.Name || "").toString().trim(),
            Category: item.Category || "Equipment",
            Type: item.Type || "Generic",
            Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit,
            SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
            Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : 1,
            Number: item.Number !== undefined ? parseInt(item.Number, 10) : inputNumber,
            SensorType: item.SensorType || "",
            Explanation: item.Explanation || "Added PNID item",
            Connections: Array.isArray(item.Connections) ? item.Connections : [],
        }));

        // Build code map
        function generateCode(item) {
            return `${item.Unit}${item.SubUnit}${item.Sequence}${item.Number}`;
        }
        const nameToCode = new Map();
        items.forEach(it => {
            const code = generateCode(it);
            if (it.Name) nameToCode.set(it.Name.toLowerCase() + it.Number, code);
        });

        // Normalize connections
        const connectionResolved = normalizedConnections.map(c => {
            const fromCode = nameToCode.get((c.from || "").toLowerCase()) || c.from;
            const toCode = nameToCode.get((c.to || "").toLowerCase()) || c.to;
            return { from: fromCode, to: toCode };
        });

        return {
            parsed: items,
            explanation: items[0]?.Explanation || "Added PNID item(s)",
            mode: "structured",
            connection: connectionResolved.length > 0 ? connectionResolved : normalizedConnections,
            connectionResolved
        };
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return { parsed: [], explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"), mode: "chat", connection: null, connectionResolved: [] };
    }
}

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
