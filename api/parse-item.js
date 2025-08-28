// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import examples from "./gemini_pid_dataset.json"; // ✅ Import your local dataset

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

// Reserved action commands
const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

// Helper: decide whether a parsed object looks like a PNID item
function isLikelyItem(obj) {
    if (!obj || typeof obj !== "object") return false;
    // Must contain at least one of these identifying fields with truthy value
    const hasName = !!(obj.Name || obj.name);
    const hasCategory = !!(obj.Category || obj.category);
    const hasType = !!(obj.Type || obj.type);
    const hasExplicitFields = hasName || hasCategory || hasType;
    // Also, reject objects that look like "action" / "connections" wrappers
    const looksLikeAction = !!(obj.action || obj.actionType);
    const isOnlyConnections = obj.connections && Object.keys(obj).length === 1;
    return hasExplicitFields && !looksLikeAction && !isOnlyConnections;
}

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

    // --- Extract Unit from user input if mentioned
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    if (Number.isNaN(inputUnit)) inputUnit = 0;

    // --- Extract explicit number of items only if user wrote "Draw N ..."
    const numberMatch = trimmed.match(/Draw\s+(\d+)\s+/i);
    const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

    // --- Build few-shot prompt with all examples (split into batches if too long)
    const BATCH_SIZE = 10; // You can tweak based on prompt length limits
    const batches = [];
    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
        const batch = examples.slice(i, i + BATCH_SIZE).map(e => {
            return `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`;
        }).join("\n\n");
        batches.push(batch);
    }

    const fewShots = batches.join("\n\n"); // Combine all batches

    // 2️⃣ Otherwise, normal Gemini call
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- All fields must be non-null. Use:
    - "" (empty string) for text fields
    - 0 for Unit and SubUnit
    - 1 for Sequence and Number
    - [] for Connections
- Wrap structured PNID JSON in a \`\`\`json ... \`\`\` code block.
- Do NOT wrap chat mode responses in any code block or JSON.

2. Chat mode
- Triggered if input is small talk, greetings, or unrelated to PNID.
- Output plain text only.
- Always set "mode": "chat".

### Few-shot examples (all 100):
${fewShots}

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

        try {
            const cleaned = cleanAIJson(text);

            let parsed;
            try {
                parsed = JSON.parse(cleaned);
            } catch (e) {
                // Try splitting concatenated JSON objects "}{"
                const objects = cleaned
                    .split(/}\s*{/)
                    .map((part, idx, arr) => {
                        if (idx === 0 && arr.length > 1) return part + "}";
                        if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                        return "{" + part + "}";
                    });
                parsed = objects.map(obj => {
                    try {
                        return JSON.parse(obj);
                    } catch (err) {
                        // If a fragment is unparsable, return null (we will filter later)
                        console.warn("⚠️ Failed parsing fragment:", err.message, obj);
                        return null;
                    }
                }).filter(Boolean);
            }

            // 🔹 Step 1: extract items & connections safely
            let rawItems = [];
            let rawConnections = [];

            if (parsed?.orders && Array.isArray(parsed.orders)) {
                // Option A: structured orders
                parsed.orders.forEach(order => {
                    if (order.action && order.action.toLowerCase() === "draw" && Array.isArray(order.items)) {
                        rawItems.push(...order.items);
                    }
                    if (order.action && order.action.toLowerCase() === "connect" && Array.isArray(order.connections)) {
                        rawConnections.push(...order.connections);
                    }
                });
            } else {
                // Option B: flat JSON (new Gemini)
                // parsed could be an array or object
                const candidateArray = Array.isArray(parsed) ? parsed : [parsed];

                candidateArray.forEach(obj => {
                    // If the object describes an order (has action + items/connections), extract appropriately
                    if (obj.action && obj.action.toLowerCase() === "draw" && Array.isArray(obj.items)) {
                        rawItems.push(...obj.items);
                        return;
                    }
                    if (obj.action && obj.action.toLowerCase() === "connect" && Array.isArray(obj.connections)) {
                        rawConnections.push(...obj.connections);
                        return;
                    }

                    // Otherwise treat plain objects that look like items as items
                    if (isLikelyItem(obj)) {
                        rawItems.push(obj);
                        // also capture any Connections field embedded inside items but keep them separate
                        if (Array.isArray(obj.Connections)) rawConnections.push(...obj.Connections);
                    } else if (Array.isArray(obj.connections)) {
                        rawConnections.push(...obj.connections);
                    } else if (typeof obj === "string") {
                        // strings can be connection descriptions or simple names
                        // we'll handle them during normalization
                        rawConnections.push(obj);
                    }
                });
            }

            // Filter rawItems to only keep those that look like real items
            rawItems = rawItems.filter(isLikelyItem);

            // 🔹 Step 2: normalize items
            let itemsArray = rawItems.map((item, idx) => ({
                mode: "structured",
                Name: (item.Name || item.name || `Item${idx + 1}`).toString().trim(),
                Category: item.Category || item.category || "Equipment",
                Type: item.Type || item.type || "Generic",
                Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit || 0,
                SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
                Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : idx + 1, // sequence auto
                Number: item.Number !== undefined ? parseInt(item.Number, 10) : 1,            // default 1
                SensorType: item.SensorType || item.sensorType || "",
                Explanation: item.Explanation || item.explanation || "Added PNID item",
                Connections: [] // we will fill this next
            }));

            // 🔹 Step 2.5: ENFORCE explicit "Draw N" count from user input
            // If user asked "Draw 2 ..." we ensure exactly 2 items are produced.
            if (inputNumber && inputNumber > 0) {
                if (itemsArray.length > inputNumber) {
                    // Trim extras (likely caused by mis-parsed fragments)
                    itemsArray = itemsArray.slice(0, inputNumber);
                } else if (itemsArray.length < inputNumber) {
                    // Auto-clone the last valid item until we reach requested count
                    const last = itemsArray[itemsArray.length - 1] || {
                        mode: "structured",
                        Name: `Item`,
                        Category: "Equipment",
                        Type: "Generic",
                        Unit: inputUnit || 0,
                        SubUnit: 0,
                        Sequence: 1,
                        Number: 1,
                        SensorType: "",
                        Explanation: "Auto-cloned PNID item",
                        Connections: []
                    };
                    while (itemsArray.length < inputNumber) {
                        const seq = itemsArray.length + 1;
                        const clone = {
                            ...last,
                            Sequence: seq,
                            Name: `${last.Name}_${seq}`
                        };
                        itemsArray.push(clone);
                    }
                }
            }

            // 🔹 Step 3: generate codes
            function generateCode(item) {
                // Keep original simple code scheme (Unit SubUnit Sequence Number)
                return `${item.Unit}${item.SubUnit}${item.Sequence}${item.Number}`;
            }
            const nameToCode = new Map();
            itemsArray.forEach(it => {
                const code = generateCode(it);
                if (it.Name) nameToCode.set(it.Name.toLowerCase(), code);
            });

            // 🔹 Step 4: normalize connections
            const normalizedConnections = rawConnections
                .map(c => {
                    if (!c) return null;
                    if (typeof c === "string") {
                        // parse texts like "Tank1 to Tank2", "Tank1 → Tank2", "Tank1 and Tank2"
                        const arrowMatch = c.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
                        const toMatch = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                        const m = arrowMatch || toMatch;
                        if (m) return { from: m[1].trim(), to: m[2].trim() };
                        // fallback: maybe it's "Connect Tank1,Tank2" or "Tank1, Tank2"
                        const csv = c.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                        if (csv.length === 2) return { from: csv[0], to: csv[1] };
                        return null;
                    }
                    if (typeof c === "object") {
                        return {
                            from: (c.from || c.fromName || c.source || "").toString().trim(),
                            to: (c.to || c.toName || c.target || c.toId || "").toString().trim()
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            // 🔹 Step 5: resolve names to codes
            const connectionResolved = normalizedConnections.map(c => ({
                from: nameToCode.get((c.from || "").toLowerCase()) || c.from,
                to: nameToCode.get((c.to || "").toLowerCase()) || c.to
            }));

            // 🔹 Step 6: attach resolved connections to items
            itemsArray.forEach(item => {
                const itemCode = generateCode(item);
                item.Connections = connectionResolved
                    .filter(c => c.from === itemCode)
                    .map(c => c.to);
            });

            // 🔹 Step 7: if user explicitly asked to "connect" but Gemini returned no connections,
            // and there are multiple items, auto-sequentially connect them (Item1 -> Item2 -> ...)
            const userWantsConnect = /\bconnect\b/i.test(trimmed) || /\bconnect them\b/i.test(trimmed) || /connect together/i.test(trimmed);
            if (userWantsConnect && connectionResolved.length === 0 && itemsArray.length > 1) {
                for (let i = 0; i < itemsArray.length - 1; i++) {
                    const fromCode = generateCode(itemsArray[i]);
                    const toCode = generateCode(itemsArray[i + 1]);
                    // attach to from item's Connections
                    const fromItem = itemsArray[i];
                    if (!fromItem.Connections.includes(toCode)) fromItem.Connections.push(toCode);
                    connectionResolved.push({ from: fromCode, to: toCode });
                }
            }

            // 🔹 Step 8: final explanation
            const explanation = itemsArray.length > 0
                ? itemsArray.map(it => it.Explanation || `Added ${it.Name}`).join(" | ")
                : "Added PNID item(s)";

            // 🔹 Step 9: return clean structure
            return {
                parsed: itemsArray,
                connectionResolved,
                explanation,
                mode: "structured"
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
