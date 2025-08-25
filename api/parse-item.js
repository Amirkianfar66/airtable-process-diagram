// /api/parse-item.js
// Handles conversational AI chat and structured PNID commands

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Helper: parse connections (optional)
function parseConnection(text) {
    const regex = /connect\s+(\S+)\s+to\s+(\S+)/i;
    const match = text.match(regex);
    if (!match) return null;
    return { sourceCode: match[1], targetCode: match[2] };
}

// Helper: pick type from description
function pickType(description, fallbackCategory) {
    const TYPE_KEYWORDS = ['filter', 'tank', 'pump', 'valve', 'heater', 'cooler', 'compressor', 'column', 'vessel', 'reactor', 'mixer', 'blower', 'chiller', 'exchanger', 'condenser', 'separator', 'drum', 'silo', 'sensor', 'transmitter', 'strainer', 'nozzle', 'pipe'];
    const STOPWORDS = new Set(['draw', 'generate', 'pnid', 'and', 'to', 'the', 'a', 'an', 'of', 'for', 'with', 'on', 'in', 'by', 'then', 'connect', 'connected', 'connecting', 'them', 'it', 'this', 'that', (fallbackCategory || '').toLowerCase()]);

    const kwRegex = new RegExp(`\\b(${TYPE_KEYWORDS.join('|')})s?\\b`, 'gi');
    const matches = [...(description || '').matchAll(kwRegex)];
    if (matches.length) {
        const word = matches[matches.length - 1][1];
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    const words = (description || '').split(/\s+/).filter(Boolean);
    for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i].replace(/[^a-z0-9]/gi, '');
        if (!w) continue;
        if (/^U\d{3,}$/i.test(w)) continue;
        if (STOPWORDS.has(w.toLowerCase())) continue;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    return 'Generic';
}

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { description, categories } = req.body;
        if (!description) return res.status(400).json({ error: 'Missing description' });

        const categoriesList = Array.isArray(categories) && categories.length
            ? categories
            : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

        const trimmed = description.trim();

        // 1️⃣ Conversational check
        const conversationalRegex = /^(hi|hello|hey|how are you|what is|please explain)/i;
        if (conversationalRegex.test(trimmed)) {
            return res.json({
                parsed: {},
                explanation: "Hi there! I'm your AI assistant. How can I help with your process diagram?",
                mode: "chat",
                connection: null
            });
        }

        // 2️⃣ PNID structured prompt
        const prompt = `
You are a PNID assistant.
Extract structured data from the text if it's a PNID command.
Return JSON ONLY with fields: Name, Code, Category, Type, Number, Unit, SubUnit, Sequence, SensorType, Explanation, Connections.
Input: """${trimmed}"""
        `;

        let parsed = null;
        let explanation = "";

        try {
            const result = await model.generateContent(prompt);
            const text = result?.response?.text()?.trim() || "";

            try {
                parsed = JSON.parse(text);
                explanation = parsed.Explanation || "Parsed structured item";
            } catch {
                // fallback to regex parsing if AI didn't return JSON
                const codeMatches = trimmed.match(/\bU\d{3,}\b/g) || [];
                const parts = trimmed.split(/\band\b/i).map(p => p.trim()).filter(Boolean);
                const items = [];

                parts.forEach((part, idx) => {
                    const Type = pickType(part);
                    const Category = categoriesList.find(c => part.toLowerCase().includes(c.toLowerCase())) || "Equipment";
                    const Name = Type;
                    const Code = codeMatches[idx] || `U${(idx + 1).toString().padStart(3, '0')}`;

                    let Unit = "", SubUnit = "";
                    const unitMatch = part.match(/unit\s+([^\s]+)/i);
                    if (unitMatch) Unit = unitMatch[1];
                    const subUnitMatch = part.match(/subunit\s+([^\s]+)/i);
                    if (subUnitMatch) SubUnit = subUnitMatch[1];

                    items.push({ Name, Code, Category, Type, Number: 1, Unit, SubUnit });
                });

                parsed = items.length === 1 ? items[0] : items;
                explanation = `Detected ${items.length} item(s) from description.`;
            }
        } catch (err) {
            console.error("Error calling AI:", err);
            parsed = {};
            explanation = "⚠️ AI processing failed, could not parse item.";
        }

        const connection = parseConnection(trimmed);
        return res.json({ parsed, explanation, mode: "structured", connection });

    } catch (err) {
        console.error("parse-item API error:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
