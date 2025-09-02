// File: /api/parse-item.js
// =============================
import { GoogleGenerativeAI } from '@google/generative-ai';
import examples from './gemini_pid_dataset.json'; // ✅ Local few-shot dataset

console.log('Loaded gemini examples count:', Array.isArray(examples) ? examples.length : 0);

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

const ACTION_COMMANDS = ['Generate PNID', 'Export', 'Clear', 'Save'];

function isLikelyItem(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const hasName = !!(obj.Name || obj.name);
    const hasCategory = !!(obj.Category || obj.category);
    const hasType = !!(obj.Type || obj.type);
    const looksLikeAction = !!(obj.action || obj.actionType);
    const conns = obj.Connections || obj.connections || null;
    const isOnlyConnections = !!(conns && Object.keys(obj).length === 1);
    return (hasName || hasCategory || hasType) && !looksLikeAction && !isOnlyConnections;
}

function parseConnectionStringToPairs(str) {
    if (!str || typeof str !== 'string') return [];
    const tokens = str
        .split(/(?:\s*(?:>>|->|→|–>|to|,|;|\band\b|\bthen\b|\band then\b)\s*)+/i)
        .map(t => t.trim())
        .filter(Boolean);
    if (tokens.length >= 2) {
        const pairs = [];
        for (let i = 0; i < tokens.length - 1; i++) pairs.push({ from: tokens[i], to: tokens[i + 1] });
        return pairs;
    }
    const arrowMatch = str.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
    const toMatch = str.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
    const m = arrowMatch || toMatch;
    if (m) return [{ from: m[1].trim(), to: m[2].trim() }];
    const csv = str.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (csv.length === 2) return [{ from: csv[0], to: csv[1] }];
    return [];
}

function buildCodeLookups(itemsArray) {
    const codeSet = new Set();
    const nameToCode = new Map();
    const altNameLookup = new Map();

    function baseCodeFor(item, idx) {
        const u = String(item.Unit ?? 0).padStart(1, '0');
        const su = String(item.SubUnit ?? 0).padStart(1, '0');
        const seq = String(item.Sequence ?? (idx + 1)).padStart(2, '0');
        return `${u}${su}${seq}`;
    }

    function normalizeKey(s) {
        if (!s) return '';
        const str = String(s).trim().toLowerCase();
        return str.replace(/[_\s,-]+/g, '').replace(/([a-zA-Z]+)0+(\d+)$/i, (m, p1, p2) => `${p1}${Number(p2)}`);
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

        nameToCode.set(String(code), code);
        altNameLookup.set(String(code), code);
    });

    return { nameToCode, altNameLookup };
}

function extractJsonBlockFromText(s) {
    if (!s || typeof s !== 'string') return null;
    const fenced = s.match(/```json\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    const inline = s.match(/(\{[\s\S]*\})/m);
    if (inline) return inline[1].trim();
    const cleaned = cleanAIJson(s);
    return cleaned || null;
}

export async function parseItemLogic(description) {
    const trimmed = (description || '').toString().trim();

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

    // action commands
    const actionMatch = ACTION_COMMANDS.find(cmd => cmd.toLowerCase() === trimmed.toLowerCase());
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

    // heuristic intent detection
    const PNID_COMMAND_START = /^\s*(draw|connect|add|generate|pnid|pnid:)/i;
    const PNID_KEYWORDS = /\b(draw|connect|pump|valve|pipe|instrument|fitting|tank|equipment|flange|p&id|pnid|sensor|controller|unit\s*\d+|subunit|sequence)\b/i;
    const likelyStructured = PNID_COMMAND_START.test(trimmed) || PNID_KEYWORDS.test(trimmed);

    if (!likelyStructured) {
        try {
            const chatPrompt = `You are a friendly assistant. Reply conversationally and briefly. Output plain text only.

User: """${trimmed}"""`;
            const chatResult = await model.generateContent(chatPrompt);
            const chatText = (chatResult?.response?.text?.().trim()) || 'Hi — how can I help with PNID?';
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
                explanation: "I'm unable to contact the assistant right now.",
                mode: 'chat',
                connection: null,
                connectionResolved: [],
                connections: [],
            };
        }
    }

    // structured path
    try {
        const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
        let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
        if (Number.isNaN(inputUnit)) inputUnit = 0;
        const numberMatch = trimmed.match(/Draw\s+(\d+)\s*/i);
        const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

        // build few-shots (safe)
        const BATCH_SIZE = 10;
        const ex = Array.isArray(examples) ? examples : [];
        const batches = [];
        for (let i = 0; i < ex.length; i += BATCH_SIZE) {
            const batch = ex.slice(i, i + BATCH_SIZE).map(e => `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`).join('\n\n');
            batches.push(batch);
        }
        const fewShots = batches.join('\n\n');

        const prompt = `
You are a PNID assistant. If user asks to draw/connect PNID items, RETURN ONLY a single VALID JSON object in a \`\`\`json ... \`\`\` block.

Each item should include:
Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.

Defaults: "" for text, 0 for Unit/SubUnit, 1 for Sequence/Number, [] for Connections.

Few-shot examples:
${fewShots}

User Input: """${trimmed}"""
`;
        const result = await model.generateContent(prompt);
        const text = (result?.response?.text?.().trim()) || '';
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

        // extract JSON
        let jsonText = extractJsonBlockFromText(text);
        if (!jsonText) {
            // strict re-prompt once
            const strictPrompt = `OUTPUT ONLY valid JSON inside a single triple-backtick json block. No extra text.

User Input: """${trimmed}"""`;
            try {
                const strictRes = await model.generateContent(strictPrompt);
                const strictText = (strictRes?.response?.text?.().trim()) || '';
                jsonText = extractJsonBlockFromText(strictText);
            } catch (repErr) {
                // continue with fallback
            }
        }
        if (!jsonText) {
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

        const cleaned = cleanAIJson(jsonText);
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (err) {
            // try to recover fragments
            const frags = cleaned.split(/}\s*{/).map((part, idx, arr) => {
                if (idx === 0 && arr.length > 1) return part + '}';
                if (idx === arr.length - 1 && arr.length > 1) return '{' + part;
                return '{' + part + '}';
            });
            parsed = frags.map(f => {
                try { return JSON.parse(f); } catch (e) { return null; }
            }).filter(Boolean);
            if (Array.isArray(parsed) && parsed.length === 1) parsed = parsed[0];
        }

        // collect rawItems and rawConnections (robust)
        let rawItems = [];
        let rawConnections = [];

        if (parsed?.orders && Array.isArray(parsed.orders)) {
            parsed.orders.forEach(order => {
                const act = (order.action || '').toString().toLowerCase();
                if (act === 'draw' && Array.isArray(order.items)) rawItems.push(...order.items);
                if ((act === 'connect' || act === 'connection') && Array.isArray(order.connections)) rawConnections.push(...order.connections);
            });
        } else if (parsed?.items && Array.isArray(parsed.items)) {
            rawItems.push(...parsed.items);
            if (Array.isArray(parsed.connections)) rawConnections.push(...parsed.connections);
        } else if (Array.isArray(parsed)) {
            parsed.forEach(obj => {
                if (!obj) return;
                if (obj.action && obj.action.toLowerCase() === 'draw' && Array.isArray(obj.items)) {
                    rawItems.push(...obj.items); return;
                }
                if (obj.action && obj.action.toLowerCase() === 'connect' && Array.isArray(obj.connections)) {
                    rawConnections.push(...obj.connections); return;
                }
                if (isLikelyItem(obj)) { rawItems.push(obj); if (Array.isArray(obj.Connections)) rawConnections.push(...obj.Connections); return; }
                if (Array.isArray(obj.connections)) rawConnections.push(...obj.connections);
                if (typeof obj === 'string') rawConnections.push(obj);
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

        rawItems = rawItems.filter(isLikelyItem);

        // Build normalized skeletons and aggregate by Type+Unit+SubUnit
        const grouped = new Map(); // key: `${type}|${unit}|${subunit}` => { Type, Unit, SubUnit, Category, Name, Count }
        rawItems.forEach((it, idx) => {
            const Type = it.Type || it.type || (it.Name || 'Generic');
            const Category = it.Category || it.category || 'Equipment';
            const Unit = it.Unit !== undefined ? Number(it.Unit) : inputUnit || 0;
            const SubUnit = it.SubUnit !== undefined ? Number(it.SubUnit) : 0;
            // prefer Number, fallback Count
            const qty = Math.max(1, Number(it.Number ?? it.Count ?? 1));
            const key = `${(Type || '').toString().toLowerCase()}|${Unit}|${SubUnit}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    Type,
                    Category,
                    Unit,
                    SubUnit,
                    Name: Type, // keep Name == Type (user OK with identical names)
                    Count: qty,
                    SensorType: it.SensorType || it.sensorType || '',
                    Explanation: it.Explanation || it.explanation || `Added ${Type}`,
                    Connections: Array.isArray(it.Connections) ? [...it.Connections] : []
                });
            } else {
                const g = grouped.get(key);
                g.Count = (g.Count || 0) + qty;
                if (Array.isArray(it.Connections)) g.Connections.push(...it.Connections);
            }
        });

        // Expand grouped items into itemsArray with per-(Unit|SubUnit) sequence counters
        const itemsArray = [];
        const unitSeq = new Map(); // key `${Unit}|${SubUnit}` -> nextSeq (start at 1)

        for (const [k, group] of grouped.entries()) {
            const { Type, Category, Unit, SubUnit, Count, SensorType, Explanation, Name, Connections } = group;
            const unitKey = `${Unit}|${SubUnit}`;
            if (!unitSeq.has(unitKey)) unitSeq.set(unitKey, 1);
            for (let i = 0; i < (Count || 1); i++) {
                const seq = unitSeq.get(unitKey);
                const item = {
                    mode: 'structured',
                    Name: Name, // keep plain Type (no suffix)
                    Category,
                    Type,
                    Unit,
                    SubUnit,
                    Sequence: seq,
                    Number: 1,
                    SensorType: SensorType || '',
                    Explanation: Explanation || `Added ${Type}`,
                    Connections: Array.isArray(Connections) ? [...Connections] : []
                };
                itemsArray.push(item);
                unitSeq.set(unitKey, seq + 1);
            }
        }

        // If user explicitly asked "Draw N" and nothing else, pad using default item
        if (itemsArray.length === 0 && inputNumber > 0) {
            const last = {
                mode: 'structured',
                Name: 'Item',
                Category: 'Equipment',
                Type: 'Generic',
                Unit: inputUnit || 0,
                SubUnit: 0,
                Sequence: 1,
                Number: 1,
                SensorType: '',
                Explanation: 'Auto-cloned PNID item',
                Connections: []
            };
            for (let i = 0; i < inputNumber; i++) {
                itemsArray.push({ ...last, Sequence: i + 1, Name: `${last.Name}` });
            }
        }

        // Build codes and lookups
        const { nameToCode, altNameLookup } = buildCodeLookups(itemsArray);

        // Normalize rawConnections into {from,to}
        const normalizedConnections = [];
        rawConnections.forEach(c => {
            if (!c) return;
            if (typeof c === 'string') {
                const pairs = parseConnectionStringToPairs(c);
                if (pairs.length) { normalizedConnections.push(...pairs); return; }
                const arrowMatch = c.match(/(.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
                const toMatch = c.match(/(.+?)\s+(?:to|and)\s+(.+)/i);
                const m = arrowMatch || toMatch;
                if (m) { normalizedConnections.push({ from: m[1].trim(), to: m[2].trim() }); return; }
                const csv = c.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                if (csv.length === 2) { normalizedConnections.push({ from: csv[0], to: csv[1] }); return; }
                return;
            }
            if (typeof c === 'object') {
                normalizedConnections.push({
                    from: (c.from || c.fromName || c.source || '').toString().trim(),
                    to: (c.to || c.toName || c.target || c.toId || '').toString().trim()
                });
            }
        });

        // Resolve connections to generated codes
        const connectionResolved = normalizedConnections.map(c => {
            const fromRaw = (c.from || '').toString().trim();
            const toRaw = (c.to || '').toString().trim();
            // candidate keys (several variants)
            const candidates = (raw) => {
                const r = (raw || '').toString().trim();
                return [
                    r.toLowerCase(),
                    r.replace(/\s+/g, '_').toLowerCase(),
                    r.replace(/\s+/g, '').toLowerCase(),
                    (() => {
                        const m = r.match(/^([a-zA-Z]+)0*(\d+)$/);
                        return m ? `${m[1].toLowerCase()}${Number(m[2])}` : '';
                    })()
                ].filter(Boolean);
            };
            let resolvedFrom = null;
            let resolvedTo = null;
            for (const k of candidates(fromRaw)) {
                if (nameToCode.has(k)) { resolvedFrom = nameToCode.get(k); break; }
                if (altNameLookup.has(k)) { resolvedFrom = altNameLookup.get(k); break; }
            }
            for (const k of candidates(toRaw)) {
                if (nameToCode.has(k)) { resolvedTo = nameToCode.get(k); break; }
                if (altNameLookup.has(k)) { resolvedTo = altNameLookup.get(k); break; }
            }
            // fallback numeric suffix heuristic
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
            return { from: resolvedFrom || fromRaw, to: resolvedTo || toRaw };
        });

        // Attach resolved Connections to items by matching _generatedCode
        itemsArray.forEach(item => {
            const code = item._generatedCode;
            item.Connections = connectionResolved.filter(c => String(c.from) === String(code)).map(c => c.to);
        });

        // If user asked connect and no explicit connections, auto-chain per group if multiple in same unit
        const userWantsConnect = /\bconnect\b/i.test(trimmed) || /connect them/i.test(trimmed);
        if (userWantsConnect && connectionResolved.length === 0 && itemsArray.length > 1) {
            // chain items that share the same unit/subunit sequentially
            // build per-unit lists
            const perUnit = new Map();
            itemsArray.forEach(it => {
                const key = `${it.Unit}|${it.SubUnit}`;
                if (!perUnit.has(key)) perUnit.set(key, []);
                perUnit.get(key).push(it);
            });
            for (const group of perUnit.values()) {
                for (let i = 0; i < group.length - 1; i++) {
                    const fromCode = group[i]._generatedCode;
                    const toCode = group[i + 1]._generatedCode;
                    group[i].Connections.push(toCode);
                    connectionResolved.push({ from: fromCode, to: toCode });
                }
            }
        }

        // Build final parsed items (expose Code and drop internals)
        const finalParsed = itemsArray.map(it => {
            const out = { ...it };
            out.Code = it._generatedCode;
            delete out._generatedCode;
            delete out._baseCode;
            return out;
        });

        // Chat-friendly summary
        const typeMap = new Map();
        finalParsed.forEach(item => {
            const type = item.Type || 'Generic';
            if (typeMap.has(type)) {
                const ex = typeMap.get(type);
                ex._count = (ex._count || 1) + 1;
            } else {
                typeMap.set(type, { ...item, _count: 1 });
            }
        });
        const mergedForChat = [];
        typeMap.forEach(it => mergedForChat.push(it));

        return {
            parsed: finalParsed,
            items: finalParsed,
            connections: connectionResolved,
            connectionResolved,
            explanation: mergedForChat.map(i => `${i.Type} x${i._count}`).join(' | ') || 'Added PNID item(s)',
            mode: 'structured'
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

// default API handler
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
