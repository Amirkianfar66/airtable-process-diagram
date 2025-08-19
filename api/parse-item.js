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

function pickType(description) {
    const TYPE_KEYWORDS = ['filter', 'tank', 'pump', 'valve', 'heater', 'cooler', 'compressor', 'column', 'vessel', 'reactor', 'mixer', 'blower', 'chiller', 'exchanger', 'condenser', 'separator', 'drum', 'silo', 'sensor', 'transmitter', 'strainer', 'nozzle', 'pipe'];
    const descLower = description.toLowerCase();
    for (const keyword of TYPE_KEYWORDS) {
        if (descLower.includes(keyword)) return keyword.charAt(0).toUpperCase() + keyword.slice(1);
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

        const categoriesList = Array.isArray(categories) && categories.length
            ? categories
            : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

        let explanation = "";
        let parsed = null;

        const prompt = `You are a process engineer assistant. Extract structured data from the text. Return a short natural explanation + JSON. JSON keys: Name, Code, Category, Type, Number, Unit, SubUnit. Text: "${description}"`;

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
            const parts = description.split(/\band\b/i).map(p => p.trim()).filter(Boolean);
            const items = [];

            parts.forEach((part, idx) => {
                // Extract number if present
                let numMatch = part.match(/(\d+)\s+equipment/i);
                let count = numMatch ? parseInt(numMatch[1], 10) : 1;

                const Type = pickType(part);
                const Category = categoriesList.find(c => part.toLowerCase().includes(c.toLowerCase())) || "Equipment";

                for (let i = 0; i < count; i++) {
                    const Code = codeMatches[idx + i] || `U${(items.length + 1).toString().padStart(3, '0')}`;
                    let Unit = "";
                    let SubUnit = "";
                    const unitMatch = part.match(/unit\s+([^\s]+)/i);
                    if (unitMatch) Unit = unitMatch[1];
                    const subUnitMatch = part.match(/subunit\s+([^\s]+)/i);
                    if (subUnitMatch) SubUnit = subUnitMatch[1];
                    items.push({ Name: Type, Code, Category, Type, Number: 1, Unit, SubUnit });
                }
            });

            parsed = items.length === 1 ? items[0] : items;
            explanation = `Detected ${items.length} item(s) from description.`;
        }

        const connection = parseConnection(description);
        return res.json({ explanation, parsed, connection });
    } catch (err) {
        console.error("API handler failed:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
