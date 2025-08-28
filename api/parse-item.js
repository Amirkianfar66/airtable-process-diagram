// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    // Remove ```json ... ``` or ``` ... ``` blocks
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

// Reserved action commands
const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

// Core logic for both chat and structured PNID commands
export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // 1️⃣ Check for exact action match (Hybrid)
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

    // 2️⃣ Otherwise, normal Gemini call
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- Always set "mode": "structured".
- Type must be a string. If multiple types are mentioned (e.g., "Tank and Pump"), generate **separate JSON objects** for each type.
- All fields must be non-null strings or numbers. If a value is missing, use:
    - "" (empty string) for text fields
    - 0 for Unit and SubUnit
    - 1 for Sequence and Number
    - [] for Connections
- If the user mentions "Draw N ...", set Number = N. Default to 1 if unspecified.
- Connections: map "Connect X to Y" → {"from": X, "to": Y}.
- Explanation: include a short human-readable note if relevant.
- Wrap structured PNID JSON in a \`\`\`json ... \`\`\` code block.
- Do NOT wrap chat mode responses in any code block or JSON.

2. Chat mode
- Triggered if input is small talk, greetings, or unrelated to PNID.
- Output plain text only.
- Always set "mode": "chat".

Never mix modes. Default to chat mode if unsure.

User Input: """${trimmed}"""
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";
        console.log("👉 Gemini raw text:", text);

        if (!text) {
            return {
                parsed: [],
                explanation: "⚠️ AI returned empty response",
                mode: "chat",
                connection: null,
                connectionResolved: []
            };
        }

        // Try JSON parse
        try {
            const cleaned = cleanAIJson(text);

            let parsed;
            try {
                parsed = JSON.parse(cleaned);
            } catch (e) {
                // Handle multiple JSON objects concatenated
                const objects = cleaned
                    .split(/}\s*{/)
                    .map((part, idx, arr) => {
                        if (idx === 0 && arr.length > 1) return part + "}";
                        if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                        return "{" + part + "}";
                    });
                parsed = objects.map(obj => JSON.parse(obj));
            }

            // Extract Unit from user input if mentioned
            const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
            const inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;

            // 🔹 Normalize items: remove nulls, fix types, set defaults
            const itemsArray = (Array.isArray(parsed) ? parsed : [parsed]).map(item => ({
                mode: "structured",
                Name: (item.Name || "").toString().trim(),
                Category: item.Category || "Equipment",
                Type: item.Type || "Generic",
                Unit: item.Unit !== undefined && item.Unit !== null
                    ? parseInt(item.Unit, 10)
                    : inputUnit,        // Use unit from user input if Gemini didn't provide
                SubUnit: item.SubUnit !== undefined && item.SubUnit !== null
                    ? parseInt(item.SubUnit, 10)
                    : 0,
                Sequence: item.Sequence !== undefined && item.Sequence !== null
                    ? parseInt(item.Sequence, 10)
                    : 1,
                Number: item.Number !== undefined && item.Number !== null
                    ? parseInt(item.Number, 10)
                    : 1,                // Always default to 1
                SensorType: item.SensorType || "",
                Explanation: item.Explanation || "Added PNID item",
                Connections: Array.isArray(item.Connections) ? item.Connections : [],
            }));




            // Small helper: generate PNID-style code (Unit + SubUnit + Sequence + Number)
            function generateCode(item) {
                return `${item.Unit}${item.SubUnit}${item.Sequence}${item.Number}`;
            }

            // Build a name -> code map for parsed items (so we can resolve names in connections to codes)
            const nameToCode = new Map();
            itemsArray.forEach(it => {
                const code = generateCode(it);
                if (it.Name) nameToCode.set(it.Name.toLowerCase(), code);
            });

            // --- Collect raw connections (flatten)
            const allRawConnections = itemsArray.flatMap(i => i.Connections || []);

            // Normalize raw connections into objects { from, to } (both strings)
            const normalizedConnections = allRawConnections
                .map(c => {
                    if (!c) return null;
                    if (typeof c === "string") {
                        // try to parse "A to B" or "A and B"
                        const m = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                        if (m) return { from: m[1].trim(), to: m[2].trim() };
                        return null;
                    }
                    if (typeof c === "object") {
                        return {
                            from: (c.from || c.fromName || "").toString().trim(),
                            to: (c.to || c.toName || c.toId || "").toString().trim()
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            // Resolve connections to codes where possible using parsed items
            const connectionResolved = normalizedConnections.map(c => {
                const fromCode = nameToCode.get((c.from || "").toLowerCase()) || c.from;
                const toCode = nameToCode.get((c.to || "").toLowerCase()) || c.to;
                return { from: fromCode, to: toCode };
            });

            return {
                parsed: itemsArray,
                explanation: itemsArray[0]?.Explanation || "Added PNID item(s)",
                mode: "structured",
                connection: connectionResolved.length > 0 ? connectionResolved : normalizedConnections,
                connectionResolved
            };
        } catch (err) {
            console.warn("⚠️ Not JSON, treating as chat:", err.message);
            return {
                parsed: [],
                explanation: text,
                mode: "chat",
                connection: null,
                connectionResolved: []
            };
        }
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return {
            parsed: [],
            explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"),
            mode: "chat",
            connection: null,
            connectionResolved: []
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
