// File: /api/parse-item.js
// =============================
import { GoogleGenerativeAI } from '@google/generative-ai';
import examples from './gemini_pid_dataset.json';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
}

const ACTION_COMMANDS = ['Generate PNID', 'Export', 'Clear', 'Save'];

function isLikelyItem(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const hasName = !!(obj.Name || obj.name);
    const hasCategory = !!(obj.Category || obj.category);
    const hasType = !!(obj.Type || obj.type);
    const looksLikeAction = !!(obj.action || obj.actionType);
    const isOnlyConnections = obj.connections && Object.keys(obj).length === 1;
    return (hasName || hasCategory || hasType) && !looksLikeAction && !isOnlyConnections;
}

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // --- check action commands ---
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

    // Extract Unit and Draw count if present
    const unitMatch = trimmed.match(/Unit\s+(\d+)/i);
    let inputUnit = unitMatch ? parseInt(unitMatch[1], 10) : 0;
    if (Number.isNaN(inputUnit)) inputUnit = 0;

    const numberMatch = trimmed.match(/Draw\s+(\d+)/i);
    const inputNumber = numberMatch ? Math.max(1, parseInt(numberMatch[1], 10)) : 1;

    // --- Build few-shot prompt ---
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

    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- All fields must be non-null. Use:
    - "" for text fields
    - 0 for Unit/SubUnit
    - 1 for Sequence/Number
    - [] for Connections
- Wrap JSON in a \`\`\`json ... \`\`\` block.
- Do NOT wrap chat mode responses in JSON.

2. Chat mode
- Output plain text only and set "mode": "chat".

Few-shot examples:
${fewShots}

User Input: """${trimmed}"""
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || '';
        if (!text) return { parsed: [], items: [], explanation: '⚠️ AI returned empty response', mode: 'chat', connectionResolved: [], connections: [] };

        const cleaned = cleanAIJson(text);
        let parsed;

        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            // Handle concatenated JSON fragments
            const objects = cleaned
                .split(/}\s*{/)
                .map((part, idx, arr) => {
                    if (idx === 0 && arr.length > 1) return part + '}';
                    if (idx === arr.length - 1 && arr.length > 1) return '{' + part;
                    return '{' + part + '}';
                });
            parsed = objects.map((obj) => { try { return JSON.parse(obj); } catch { return null } }).filter(Boolean);
        }

        // --- Extract items & connections ---
        let rawItems = [];
        let rawConnections = [];
        if (parsed?.items && Array.isArray(parsed.items)) {
            rawItems.push(...parsed.items);
            if (Array.isArray(parsed.connections)) rawConnections.push(...parsed.connections);
        } else if (Array.isArray(parsed)) {
            parsed.forEach(obj => { if (isLikelyItem(obj)) rawItems.push(obj); });
        } else if (isLikelyItem(parsed)) rawItems.push(parsed);

        rawItems = rawItems.filter(isLikelyItem);

        // --- Build items array, ensure Number = 1 per item ---
        let itemsArray = rawItems.map((item, idx) => ({
            mode: 'structured',
            Name: (item.Name || item.name || item.Type || item.type || `Item${idx + 1}`).toString().trim(),
            Category: item.Category || item.category || 'Equipment',
            Type: item.Type || item.type || 'Generic',
            Unit: item.Unit !== undefined ? parseInt(item.Unit, 10) : inputUnit || 0,
            SubUnit: item.SubUnit !== undefined ? parseInt(item.SubUnit, 10) : 0,
            Sequence: item.Sequence !== undefined ? parseInt(item.Sequence, 10) : idx + 1,
            Number: 1, // ✅ always 1
            SensorType: item.SensorType || item.sensorType || '',
            Explanation: item.Explanation || item.explanation || `Added ${item.Type || 'item'}`,
            Connections: Array.isArray(item.Connections) ? [...item.Connections] : [],
        }));

        // --- Merge by Type, but keep _count for chat ---
        const mergedByType = [];
        const typeMap = new Map();
        itemsArray.forEach(item => {
            const type = item.Type || 'Generic';
            if (typeMap.has(type)) {
                const existing = typeMap.get(type);
                existing._count = (existing._count || 1) + 1;
                existing.Connections.push(...(item.Connections || []));
            } else {
                typeMap.set(type, { ...item, _count: 1 });
            }
        });
        mergedByType.push(...typeMap.values());

        // --- Normalize connections ---
        const normalizedConnections = rawConnections
            .map(c => typeof c === 'string' ? null : { from: c.from || '', to: c.to || '' })
            .filter(Boolean);

        // --- Final exposure ---
        const explanation = mergedByType.length > 0 ? mergedByType.map(it => it.Explanation).join(' | ') : 'Added PNID item(s)';
        return {
            parsed: mergedByType,
            items: mergedByType,
            connections: normalizedConnections,
            connectionResolved: normalizedConnections,
            explanation,
            mode: 'structured',
        };

    } catch (err) {
        console.error('⚠️ parseItemLogic failed:', err);
        return { parsed: [], items: [], explanation: '⚠️ AI processing failed', mode: 'chat', connectionResolved: [], connections: [] };
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
