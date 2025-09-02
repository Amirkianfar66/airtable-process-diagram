// File: /api/parse-item.js
// =============================
import { GoogleGenerativeAI } from '@google/generative-ai';
import examples from './gemini_pid_dataset.json'; // ✅ Local few-shot dataset

console.log('Loaded gemini examples count:', examples?.length);

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

// Reserved action commands
const ACTION_COMMANDS = ['Generate PNID', 'Export', 'Clear', 'Save'];

// Helper: decide whether a parsed object looks like a PNID item
function isLikelyItem(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const hasName = !!(obj.Name || obj.name);
    const hasCategory = !!(obj.Category || obj.category);
    const hasType = !!(obj.Type || obj.type);
    const looksLikeAction = !!(obj.action || obj.actionType);
    const isOnlyConnections = obj.connections && Object.keys(obj).length === 1;
    return (hasName || hasCategory || hasType) && !looksLikeAction && !isOnlyConnections;
}

// Core parsing logic
// Core parsing logic — upgraded: default chat, PNID-only structured JSON
export async function parseItemLogic(description) {
    const trimmed = (description || '').trim();

    // === Quick local small sanity check ===
    if (!trimmed) {
        return {
            parsed: [],
            items: [],
            explanation: 'No input provided.',
            mode: 'chat',
            connection: null,
            connectionResolved: [],
            connections: [],
        };
    }

    // === Action commands (unchanged) ===
    const ACTION_COMMANDS = ['Generate PNID', 'Export', 'Clear', 'Save'];
    const actionMatch = ACTION_COMMANDS.find((cmd) => cmd.toLowerCase() === trimmed.toLowerCase());
    if (actionMatch) {
        return {
            mode: 'action',
            action: actionMatch,
            parsed: [],
            items: [],
            explanation: `Triggered action: ${actionMatch}`,
            connection: null,
            connectionResolved: [],
            connections: [],
        };
    }

    // === Intent detection (heuristic) ===
    // If user uses explicit PNID command words or PNID-specific nouns, treat as structured.
    const PNID_COMMAND_START = /^\s*(draw|connect|add|generate|pnid|pnid:)/i;
    const PNID_KEYWORDS = /\b(draw|connect|pump|valve|pipe|instrument|fitting|tank|equipment|flange|p&id|p&ids|pnid|p n i d|sensor|controller|pump\d*|unit\s*\d+|subunit|sequence|connect them|connect to)\b/i;

    // If explicit start command OR keywords -> structured intent
    const likelyStructured = PNID_COMMAND_START.test(trimmed) || PNID_KEYWORDS.test(trimmed);

    // === If NOT structured: route to conversational chat mode (default behavior) ===
    if (!likelyStructured) {
        try {
            // Chat prompt: keep it natural, plain text output expected
            const chatPrompt = `You are a friendly, helpful assistant. Reply conversationally to the user input below. Output plain text only (no JSON, no code blocks).

User: """${trimmed}"""`;

            const chatResult = await model.generateContent(chatPrompt);
            const chatText = (chatResult?.response?.text?.().trim()) || `Hi — I'm here. How can I help with PNID or other questions?`;

            return {
                parsed: [],
                items: [],
                explanation: chatText,
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        } catch (err) {
            // fallback simple canned reply
            return {
                parsed: [],
                items: [],
                explanation: "Hi — I couldn't contact the assistant for a reply, but I'm here to help. Try asking your PNID or general question again.",
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        }
    }

    // === Structured PNID path ===
    // Extract Unit and Draw count
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    if (Number.isNaN(inputUnit)) inputUnit = 0;

    const numberMatch = trimmed.match(/Draw\s+(\d+)\s*/i);
    const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

    console.log('parseItemLogic: using', examples.length, 'few-shot examples');
    const approxPromptLen = examples.reduce((acc, e) => acc + JSON.stringify(e).length, 0);
    console.log('parseItemLogic: examples JSON roughly', Math.round(approxPromptLen / 1000), 'KB');

    // Build few-shot batches (same as before)
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
        const batch = examples
            .slice(i, i + BATCH_SIZE)
            .map((e) => `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`)
            .join('\n\n');
        batches.push(batch);
    }
    const fewShots = batches.join('\n\n');

    // Structured prompt — require JSON in a ```json block
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:
1) Structured PNID mode:
- If the user requests drawing/connecting/adding PNID items, RETURN ONLY a single VALID JSON object wrapped in a \`\`\`json ... \`\`\` block.
- Example start: \`\`\`json\n{ "mode": "structured", "items": [...] }\n\`\`\`
- Fields to include for each item: Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.
- Use "" for empty text fields, 0 for Unit/SubUnit numeric defaults, 1 for Sequence/Number defaults, and [] for Connections.

2) Chat mode:
- If the input is general chat, respond with plain text only (no JSON, no code blocks).

Few-shot examples:
${fewShots}

User Input: """${trimmed}"""
`;

    try {
        // Ask model for structured output
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || '';
        console.log('👉 Gemini raw text (initial):', text);

        if (!text) {
            return {
                parsed: [],
                items: [],
                explanation: '⚠️ AI returned empty response',
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        }

        // Helper: extract JSON block or raw JSON anywhere
        function extractJsonBlock(s) {
            const m = s.match(/```json\s*([\s\S]*?)```/i);
            if (m) return m[1].trim();
            const m2 = s.match(/(\{[\s\S]*\})/m);
            if (m2) return m2[1].trim();
            return null;
        }

        let jsonText = extractJsonBlock(text);

        // If no JSON found, attempt a strict re-prompt once (coerce model to output JSON)
        if (!jsonText) {
            console.warn('No JSON found in initial response. Re-prompting strictly for JSON once...');
            const strictPrompt = `You are a PNID assistant. The user asked for PNID structured output. OUTPUT ONLY valid JSON inside a single triple-backtick json block. No extra text.

User Input: """${trimmed}"""`;
            try {
                const strictRes = await model.generateContent(strictPrompt);
                const strictText = strictRes?.response?.text?.().trim() || '';
                console.log('👉 Gemini raw text (strict re-prompt):', strictText);
                jsonText = extractJsonBlock(strictText);
            } catch (repErr) {
                console.warn('Strict re-prompt failed:', repErr.message || repErr);
            }
        }

        // If still no JSON — return as chat-style explanation to avoid throwing
        if (!jsonText) {
            return {
                parsed: [],
                items: [],
                explanation: text, // whatever model replied (likely chat or explanation)
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        }

        // Clean any triple-backtick markers if still present
        const cleanedJson = jsonText.replace(/^\s*```json\s*/i, '').replace(/\s*```$/, '').trim();

        // Try parsing JSON safely, otherwise try to split fragments (your original approach)
        let parsed;
        try {
            parsed = JSON.parse(cleanedJson);
        } catch (e) {
            // Attempt to recover concatenated objects
            const objects = cleanedJson
                .split(/}\s*{/)
                .map((part, idx, arr) => {
                    if (idx === 0 && arr.length > 1) return part + '}';
                    if (idx === arr.length - 1 && arr.length > 1) return '{' + part;
                    return '{' + part + '}';
                });
            parsed = objects
                .map((obj) => {
                    try {
                        return JSON.parse(obj);
                    } catch (err) {
                        console.warn('⚠️ Failed parsing fragment (ignored):', err.message, obj.slice?.(0, 200) || obj);
                        return null;
                    }
                })
                .filter(Boolean);
        }

        // --- Extract rawItems & rawConnections (keeps your original logic) ---
        let rawItems = [];
        let rawConnections = [];

        if (parsed?.orders && Array.isArray(parsed.orders)) {
            parsed.orders.forEach((order) => {
                if (order.action && order.action.toLowerCase() === 'draw' && Array.isArray(order.items)) {
                    rawItems.push(...order.items);
                }
                if (order.action && order.action.toLowerCase() === 'connect' && Array.isArray(order.connections)) {
                    rawConnections.push(...order.connections);
                }
            });
        } else if (parsed?.items && Array.isArray(parsed.items)) {
            // handle "items" array at root
            rawItems.push(...parsed.items);
            if (Array.isArray(parsed.connections)) rawConnections.push(...parsed.connections);
        } else if (Array.isArray(parsed)) {
            parsed.forEach((obj) => {
                if (!obj) return;
                if (obj.action && obj.action.toLowerCase() === 'draw' && Array.isArray(obj.items)) {
                    rawItems.push(...obj.items);
                    return;
                }
                if (obj.action && obj.action.toLowerCase() === 'connect' && Array.isArray(obj.connections)) {
                    rawConnections.push(...obj.connections);
                    return;
                }
                if (isLikelyItem(obj)) {
                    rawItems.push(obj);
                    if (Array.isArray(obj.Connections)) rawConnections.push(...obj.Connections);
                } else if (Array.isArray(obj.connections)) {
                    rawConnections.push(...obj.connections);
                } else if (typeof obj === 'string') {
                    rawConnections.push(obj);
                }
            });
        } else if (parsed && typeof parsed === 'object') {
            if (parsed.action && parsed.action.toLowerCase() === 'draw' && Array.isArray(parsed.items)) {
                rawItems.push(...parsed.items);
            } else if (isLikelyItem(parsed)) {
                rawItems.push(parsed);
                if (Array.isArray(parsed.Connections)) rawConnections.push(...parsed.Connections);
            }
            if (Array.isArray(parsed.connections)) rawConnections.push(...parsed.connections);
        }

        // Filter only real-looking items
        rawItems = rawItems.filter(isLikelyItem);

        // --- Normalize items -> itemsArray skeleton (one entry per raw item) ---
        let itemsArray = rawItems.map((item, idx) => ({
            ...item,
            Number: 1, // ignore AI Number
        }));

        // Extract requested counts from input (keeps your regex)
        const requestedCounts = {};
        const regex = /\b(\d+)\s+(\w+)/gi;
        for (const match of trimmed.matchAll(regex)) {
            const count = parseInt(match[1], 10);
            const type = match[2].toLowerCase();
            requestedCounts[type] = count;
        }

        // Ensure sequences contiguous
        itemsArray = itemsArray.map((it, idx) => ({ ...it, Sequence: idx + 1 }));

        // Enforce Draw N (pad only)
        if (inputNumber && inputNumber > 0) {
            if (itemsArray.length < inputNumber) {
                const last = itemsArray[itemsArray.length - 1] || {
                    mode: 'structured',
                    Name: 'Item',
                    Category: 'Equipment',
                    Type: 'Generic',
                    Unit: inputUnit || 0,
                    SubUnit: 0,
                    Sequence: itemsArray.length + 1,
                    Number: 1,
                    SensorType: '',
                    Explanation: 'Auto-cloned PNID item',
                    Connections: [],
                };
                while (itemsArray.length < inputNumber) {
                    const seq = itemsArray.length + 1;
                    const clone = { ...last, Sequence: seq, Name: `${last.Name}_${seq}` };
                    itemsArray.push(clone);
                }
            }
        }

        // Generate deterministic unique codes (and avoid collisions)
        const codeSet = new Set();
        const nameToCode = new Map();

        function baseCodeFor(item, idx) {
            const u = String(item.Unit ?? 0).padStart(1, '0');
            const su = String(item.SubUnit ?? 0).padStart(1, '0');
            const seq = String(item.Sequence ?? idx + 1).padStart(2, '0');
            const num = String(item.Number ?? 1).padStart(2, '0');
            return `${u}${su}${seq}${num}`; // e.g. "000101"
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
            nameToCode.set((it.Name || '').toString().toLowerCase(), code);
            it._generatedCode = code;
        });

        // Normalize connections (your existing logic)
        const normalizedConnections = rawConnections
            .map((c) => {
                if (!c) return null;
                if (typeof c === 'string') {
                    const arrowMatch = c.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
                    const toMatch = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                    const m = arrowMatch || toMatch;
                    if (m) return { from: m[1].trim(), to: m[2].trim() };
                    const csv = c.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
                    if (csv.length === 2) return { from: csv[0], to: csv[1] };
                    return null;
                }
                if (typeof c === 'object') {
                    return {
                        from: (c.from || c.fromName || c.source || '').toString().trim(),
                        to: (c.to || c.toName || c.target || c.toId || '').toString().trim(),
                    };
                }
                return null;
            })
            .filter(Boolean);

        // Resolve connections to generated codes
        const connectionResolved = normalizedConnections.map((c) => ({
            from: nameToCode.get((c.from || '').toLowerCase()) || c.from,
            to: nameToCode.get((c.to || '').toLowerCase()) || c.to,
        }));

        // Attach resolved connections to items (by _generatedCode)
        itemsArray.forEach((item) => {
            const itemCode = item._generatedCode;
            item.Connections = connectionResolved.filter((c) => c.from === itemCode).map((c) => c.to);
        });

        // Auto-connect sequentially if user asked "connect" and no explicit connections
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
        const finalParsed = itemsArray.map((it /*, idx */) => {
            const out = { ...it };
            out.Code = it._generatedCode;
            delete out._generatedCode;
            return out;
        });

        // Merge for chat summary (same as original)
        const mergedForChat = [];
        const typeMap = new Map();
        finalParsed.forEach((item) => {
            const type = item.Type || 'Generic';
            if (typeMap.has(type)) {
                const existing = typeMap.get(type);
                existing._count = (existing._count || 1) + 1;
                existing.Connections.push(...(item.Connections || []));
            } else {
                typeMap.set(type, { ...item, Connections: [...(item.Connections || [])], _count: 1 });
            }
        });
        typeMap.forEach((item) => mergedForChat.push({ ...item, Number: 1 }));

        // Return structured result
        return {
            parsed: finalParsed,
            items: finalParsed,
            connections: connectionResolved,
            connectionResolved,
            explanation: mergedForChat.map((i) => `${i.Type} x${i._count}`).join(' | '),
            mode: 'structured',
        };
    } catch (err) {
        console.error('❌ parseItemLogic failed:', err);
        return {
            parsed: [],
            items: [],
            explanation: '⚠️ AI processing failed: ' + (err.message || 'Unknown error'),
            mode: 'chat',
            connection: null,
            connectionResolved: [],
            connections: [],
        };
    }
}
