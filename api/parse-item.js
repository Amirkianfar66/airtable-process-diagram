// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import examples from "./gemini_pid_dataset.json"; // your fixed dataset

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1").trim();
}

// Reserved action commands
const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

// Main parsing logic
export async function parseItemLogic(description) {
    if (!description || !description.toString().trim()) {
        return { parsed: [], explanation: "No description provided", mode: "chat", connectionResolved: [] };
    }

    const trimmed = description.toString().trim();

    // 1) Action commands
    const actionMatch = ACTION_COMMANDS.find(cmd => cmd.toLowerCase() === trimmed.toLowerCase());
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

    // defaults extracted from the user's text
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    const inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    // we no longer use inputNumber to create multiple nodes automatically; we rely on items the AI returns
    // number detection left for informational use:
    const numberMatch = trimmed.match(/Draw\s+(\d+)\s+/i);
    const inputNumber = numberMatch ? parseInt(numberMatch[1], 10) : 1;

    // Build few-shot prompt (batch examples)
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
        const batch = examples.slice(i, i + BATCH_SIZE)
            .map(e => `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`)
            .join("\n\n");
        batches.push(batch);
    }
    const fewShots = batches.join("\n\n");

    // --- Updated Prompt (Option B: encourage flat items + connections) ---
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1) Preferred structured format (Option B):
- If the user asks to draw/create/place/generate/connect PNID items, OUTPUT a SINGLE JSON object wrapped in a \`\`\`json ... \`\`\` block with this exact shape:

\`\`\`json
{
  "mode":"structured",
  "items":[
    {
      "Name":"Tank",
      "Category":"Equipment",
      "Type":"Tank",
      "Unit":1,
      "SubUnit":0,
      "Sequence":1,
      "Number":1,
      "SensorType":"",
      "Explanation":"",
      "Connections":[]
    }
  ],
  "connections":[
    { "from":"Tank1", "to":"Tank2" }
  ]
}
\`\`\`

- Use arrays for items and connections. Each item must include all fields (use defaults: empty string for text, 0 for Unit/SubUnit, 1 for Sequence/Number, [] for Connections).
- Prefer this flat format. Include connections in the top-level "connections" array.
- Do NOT output any other commentary inside the code block.

2) Backward-compatible (Option A):
- If your internal reasoning prevented Option B, you may return an "orders" array like:
  { "orders":[ { "action":"Draw", "items":[...] }, { "action":"Connect", "connections":[...] } ] }
- The server is able to handle this, but prefer Option B.

3) Chat mode:
- For greetings, small talk, or non-PNID questions, reply in plain text (no code block), and set "mode":"chat".

Few-shot examples:
${fewShots}

User Input: """${trimmed}"""
`;

    try {
        const gen = await model.generateContent(prompt);
        const rawText = gen?.response?.text?.().trim() || "";
        console.log("👉 Gemini raw text:", rawText);

        if (!rawText) {
            return { parsed: [], explanation: "⚠️ AI returned empty response", mode: "chat", connectionResolved: [] };
        }

        const cleaned = cleanAIJson(rawText);

        // Try parse JSON safely
        let parsedJson;
        try {
            parsedJson = JSON.parse(cleaned);
        } catch (err) {
            // fallback: maybe multiple JSON objects concatenated — try to split and parse
            try {
                const objects = cleaned
                    .split(/}\s*{/)
                    .map((part, idx, arr) => {
                        if (idx === 0 && arr.length > 1) return part + "}";
                        if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                        return "{" + part + "}";
                    });
                parsedJson = objects.map(obj => JSON.parse(obj));
            } catch (err2) {
                console.warn("Failed to parse AI JSON, treating as chat:", err2);
                // treat as chat response
                return { parsed: [], explanation: rawText, mode: "chat", connectionResolved: [] };
            }
        }

        // --- Normalize: extract items & connections for both Option A and Option B ---
        let rawItems = [];
        let rawConnections = [];

        if (parsedJson?.orders && Array.isArray(parsedJson.orders)) {
            // Option A (orders) — combine Draw items and Connect connections
            parsedJson.orders.forEach(order => {
                const act = (order.action || "").toString().toLowerCase();
                if (act === "draw" && Array.isArray(order.items)) rawItems.push(...order.items);
                if ((act === "connect" || act === "connection") && Array.isArray(order.connections)) rawConnections.push(...order.connections);
            });
        } else {
            // Option B (preferred) or single object/array of items
            if (Array.isArray(parsedJson)) {
                // parsedJson is an array of items
                rawItems = parsedJson;
            } else if (parsedJson.items && Array.isArray(parsedJson.items)) {
                rawItems = parsedJson.items;
            } else if (parsedJson.mode === "structured" && parsedJson.items) {
                rawItems = Array.isArray(parsedJson.items) ? parsedJson.items : [parsedJson.items];
                rawConnections = Array.isArray(parsedJson.connections) ? parsedJson.connections : (parsedJson.connections ? [parsedJson.connections] : []);
            } else {
                // fallback — assume the object itself is a single item
                rawItems = [parsedJson];
            }

            // Also gather any inline Connections from items
            rawConnections.push(...rawItems.flatMap(i => i.Connections || []));
        }

        // --- Build normalized itemsArray (one item per returned item; no auto-multiplication) ---
        const itemsArray = rawItems.map((item, idx) => {
            const Name = (item.Name || item.Type || `Item${idx + 1}`).toString().trim();
            return {
                mode: "structured",
                Name,
                Category: item.Category || "Equipment",
                Type: item.Type || (Name || "Generic"),
                Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit,
                SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
                Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : (idx + 1),
                Number: item.Number !== undefined ? parseInt(item.Number, 10) : 1,
                SensorType: item.SensorType || "",
                Explanation: item.Explanation || (parsedJson.explanation || "Added PNID item"),
                Connections: Array.isArray(item.Connections) ? item.Connections : []
            };
        });

        // --- Generate codes and robust name->code map (map multiple possible keys like 'tank', 'tank1') ---
        function generateCode(item) {
            // pad or create a stable code — keep it simple and deterministic
            return `${item.Unit}${item.SubUnit}${item.Sequence}${item.Number}`;
        }

        const nameToCode = new Map();
        itemsArray.forEach((it, idx) => {
            const code = generateCode(it);
            const baseName = (it.Name || "").toString().trim().toLowerCase();
            if (baseName) {
                nameToCode.set(baseName, code);
                // common variants: "tank1", "tank-1", "tank_1"
                nameToCode.set((baseName + it.Sequence).toString().toLowerCase(), code);
                nameToCode.set((baseName + it.Number).toString().toLowerCase(), code);
                nameToCode.set((baseName + (idx + 1)).toString().toLowerCase(), code);
            }
            // also map the code to itself for convenience
            nameToCode.set(code, code);
        });

        // --- Normalize rawConnections into {from, to} objects ---
        const normalizedConnections = rawConnections
            .map(c => {
                if (!c) return null;
                if (typeof c === "string") {
                    const m = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                    if (m) return { from: m[1].trim(), to: m[2].trim() };
                    return null;
                }
                if (typeof c === "object") {
                    return {
                        from: (c.from || c.fromName || c.fromId || "").toString().trim(),
                        to: (c.to || c.toName || c.toId || "").toString().trim()
                    };
                }
                return null;
            })
            .filter(Boolean);

        // --- Resolve names to codes (case-insensitive) ---
        const connectionResolved = normalizedConnections.map(conn => {
            const fromKey = (conn.from || "").toString().toLowerCase();
            const toKey = (conn.to || "").toString().toLowerCase();
            const fromResolved = nameToCode.get(fromKey) || nameToCode.get(conn.from) || conn.from;
            const toResolved = nameToCode.get(toKey) || nameToCode.get(conn.to) || conn.to;
            return { from: fromResolved, to: toResolved };
        });

        // Attach resolved connections inline on items (where from matches)
        itemsArray.forEach(item => {
            const myCode = generateCode(item);
            const myLowerName = (item.Name || "").toString().toLowerCase();
            item.Connections = connectionResolved
                .filter(c => {
                    const from = (c.from || "").toString();
                    // match either by code or by name variants
                    return from === myCode || from.toLowerCase() === myLowerName || nameToCode.get(from.toLowerCase()) === myCode;
                })
                .map(c => c.to);
        });

        // Debug logs (helpful during development)
        console.log("✅ parsed items:", itemsArray);
        console.log("✅ resolved connections:", connectionResolved);

        return {
            parsed: itemsArray,
            connectionResolved,
            explanation: itemsArray[0]?.Explanation || "Added PNID item(s)",
            mode: "structured"
        };
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return { parsed: [], explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"), mode: "chat", connectionResolved: [] };
    }
}

// API handler
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
        const { description } = req.body;
        if (!description) return res.status(400).json({ error: "Missing description" });

        const aiResult = await parseItemLogic(description);
        return res.status(200).json(aiResult);
    } catch (err) {
        console.error("/api/parse-item error:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
