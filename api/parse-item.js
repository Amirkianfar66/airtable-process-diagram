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
    const hasName = !!(obj.Name || obj.name);
    const hasCategory = !!(obj.Category || obj.category);
    const hasType = !!(obj.Type || obj.type);
    const looksLikeAction = !!(obj.action || obj.actionType);
    const isOnlyConnections = obj.connections && Object.keys(obj).length === 1;
    return (hasName || hasCategory || hasType) && !looksLikeAction && !isOnlyConnections;
}

// parse a connection-string into an array of ordered {from,to} pairs
function parseConnectionStringToPairs(str) {
    if (!str || typeof str !== "string") return [];

    // Normalize arrows and common separators to a single hit for splitting
    // Handles: ">>", "->", "→", " to ", ",", ";", " and ", " then "
    const tokens = str
        .split(/(?:\s*(?:>>|->|→|–>|to|,|;|\band\b|\bthen\b|\band then\b)\s*)+/i)
        .map(t => t.trim())
        .filter(Boolean);

    if (tokens.length >= 2) {
        // produce pairwise sequence: [A,B,C] => A->B, B->C
        const pairs = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            pairs.push({ from: tokens[i], to: tokens[i + 1] });
        }
        return pairs;
    }

    // fallback: try to match a single explicit arrow "A -> B" or "A to B"
    const arrowMatch = str.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
    const toMatch = str.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
    const m = arrowMatch || toMatch;
    if (m) {
        return [{ from: m[1].trim(), to: m[2].trim() }];
    }

    // fallback: if csv has two items
    const csv = str.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (csv.length === 2) return [{ from: csv[0], to: csv[1] }];

    return [];
}

// Core parsing logic
export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // Action command check
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

    // Extract Unit and Draw count
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    if (Number.isNaN(inputUnit)) inputUnit = 0;

    const numberMatch = trimmed.match(/Draw\s+(\d+)\s+/i);
    const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

    // Build few-shot prompt (batched)
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
        const batch = examples.slice(i, i + BATCH_SIZE).map(e => {
            return `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`;
        }).join("\n\n");
        batches.push(batch);
    }
    const fewShots = batches.join("\n\n");

    // Prompt
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
                // Split concatenated JSON fragments safely; ignore unparsable fragments
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
                        console.warn("⚠️ Failed parsing fragment (ignored):", err.message, obj.slice?.(0, 200) || obj);
                        return null;
                    }
                }).filter(Boolean);
            }

            // Extract rawItems & rawConnections safely
            let rawItems = [];
            let rawConnections = [];

            if (parsed?.orders && Array.isArray(parsed.orders)) {
                parsed.orders.forEach(order => {
                    if (order.action && order.action.toLowerCase() === "draw" && Array.isArray(order.items)) {
                        rawItems.push(...order.items);
                    }
                    if (order.action && order.action.toLowerCase() === "connect" && Array.isArray(order.connections)) {
                        rawConnections.push(...order.connections);
                    }
                });
            } else {
                const candidateArray = Array.isArray(parsed) ? parsed : [parsed];
                candidateArray.forEach(obj => {
                    if (obj.action && obj.action.toLowerCase() === "draw" && Array.isArray(obj.items)) {
                        rawItems.push(...obj.items);
                        return;
                    }
                    if (obj.action && obj.action.toLowerCase() === "connect" && Array.isArray(obj.connections)) {
                        rawConnections.push(...obj.connections);
                        return;
                    }
                    if (isLikelyItem(obj)) {
                        rawItems.push(obj);
                        if (Array.isArray(obj.Connections)) rawConnections.push(...obj.Connections);
                    } else if (Array.isArray(obj.connections)) {
                        rawConnections.push(...obj.connections);
                    } else if (typeof obj === "string") {
                        rawConnections.push(obj);
                    }
                });
            }

            // Filter only real-looking items
            rawItems = rawItems.filter(isLikelyItem);

            // --- AFTER rawItems is built and filtered ---
            // Normalize single item -> itemsArray skeleton (one entry per raw item)
            let itemsArray = rawItems.map((item, idx) => ({
                mode: "structured",
                // prefer Name, if empty fall back to Type (e.g. "Tank"), will uniquify later
                Name: (item.Name || item.name || item.Type || item.type || `Item${idx + 1}`).toString().trim(),
                Category: item.Category || item.category || "Equipment",
                Type: item.Type || item.type || "Generic",
                Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit || 0,
                SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
                // Use parsed Sequence if present, else placeholder; we'll reassign unique sequences below
                Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : null,
                // Number may mean "quantity" from the model; default 1
                Number: item.Number !== undefined ? Math.max(1, parseInt(item.Number, 10)) : 1,
                SensorType: item.SensorType || item.sensorType || "",
                Explanation: item.Explanation || item.explanation || `Added ${item.Type || 'item'}`,
                Connections: []
            }));

            // --- EXPAND items BY their Number field ---
            // If a single parsed object says Number: 2, expand it into two separate item entries now.
            {
                const expanded = [];
                let globalSeq = 1;
                for (const it of itemsArray) {
                    const qty = Math.max(1, it.Number || 1);
                    for (let k = 0; k < qty; k++) {
                        // create a shallow clone per unit with distinct Sequence placeholder
                        const clone = { ...it };
                        clone.Sequence = globalSeq; // temporarily unique sequence index; will be normalized again if needed
                        // If original Name looked generic or repeated, append instance suffix; we'll run full uniquify later
                        clone.Name = qty > 1 ? `${it.Name}_${k + 1}` : it.Name;
                        // Each expanded clone represents a single item now (Number becomes 1)
                        clone.Number = 1;
                        expanded.push(clone);
                        globalSeq++;
                    }
                }
                itemsArray = expanded;
            }

            // --- ENSURE sequences are contiguous & deterministic ---
            // Assign sequences 1..N to avoid duplicate Sequence causing identical codes.
            itemsArray = itemsArray.map((it, idx) => {
                it.Sequence = idx + 1; // guaranteed unique
                return it;
            });

            // --- NOW enforce the user's Draw N if present ---
            // If user explicitly requested Draw M, ensure final length = M.
            // But prefer already-expanded items if they already satisfy the count.
            if (inputNumber && inputNumber > 0) {
                if (itemsArray.length > inputNumber) {
                    itemsArray = itemsArray.slice(0, inputNumber);
                } else if (itemsArray.length < inputNumber) {
                    // Clone last item until reach requested count (give clones unique names & sequences)
                    const last = itemsArray[itemsArray.length - 1] || {
                        mode: "structured",
                        Name: `Item`,
                        Category: "Equipment",
                        Type: "Generic",
                        Unit: inputUnit || 0,
                        SubUnit: 0,
                        Sequence: itemsArray.length + 1,
                        Number: 1,
                        SensorType: "",
                        Explanation: "Auto-cloned PNID item",
                        Connections: []
                    };
                    while (itemsArray.length < inputNumber) {
                        const seq = itemsArray.length + 1;
                        const clone = { ...last, Sequence: seq, Name: `${last.Name}_${seq}` };
                        itemsArray.push(clone);
                    }
                }
            }


            // Generate deterministic unique codes (and avoid collisions)
            // Generate deterministic unique codes (and avoid collisions)
            const codeSet = new Set();
            const nameToCode = new Map();     // primary: normalizedName -> code
            const altNameLookup = new Map();  // secondary: rawLower -> code

            function baseCodeFor(item, idx) {
                // Base code made from Unit/SubUnit/Sequence/Number with consistent padding
                const u = String(item.Unit ?? 0).padStart(1, "0");
                const su = String(item.SubUnit ?? 0).padStart(1, "0");
                const seq = String(item.Sequence ?? (idx + 1)).padStart(2, "0");
                const num = String(item.Number ?? 1).padStart(2, "0");
                return `${u}${su}${seq}${num}`;
            }

            // helper: normalize keys
            function normalizeKey(s) {
                if (!s) return "";
                const str = String(s).trim().toLowerCase();
                const compact = str.replace(/[_\s,-]+/g, '');
                return compact.replace(/([a-zA-Z]+)0+(\d+)$/i, (m, p1, p2) => `${p1}${Number(p2)}`);
            }

            // ---------- build nameToCode (multiple lookup variants) ----------
            itemsArray.forEach((it, idx) => {
                let base = baseCodeFor(it, idx);
                let code = base;
                let suffix = 0;

                while (codeSet.has(code)) {
                    suffix++;
                    code = `${base}_${suffix}`;
                }
                codeSet.add(code);
                it._generatedCode = code;

                const rawName = (it.Name || '').toString().trim();
                const rawLower = rawName.toLowerCase();

                const n1 = normalizeKey(rawName);
                const n2 = rawLower.replace(/\s+/g, '_');

                if (n1) nameToCode.set(n1, code);
                if (n2) nameToCode.set(n2, code);
                if (rawLower) altNameLookup.set(rawLower, code);
            });



            // Normalize connections (support multi-step chains)
            const normalizedConnections = [];
            rawConnections.forEach(c => {
                if (!c) return;

                if (typeof c === "string") {
                    // Parse string into ordered pairs (support chains like A >> B >> C)
                    const pairs = parseConnectionStringToPairs(c);
                    if (pairs.length) {
                        pairs.forEach(pair => normalizedConnections.push(pair));
                        return;
                    }
                    // If no chain detected, attempt previous heuristics:
                    const arrowMatch = c.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
                    const toMatch = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                    const m = arrowMatch || toMatch;
                    if (m) {
                        normalizedConnections.push({ from: m[1].trim(), to: m[2].trim() });
                        return;
                    }
                    const csv = c.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                    if (csv.length === 2) {
                        normalizedConnections.push({ from: csv[0], to: csv[1] });
                        return;
                    }
                    // otherwise ignore or treat as single token (no-op)
                    return;
                }

                if (typeof c === "object") {
                    normalizedConnections.push({
                        from: (c.from || c.fromName || c.source || "").toString().trim(),
                        to: (c.to || c.toName || c.target || c.toId || "").toString().trim()
                    });
                }
            });

            const connectionResolved = normalizedConnections.map(c => {
                const fromRaw = (c.from || "").toString().trim();
                const toRaw = (c.to || "").toString().trim();

                const candFromKeys = [
                    normalizeKey(fromRaw),
                    fromRaw.toLowerCase(),
                    fromRaw.toLowerCase().replace(/\s+/g, '_'),
                    fromRaw.replace(/\s+/g, '')
                ].filter(Boolean);

                const candToKeys = [
                    normalizeKey(toRaw),
                    toRaw.toLowerCase(),
                    toRaw.toLowerCase().replace(/\s+/g, '_'),
                    toRaw.replace(/\s+/g, '')
                ].filter(Boolean);

                let resolvedFrom = null;
                let resolvedTo = null;

                for (const k of candFromKeys) {
                    if (nameToCode.has(k)) { resolvedFrom = nameToCode.get(k); break; }
                    if (altNameLookup.has(k)) { resolvedFrom = altNameLookup.get(k); break; }
                }
                for (const k of candToKeys) {
                    if (nameToCode.has(k)) { resolvedTo = nameToCode.get(k); break; }
                    if (altNameLookup.has(k)) { resolvedTo = altNameLookup.get(k); break; }
                }

                // fallback: if we didn't resolve, try simple numeric-suffix heuristic
                // e.g., fromRaw="Tank1" and names were "Tank" + "Tank_1" etc.
                if (!resolvedFrom) {
                    const m = fromRaw.match(/^([a-zA-Z]+)(\d+)$/);
                    if (m) {
                        const baseName = normalizeKey(m[1]);
                        const candidate = `${baseName}${Number(m[2])}`;
                        if (nameToCode.has(candidate)) resolvedFrom = nameToCode.get(candidate);
                    }
                }
                if (!resolvedTo) {
                    const m = toRaw.match(/^([a-zA-Z]+)(\d+)$/);
                    if (m) {
                        const baseName = normalizeKey(m[1]);
                        const candidate = `${baseName}${Number(m[2])}`;
                        if (nameToCode.has(candidate)) resolvedTo = nameToCode.get(candidate);
                    }
                }

                return {
                    from: resolvedFrom || fromRaw,
                    to: resolvedTo || toRaw
                };
            });


            // Attach resolved connections to items (by _generatedCode)
            itemsArray.forEach(item => {
                const itemCode = item._generatedCode;
                item.Connections = connectionResolved
                    .filter(c => c.from === itemCode)
                    .map(c => c.to);
            });

            // If user requested connect and no explicit connections were provided,
            // auto-connect sequentially using generated codes
            const userWantsConnect = /\bconnect\b/i.test(trimmed) || /connect them/i.test(trimmed);
            if (userWantsConnect && connectionResolved.length === 0 && itemsArray.length > 1) {
                for (let i = 0; i < itemsArray.length - 1; i++) {
                    const fromCode = itemsArray[i]._generatedCode;
                    const toCode = itemsArray[i + 1]._generatedCode;
                    if (!itemsArray[i].Connections.includes(toCode)) itemsArray[i].Connections.push(toCode);
                    connectionResolved.push({ from: fromCode, to: toCode });
                }
            }

            // Build final parsed objects removing internal-only fields and including code
            const finalParsed = itemsArray.map(it => {
                const out = { ...it };
                out.Code = it._generatedCode;
                delete out._generatedCode;
                return out;
            });

            // If something suspicious happened (e.g., finalParsed length != inputNumber), log full parsed frag for debugging
            if (finalParsed.length !== inputNumber) {
                console.warn("🛠️ parseItemLogic: finalParsed length mismatch",
                    { requested: inputNumber, got: finalParsed.length, rawParsedPreview: parsed?.slice?.(0, 5) || parsed });
            }

            const explanation = finalParsed.length > 0
                ? finalParsed.map(it => it.Explanation || `Added ${it.Name}`).join(" | ")
                : "Added PNID item(s)";

            return {
                parsed: finalParsed,
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
