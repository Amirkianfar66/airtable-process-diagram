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
export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // Action command check
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

    // Extract Unit and Draw count
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    if (Number.isNaN(inputUnit)) inputUnit = 0;

    const numberMatch = trimmed.match(/Draw\s+(\d+)\s+/i);
    const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

    console.log('parseItemLogic: using', examples.length, 'few-shot examples');
    const approxPromptLen = examples.reduce((acc, e) => acc + JSON.stringify(e).length, 0);
    console.log('parseItemLogic: examples JSON roughly', Math.round(approxPromptLen / 1000), 'KB');

    // Build few-shot prompt (batched)
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
        const batch = examples
            .slice(i, i + BATCH_SIZE)
            .map((e) => {
                return `Input: "${e.input}"\nOutput: ${JSON.stringify(e.output)}`;
            })
            .join('\n\n');
        batches.push(batch);
    }
    const fewShots = batches.join('\n\n');

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

### Few-shot examples (all):
${fewShots}

User Input: """${trimmed}"""
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || '';
        console.log('👉 Gemini raw text:', text);

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

            // Extract rawItems & rawConnections safely
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
                // ✅ NEW: handle "items" array at root
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

            // --- AFTER rawItems is built and filtered ---
            // Normalize single item -> itemsArray skeleton (one entry per raw item)
            let itemsArray = rawItems.map((item, idx) => ({
                mode: 'structured',
                // prefer Name, else Type, else Item{n}
                Name: (item.Name || item.name || item.Type || item.type || `Item${idx + 1}`).toString().trim(),
                Category: item.Category || item.category || 'Equipment',
                Type: item.Type || item.type || 'Generic',
                Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit || 0,
                SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
                Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : null,
                Number: item.Number !== undefined ? Math.max(1, parseInt(item.Number, 10)) : 1,
                SensorType: item.SensorType || item.sensorType || '',
                Explanation: item.Explanation || item.explanation || `Added ${item.Type || 'item'}`,
                Connections: Array.isArray(item.Connections) ? [...item.Connections] : [],
            }));

            // --- EXPAND items BY their Number field ---
            {
                const expanded = [];
                let globalSeq = 1;
                for (const it of itemsArray) {
                    const qty = Math.max(1, it.Number || 1);
                    for (let k = 0; k < qty; k++) {
                        const clone = { ...it };
                        clone.Sequence = globalSeq; // unique
                        clone.Name = qty > 1 ? `${it.Name}_${k + 1}` : it.Name;
                        clone.Number = 1; // each clone represents a single item now
                        expanded.push(clone);
                        globalSeq++;
                    }
                }
                itemsArray = expanded;
            }

            // --- ENSURE sequences are contiguous & deterministic ---
            itemsArray = itemsArray.map((it, idx) => ({ ...it, Sequence: idx + 1 }));

            // --- NOW enforce the user's Draw N if present (pad only, never trim) ---
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
                nameToCode.set(it.Name.toLowerCase(), code);
                it._generatedCode = code;
            });

            // Normalize connections
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
            const finalParsed = itemsArray.map((it) => {
                const out = { ...it };
                out.Code = it._generatedCode;
                delete out._generatedCode;
                return out;
            });

            if (finalParsed.length !== inputNumber) {
                console.warn('🛠️ parseItemLogic: finalParsed length mismatch', {
                    requested: inputNumber,
                    got: finalParsed.length,
                    rawParsedPreview: Array.isArray(parsed) ? parsed.slice(0, 5) : parsed,
                });
            }

            const explanation = finalParsed.length > 0
                ? finalParsed.map((it) => it.Explanation || `Added ${it.Name}`).join(' | ')
                : 'Added PNID item(s)';

            

            finalParsed.forEach(item => {
                const type = item.Type || 'Generic';
                if (typeMap.has(type)) {
                    const existing = typeMap.get(type);
                    existing._count = (existing._count || 1) + 1; // count total per Type
                    existing.Connections.push(...(item.Connections || []));
                } else {
                    typeMap.set(type, { ...item, Connections: [...(item.Connections || [])], _count: item.Number || 1 });
                }
                const mergedByType = [];
                typeMap.forEach(item => {
                    mergedByType.push({
                        ...item,
                        Number: 1 // ✅ always 1 per returned item
                    });
                });


            mergedByType.push(...typeMap.values());

            // Now expose merged items
            return {
                parsed: mergedByType,
                items: mergedByType,
                connections: connectionResolved,
                connectionResolved,
                explanation,
                mode: 'structured',
            };

            console.log('parseItemLogic → parsed:', finalParsed);
            console.log('parseItemLogic → connectionResolved:', connectionResolved);

            return {
                parsed: finalParsed,
                items: finalParsed, // ✅ expose as items[] too for consumers
                connections: connectionResolved,
                connectionResolved,
                explanation,
                mode: 'structured',
            };
        } catch (err) {
            console.warn('⚠️ Not JSON, treating as chat:', err.message);
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

// Default API handler
export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

        const { description } = req.body;
        if (!description) return res.status(400).json({ error: 'Missing description' });

        const aiResult = await parseItemLogic(description);
        res.status(200).json(aiResult);
    } catch (err) {
        console.error('/api/parse-item error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
}
