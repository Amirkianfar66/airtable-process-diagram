import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ----------------------
// Helper functions
// ----------------------
function extractJSON(text) {
    if (!text) return null;
    try { return JSON.parse(text); }
    catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { return null; }
        }
        return null;
    }
}

function parseConnection(text) {
    const regex = /connect\s+(\S+)\s+to\s+(\S+)/i;
    const match = text.match(regex);
    if (!match) return null;
    return { sourceCode: match[1], targetCode: match[2] };
}

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

// ----------------------
// API Handler
// ----------------------
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const { description, categories } = req.body;
        if (!description) return res.status(400).json({ error: "Missing description" });

        const trimmed = description.trim();
        const conversationalRegex = /\b(hi|hello|hey|good morning|good evening|how are you|what's up|thanks|thank you)\b/i;
        if (conversationalRegex.test(trimmed)) {
            return res.json({
                explanation: `👋 Hi there! ${trimmed}`,
                parsed: {},
                connection: null,
                mode: "chat"
            });
        }

        const categoriesList = Array.isArray(categories) && categories.length
            ? categories
            : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

        let explanation = "";
        let parsed = null;

        const prompt = `
You are a process engineer assistant.
Extract structured data from the text. 
Return a short natural explanation + JSON.

JSON keys required: Name, Code, Category, Type, Number, Unit, SubUnit.
- Code: must always start with 'U' followed by digits if present.
- Number: how many items to generate (default 1 if not given).
- Category: one of [${categoriesList.join(", ")}].
- Unit: the main system/unit this item belongs to (if mentioned).
- SubUnit: the sub-unit or section (if mentioned).

IMPORTANT: Do not output meaningless types like "them" / "it" / verbs. If unclear, use "Generic".

Example format:
Explanation: "Looks like you want 2 equipment tanks named U123 in Unit A, SubUnit 1."
{
  "Name": "Tank",
  "Code": "U123",
  "Category": "Equipment",
  "Type": "Tank",
  "Number": 2,
  "Unit": "Unit A",
  "SubUnit": "SubUnit 1"
}

Text: "${description}"
`;

        try {
            const result = await model.generateContent(prompt);
            const content = result?.response?.text();

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = extractJSON(jsonMatch[0]);
                explanation = content.replace(jsonMatch[0], "").trim();
            } else {
                explanation = content.trim();
            }
        } catch (err) {
            console.error("Gemini parse failed, falling back to regex", err);
        }

        if (!parsed) {
            const codeMatches = description.match(/\bU\d{3,}\b/g) || [];

            // Split description by 'and' to handle multiple different items
            const parts = description.split(/\band\b/i).map(p => p.trim()).filter(Boolean);
            const items = [];

            parts.forEach((part, idx) => {
                const Type = pickType(part);
                const Category = categoriesList.find(c => part.toLowerCase().includes(c.toLowerCase())) || "Equipment";
                const Name = Type;
                const Code = codeMatches[idx] || `U${(idx + 1).toString().padStart(3, '0')}`;

                let Unit = "";
                let SubUnit = "";
                const unitMatch = part.match(/unit\s+([^\s]+)/i);
                if (unitMatch) Unit = unitMatch[1];
                const subUnitMatch = part.match(/subunit\s+([^\s]+)/i);
                if (subUnitMatch) SubUnit = subUnitMatch[1];

                items.push({ Name, Code, Category, Type, Number: 1, Unit, SubUnit });
            });

            parsed = items.length === 1 ? items[0] : items;
            explanation = `Detected ${items.length} item(s) from description.`;
        }

        const connection = parseConnection(description);
        return res.json({ explanation, parsed, connection, mode: "structured" });
    } catch (err) {
        console.error("API handler failed:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}