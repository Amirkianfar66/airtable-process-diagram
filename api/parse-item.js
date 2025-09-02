// File: /api/parse-item.js
// =============================
import { GoogleGenerativeAI } from '@google/generative-ai';
import examples from './gemini_pid_dataset.json'; // ✅ Local few-shot dataset

console.log('Loaded gemini examples count:', examples?.length || 0);

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

// Reserved action commands (single declaration)
const ACTION_COMMANDS = ['Generate PNID', 'Export', 'Clear', 'Save'];

// Helper: decide whether a parsed object looks like a PNID item
function isLikelyItem(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const hasName = !!(obj.Name || obj.name);
    const hasCategory = !!(obj.Category || obj.category);
    const hasType = !!(obj.Type || obj.type);
    const looksLikeAction = !!(obj.action || obj.actionType || (obj.mode && typeof obj.mode === 'string' && obj.mode.toLowerCase() === 'action'));
    const conns = obj.Connections || obj.connections || null;
    const isOnlyConnections = !!(conns && Object.keys(obj).length === 1);
    return (hasName || hasCategory || hasType) && !looksLikeAction && !isOnlyConnections;
}

// parse a connection-string into an array of ordered {from,to} pairs
function parseConnectionStringToPairs(str) {
    if (!str || typeof str !== 'string') return [];

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
    if (m) return [{ from: m[1].trim(), to: m[2].trim() }];

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
        const u = String(item.Unit ?? 0).padStart(1, '0');
        const su = String(item.SubUnit ?? 0).padStart(1, '0');
        const seq = String(item.Sequence ?? (idx + 1)).padStart(2, '0');
        return `${u}${su}${seq}`; // Number intentionally not part of code
    }

    function normalizeKey(s) {
        if (!s) return '';
        const str = String(s).trim().toLowerCase();
        const compact = str.replace(/[_\s,-]+/g, '');
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
        it._baseCode = base;

        const rawName = (it.Name || it.name || it.Type || '').toString().trim();
        const rawLower = rawName.toLowerCase();
        const n1 = normalizeKey(rawName);
        const n2 = rawLower.replace(/\s+/g, '_');

        if (n1) nameToCode.set(n1, code);
        if (n2) nameToCode.set(n2, code);
        if (rawLower) altNameLookup.set(rawLower, code);

        // also map code itself for direct lookups
        nameToCode.set(String(code), code);
        altNameLookup.set(String(code), code);
    });

    return { nameToCode, altNameLookup };
}

// --- Helper: attempt to extract JSON block or an inline JSON object ---
function extractJsonBlockFromText(s) {
    if (!s || typeof s !== 'string') return null;
    // first try ```json blocks
    const fenced = s.match(/```json\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    // then try any {...} first object
    const inline = s.match(/(\{[\s\S]*\})/m);
    if (inline) return inline[1].trim();
    // otherwise, try to remove stray backticks and return cleaned string
    const cleaned = cleanAIJson(s);
    if (cleaned) return cleaned;
    return null;
}

// Core parsing logic — upgraded: default chat, PNID-only structured JSON
export async function parseItemLogic(description) {
    const trimmed = (description || '').toString().trim();

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

    // === Action commands ===
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
    const PNID_COMMAND_START = /^\s*(draw|connect|add|generate|pnid|pnid:)/i;
    const PNID_KEYWORDS = /\b(draw|connect|pump|valve|pipe|instrument|fitting|tank|equipment|flange|p&id|p&ids|pnid|p n i d|sensor|controller|pump\d*|unit\s*\d+|subunit|sequence|connect them|connect to)\b/i;

    const likelyStructured = PNID_COMMAND_START.test(trimmed) || PNID_KEYWORDS.test(trimmed);

    // If not structured -> chat
    if (!likelyStructured) {
        try {
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
            return {
                parsed: [],
                items: [],
                explanation: "Hi — I couldn't contact the assistant for a reply. Try asking your PNID or general question again.",
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        }
    }

    // === Structured PNID path ===
    try {
        // Extract Unit and Draw count
        const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
        let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
        if (Number.isNaN(inputUnit)) inputUnit = 0;

        const numberMatch = trimmed.match(/Draw\s+(\d+)\s*/i);
        const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

        console.log('parseItemLogic: using', examples?.length || 0, 'few-shot examples');
        const approxPromptLen = (examples || []).reduce((acc, e) => acc + JSON.stringify(e).length, 0);
        console.log('parseItemLogic: examples JSON roughly', Math.round(approxPromptLen / 1000), 'KB');

        // Build few-shot batches (safe if examples missing)
        const BATCH_SIZE = 10;
        const batches = [];
        const ex = Array.isArray(examples) ? examples : [];
        for (let i = 0; i < ex.length; i += BATCH_SIZE) {
            const batch = ex
                .slice(i, i + BATCH_SIZE)
                .map((e) => `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`)
                .join('\n\n');
            batches.push(batch);
        }
        const fewShots = batches.join('\n\n');

        // Build structured prompt
        const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:
1) Structured PNID mode:
- If the user requests drawing/connecting/adding PNID items, RETURN ONLY a single VALID JSON object wrapped in a \`\`\`json ... \`\`\` block.
- Fields for each item: Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.
- Use "" for empty text fields, 0 for Unit/SubUnit defaults, 1 for Sequence/Number defaults, and [] for Connections.

2) Chat mode:
- If the input is general chat, respond with plain text only (no JSON, no code blocks).

Few-shot examples:
${fewShots}

User Input: """${trimmed}"""
`;

        const result = await model.generateContent(prompt);
        const text = (result?.response?.text?.().trim()) || '';
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

        // Extract JSON block
        let jsonText = extractJsonBlockFromText(text);

        // If not found, re-prompt strictly once
        if (!jsonText) {
            console.warn('No JSON found in initial response. Re-prompting strictly for JSON once...');
            const strictPrompt = `You are a PNID assistant. The user asked for PNID structured output. OUTPUT ONLY valid JSON inside a single triple-backtick json block. No extra text.

User Input: """${trimmed}"""`;
            try {
                const strictRes = await model.generateContent(strictPrompt);
                const strictText = (strictRes?.response?.text?.().trim()) || '';
                console.log('👉 Gemini raw text (strict re-prompt):', strictText);
                jsonText = extractJsonBlockFromText(strictText);
            } catch (repErr) {
                console.warn('Strict re-prompt failed:', repErr?.message || repErr);
            }
        }

        if (!jsonText) {
            // fallback to returning the raw text as explanation (safe)
            return {
                parsed: [],
                items: [],
                explanation: text,
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        }

        // Clean JSON text
        const cleanedJson = cleanAIJson(jsonText);

        // Parse JSON with robust fallbacks
        let parsed;
        try {
            parsed = JSON.parse(cleanedJson);
        } catch (e) {
            // Attempt to recover concatenated objects
            const fragments = cleanedJson.split(/}\s*{/).map((part, idx, arr) => {
                if (idx === 0 && arr.length > 1) return part + '}';
                if (idx === arr.length - 1 && arr.length > 1) return '{' + part;
                return '{' + part + '}';
            });
            parsed = fragments
                .map((frag) => {
                    try {
                        return JSON.parse(frag);
                    } catch (err) {
                        console.warn('⚠️ Ignored fragment while parsing AI JSON:', err.message, frag.slice?.(0, 200) || frag);
                        return null;
                    }
                })
                .filter(Boolean);
            if (Array.isArray(parsed) && parsed.length === 1) parsed = parsed[0];
        }

        // --- Extract rawItems & rawConnections ---
        let rawItems = [];
        let rawConnections = [];

        if (parsed?.orders && Array.isArray(parsed.orders)) {
            parsed.orders.forEach((order) => {
                const act = (order.action || '').toString().toLowerCase();
                if (act === 'draw' && Array.isArray(order.items)) rawItems.push(...order.items);
                if ((act === 'connect' || act === 'connection') && Array.isArray(order.connections)) rawConnections.push(...order.connections);
            });
        } else if (parsed?.items && Array.isArray(parsed.items)) {
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
                    return;
                }
                if (Array.isArray(obj.connections)) {
                    rawConnections.push(...obj.connections);
                    return;
                }
                if (typeof obj === 'string') {
                    rawConnections.push(obj);
                    return;
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

        // Keep only real-looking items
        rawItems = rawItems.filter(isLikelyItem);

        // Build itemsArray skeleton (one entry per raw item)
        let itemsArray = rawItems.map((item, idx) => ({
            mode: 'structured',
            Name: (item.Name || item.name || item.Type || item.type || `Item${idx + 1}`).toString().trim(),
            Category: item.Category || item.category || 'Equipment',
            Type: item.Type || item.type || (item.Name || 'Generic'),
            Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit || 0,
            SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
            Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : null,
            Number: item.Number !== undefined ? Math.max(1, parseInt(item.Number, 10)) : 1,
            Count: item.Count !== undefined ? Math.max(1, parseInt(item.Count, 10)) : undefined,
            SensorType: item.SensorType || item.sensorType || '',
            Explanation: item.Explanation || item.explanation || `Added ${item.Type || 'item'}`,
            Connections: []
        }));

        // Expand items by their Number / Count field (if the model returned >1)
        {
            const expanded = [];
            let globalSeq = 1;
            for (const it of itemsArray) {
                const qty = Math.max(1, it.Number ?? it.Count ?? 1);
                for (let k = 0; k < qty; k++) {
                    const clone = { ...it };
                    clone.Sequence = globalSeq;
                    // keep base name identical; instance numeric suffixes are not forced here
                    clone.Name = qty > 1 ? `${it.Name}` : it.Name;
                    clone.Number = 1;
                    expanded.push(clone);
                    globalSeq++;
                }
            }
            itemsArray = expanded;
        }

        // Ensure contiguous sequences 1..N
        itemsArray = itemsArray.map((it, idx) => ({ ...it, Sequence: idx + 1 }));

        // Enforce user Draw N if present (pad only)
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
                    Connections: []
                };
                while (itemsArray.length < inputNumber) {
                    const seq = itemsArray.length + 1;
                    const clone = { ...last, Sequence: seq, Name: `${last.Name}_${seq}` };
                    itemsArray.push(clone);
                }
            }
        }

        // Build code lookups
        const { nameToCode, altNameLookup } = buildCodeLookups(itemsArray);

        // Normalize rawConnections into objects {from, to}
        const normalizedConnections = [];
        rawConnections.forEach((c) => {
            if (!c) return;
            if (typeof c === 'string') {
                const pairs = parseConnectionStringToPairs(c);
                if (pairs.length) {
                    normalizedConnections.push(...pairs);
                    return;
                }
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
            if (typeof c === 'object') {
                normalizedConnections.push({
                    from: (c.from || c.fromName || c.source || '').toString().trim(),
                    to: (c.to || c.toName || c.target || c.toId || '').toString().trim()
                });
            }
        });

        // Resolve connection endpoints to generated codes using multiple candidate keys
        function candidateKeysFor(raw) {
            const r = (raw || '').toString().trim();
            return [
                r ? r.toLowerCase() : '',
                r ? r.replace(/\s+/g, '_').toLowerCase() : '',
                r ? r.replace(/\s+/g, '').toLowerCase() : '',
                (() => {
                    const m = r.match(/^([a-zA-Z]+)0*(\d+)$/);
                    return m ? `${m[1].toLowerCase()}${Number(m[2])}` : '';
                })()
            ].filter(Boolean);
        }

        const connectionResolved = normalizedConnections.map((c) => {
            const fromRaw = (c.from || '').toString().trim();
            const toRaw = (c.to || '').toString().trim();

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

        // Attach resolved connections to items (by _generatedCode)
        itemsArray.forEach((item) => {
            const itemCode = item._generatedCode;
            item.Connections = connectionResolved.filter((c) => String(c.from) === String(itemCode)).map((c) => c.to);
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

        // Build final parsed objects (expose Code, remove internal fields)
        const finalParsed = itemsArray.map((it) => {
            const out = { ...it };
            out.Code = it._generatedCode;
            delete out._generatedCode;
            delete out._baseCode;
            return out;
        });

        // Prepare chat-friendly summary
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
        const mergedForChat = [];
        typeMap.forEach((item) => mergedForChat.push({ ...item, Number: 1 }));

        // Return structured result (array form). Frontend can accept parsed as array or object.
        return {
            parsed: finalParsed,
            items: finalParsed,
            connections: connectionResolved,
            connectionResolved,
            explanation: mergedForChat.map((i) => `${i.Type} x${i._count}`).join(' | ') || 'Added PNID item(s)',
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

// Default API handler (Next.js / Vercel style)
export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

        const { description } = req.body || {};
        if (!description) return res.status(400).json({ error: 'Missing description' });

        const aiResult = await parseItemLogic(description);
        return res.status(200).json(aiResult);
    } catch (err) {
        console.error('/api/parse-item error:', err);
        return res.status(500).json({ error: 'Server error', details: err?.message || String(err) });
    }
}
