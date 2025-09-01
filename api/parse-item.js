// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import examples from "./gemini_pid_dataset.json"; // local examples dataset

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1").trim();
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
    const isOnlyConnections = obj && obj.connections && Object.keys(obj).length === 1;
    return (hasName || hasCategory || hasType) && !looksLikeAction && !isOnlyConnections;
}

// parse a connection-string into an array of ordered {from,to} pairs
function parseConnectionStringToPairs(str) {
    if (!str || typeof str !== "string") return [];

    const tokens = str
        .split(/(?:\s*(?:>>|->|→|–>|to|,|;|\band\b|\bthen\b|\band then\b)\s*)+/i)
        .map((t) => t.trim())
        .filter(Boolean);

    if (tokens.length >= 2) {
        const pairs = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            pairs.push({ from: tokens[i], to: tokens[i + 1] });
        }
        return pairs;
    }

    const arrowMatch = str.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
    const toMatch = str.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
    const m = arrowMatch || toMatch;
    if (m) {
        return [{ from: m[1].trim(), to: m[2].trim() }];
    }

    const csv = str.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    if (csv.length === 2) return [{ from: csv[0], to: csv[1] }];

    return [];
}

// Helper: build deterministic codes and lookup maps from itemsArray
function buildCodeLookups(itemsArray) {
    const codeSet = new Set();
    const nameToCode = new Map(); // normalizedName -> code
    const altNameLookup = new Map(); // rawLower -> code

    function baseCodeFor(item, idx) {
        const u = String(item.Unit ?? 0).padStart(1, "0");
        const su = String(item.SubUnit ?? 0).padStart(1, "0");
        const seq = String(item.Sequence ?? (idx + 1)).padStart(2, "0");
        const num = String(item.Number ?? 1).padStart(2, "0");
        return `${u}${su}${seq}${num}`;
    }

    function normalizeKey(s) {
        if (!s) return "";
        const str = String(s).trim().toLowerCase();
        const compact = str.replace(/[_\s,-]+/g, "");
        return compact.replace(/([a-zA-Z]+)0+(\d+)$/i, (m, p1, p2) => `${p1}${Number(p2)}`);
    }

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

        const rawName = (it.Name || "").toString().trim();
        const rawLower = rawName.toLowerCase();
        const n1 = normalizeKey(rawName);
        const n2 = rawLower.replace(/\s+/g, "_");

        if (n1) nameToCode.set(n1, code);
        if (n2) nameToCode.set(n2, code);
        if (rawLower) altNameLookup.set(rawLower, code);

        // also map code itself for direct lookups
        nameToCode.set(String(code), code);
        altNameLookup.set(String(code), code);
    });

    return { nameToCode, altNameLookup };
}

// Core parsing logic
export async function parseItemLogic(description) {
    const trimmed = (description || "").toString().trim();

    // Action command check
    const actionMatch = ACTION_COMMANDS.find((cmd) => cmd.toLowerCase() === trimmed.toLowerCase());
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
        const batch = examples
            .slice(i, i + BATCH_SIZE)
            .map((e) => `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`)
            .join("\n\n");
        batches.push(batch);
    }
    const fewShots = batches.join("\n\n");

    // Prompt (keeps Option B preference)
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Preferred output (Option B): return a single JSON object wrapped in a \`\`\`json ... \`\`\` block with fields:
  { "mode":"structured", "items":[...], "connections":[...] }
- Backward-compatible (Option A): older "orders" array format is acceptable if necessary.
- Defaults: use "" for strings, 0 for Unit/SubUnit, 1 for Sequence/Number, [] for Connections.

2. Chat mode
- For greetings/small talk, return plain text and set "mode": "chat".

Few-shot examples:
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

        // Clean code fences
        const cleaned = cleanAIJson(text);

        // Parse JSON with robust fallbacks
        let parsedJson;
        try {
            parsedJson = JSON.parse(cleaned);
        } catch (err) {
            // try splitting concatenated objects and parsing each; ignore unparsable fragments
            const fragments = cleaned.split(/}\s*{/).map((part, idx, arr) => {
                if (idx === 0 && arr.length > 1) return part + "}";
                if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                return "{" + part + "}";
            });
            parsedJson = fragments.map((frag) => {
                try {
                    return JSON.parse(frag);
                } catch (e) {
                    // ignore bad fragment
                    console.warn("⚠️ Ignored fragment while parsing AI JSON:", e.message, frag.slice?.(0, 200) || frag);
                    return null;
                }
            }).filter(Boolean);

            // if we ended up with just one object in array, unwrap it for simpler handling below
            if (Array.isArray(parsedJson) && parsedJson.length === 1) parsedJson = parsedJson[0];
        }

        // Build rawItems & rawConnections from Option A (orders) or Option B (items + connections)
        let rawItems = [];
        let rawConnections = [];

        if (parsedJson && parsedJson.orders && Array.isArray(parsedJson.orders)) {
            // Option A
            parsedJson.orders.forEach((order) => {
                const act = (order.action || "").toString().toLowerCase();
                if (act === "draw" && Array.isArray(order.items)) rawItems.push(...order.items);
                if ((act === "connect" || act === "connection") && Array.isArray(order.connections)) rawConnections.push(...order.connections);
            });
        } else {
            // Option B or misc shapes
            const candidateArray = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
            candidateArray.forEach((obj) => {
                if (!obj) return;
                if (obj.action && obj.action.toLowerCase() === "draw" && Array.isArray(obj.items)) {
                    rawItems.push(...obj.items);
                    return;
                }
                if (obj.action && obj.action.toLowerCase() === "connect" && Array.isArray(obj.connections)) {
                    rawConnections.push(...obj.connections);
                    return;
                }
                if (obj.mode === "structured" && Array.isArray(obj.items)) {
                    rawItems.push(...obj.items);
                    if (Array.isArray(obj.connections)) rawConnections.push(...obj.connections);
                    return;
                }
                if (isLikelyItem(obj)) {
                    rawItems.push(obj);
                    if (Array.isArray(obj.Connections)) rawConnections.push(...obj.Connections);
                    return;
                }
                if (Array.isArray(obj.connections)) {
                    rawConnections.push(...obj.connections);
                    return;
                }
                if (typeof obj === "string") {
                    rawConnections.push(obj);
                    return;
                }
            });
        }

        // Keep only real-looking items
        rawItems = rawItems.filter(isLikelyItem);

        // Build itemsArray skeleton (one entry per raw item)
        let itemsArray = rawItems.map((item, idx) => ({
            mode: "structured",
            Name: (item.Name || item.name || item.Type || item.type || `Item${idx + 1}`).toString().trim(),
            Category: item.Category || item.category || "Equipment",
            Type: item.Type || item.type || (item.Name || "Generic"),
            Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit || 0,
            SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
            Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : null,
            Number: item.Number !== undefined ? Math.max(1, parseInt(item.Number, 10)) : 1,
            SensorType: item.SensorType || item.sensorType || "",
            Explanation: item.Explanation || item.explanation || `Added ${item.Type || "item"}`,
            Connections: []
        }));

        // Expand items by their Number field (if the model returned Number>1)
        {
            const expanded = [];
            let globalSeq = 1;
            for (const it of itemsArray) {
                const qty = Math.max(1, it.Number || 1);
                for (let k = 0; k < qty; k++) {
                    const clone = { ...it };
                    clone.Sequence = globalSeq;
                    clone.Name = qty > 1 ? `${it.Name}_${k + 1}` : it.Name;
                    clone.Number = 1;
                    expanded.push(clone);
                    globalSeq++;
                }
            }
            itemsArray = expanded;
        }

        // Ensure contiguous sequences 1..N
        itemsArray = itemsArray.map((it, idx) => {
            it.Sequence = idx + 1;
            return it;
        });

        // Enforce user Draw N if present (prefer existing expanded items if present)
        if (inputNumber && inputNumber > 0) {
            if (itemsArray.length > inputNumber) {
                itemsArray = itemsArray.slice(0, inputNumber);
            } else if (itemsArray.length < inputNumber) {
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

        // Build code lookups once (avoid redeclarations)
        const { nameToCode, altNameLookup } = buildCodeLookups(itemsArray);

        // Normalize rawConnections into objects {from, to}
        const normalizedConnections = [];
        rawConnections.forEach((c) => {
            if (!c) return;
            if (typeof c === "string") {
                const pairs = parseConnectionStringToPairs(c);
                if (pairs.length) {
                    normalizedConnections.push(...pairs);
                    return;
                }
                // fallback heuristics
                const arrowMatch = c.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
                const toMatch = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                const m = arrowMatch || toMatch;
                if (m) {
                    normalizedConnections.push({ from: m[1].trim(), to: m[2].trim() });
                    return;
                }
                const csv = c.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
                if (csv.length === 2) {
                    normalizedConnections.push({ from: csv[0], to: csv[1] });
                    return;
                }
                return;
            }
            if (typeof c === "object") {
                normalizedConnections.push({
                    from: (c.from || c.fromName || c.source || "").toString().trim(),
                    to: (c.to || c.toName || c.target || c.toId || "").toString().trim()
                });
            }
        });

        // Resolve connection endpoints to generated codes using multiple candidate keys
        function candidateKeysFor(raw) {
            const r = (raw || "").toString().trim();
            return [
                r ? r.toLowerCase() : "",
                r ? r.replace(/\s+/g, "_").toLowerCase() : "",
                r ? r.replace(/\s+/g, "").toLowerCase() : "",
                (() => {
                    const m = r.match(/^([a-zA-Z]+)0*(\d+)$/);
                    return m ? `${m[1].toLowerCase()}${Number(m[2])}` : "";
                })()
            ].filter(Boolean);
        }

        const connectionResolved = normalizedConnections.map((c) => {
            const fromRaw = (c.from || "").toString().trim();
            const toRaw = (c.to || "").toString().trim();

            let resolvedFrom = null;
            let resolvedTo = null;

            for (const k of candidateKeysFor(fromRaw)) {
                if (nameToCode.has(k)) { resolvedFrom = nameToCode.get(k); break; }
                if (altNameLookup.has(k)) { resolvedFrom = altNameLookup.get(k); break; }
            }
            for (const k of candidateKeysFor(toRaw)) {
                if (nameToCode.has(k)) { resolvedTo = nameToCode.get(k); break; }
                if (altNameLookup.has(k)) { resolvedTo = altNameLookup.get(k); break; }
            }

            // numeric-suffix heuristic: Tank1 -> tank1
            if (!resolvedFrom) {
                const m = fromRaw.match(/^([a-zA-Z]+)(\d+)$/);
                if (m) {
                    const cand = (m[1].toLowerCase() + Number(m[2])).toLowerCase();
                    if (nameToCode.has(cand)) resolvedFrom = nameToCode.get(cand);
                }
            }
            if (!resolvedTo) {
                const m = toRaw.match(/^([a-zA-Z]+)(\d+)$/);
                if (m) {
                    const cand = (m[1].toLowerCase() + Number(m[2])).toLowerCase();
                    if (nameToCode.has(cand)) resolvedTo = nameToCode.get(cand);
                }
            }

            return {
                from: resolvedFrom || fromRaw,
                to: resolvedTo || toRaw
            };
        });

        // Attach resolved connections to items (match by _generatedCode)
        itemsArray.forEach((item) => {
            const code = item._generatedCode;
            item.Connections = connectionResolved
                .filter((c) => String(c.from) === String(code))
                .map((c) => c.to);
        });

        // If user asked to "connect" and there were no explicit connections, auto-connect sequentially
        const userWantsConnect = /\bconnect\b/i.test(trimmed);
        if (userWantsConnect && connectionResolved.length === 0 && itemsArray.length > 1) {
            for (let i = 0; i < itemsArray.length - 1; i++) {
                const fromCode = itemsArray[i]._generatedCode;
                const toCode = itemsArray[i + 1]._generatedCode;
                if (!itemsArray[i].Connections.includes(toCode)) itemsArray[i].Connections.push(toCode);
                connectionResolved.push({ from: fromCode, to: toCode });
            }
        }

        // Build final parsed objects (expose Code, remove internal fields)
        const finalParsed = itemsArray.map((it) => {
            const out = { ...it };
            out.Code = it._generatedCode;
            delete out._generatedCode;
            return out;
        });

        // Debug: warn if mismatch between requested draw count and final items
        if (finalParsed.length !== inputNumber) {
            console.warn("🛠️ parseItemLogic: finalParsed length mismatch", {
                requested: inputNumber,
                got: finalParsed.length,
                previewRawParsed: Array.isArray(parsedJson) ? parsedJson.slice(0, 5) : parsedJson
            });
        }

        const explanation = finalParsed.length > 0
            ? finalParsed.map((it) => it.Explanation || `Added ${it.Name}`).join(" | ")
            : "Added PNID item(s)";

        return {
            parsed: finalParsed,
            connectionResolved,
            explanation,
            mode: "structured"
        };
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
        return res.status(200).json(aiResult);
    } catch (err) {
        console.error("/api/parse-item error:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
