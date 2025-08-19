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
    // Matches: "Connect U123 to U456"
    const regex = /connect\s+(\S+)\s+to\s+(\S+)/i;
    const match = text.match(regex);
    if (!match) return null;
    return {
        sourceCode: match[1],
        targetCode: match[2]
    };
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

        // ----------------------
        // AI parsing (your existing prompt code)
        // ----------------------
        const prompt = `
You are a process engineer assistant.
Extract structured data from the text.
Return a short natural explanation paragraph and JSON.

- JSON keys required: Name, Code, Category, Type, Number, Unit, SubUnit
- Code: always starts with 'U' + digits
- Number: how many items
- Category: one of [Equipment, Instrument, Inline Valve, Pipe, Electrical]
- Detect if multiple items are requested.
- Detect if a connection between items is requested.
- Explanation: give a single paragraph describing what should be drawn, including connections.

Example:
Text: "Draw 2 Equipment Tanks Unit A Subunit 1 and connect them."
Explanation: "The text requests two Equipment Tanks in Unit A, Subunit 1. They should be drawn and connected to indicate flow."
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

        // ----------------------
        // Fallback regex parsing (your existing code)
        // ----------------------
        if (!parsed) {
            const codeMatches = description.match(/\bU\d{3,}\b/g) || [];

            if (codeMatches.length > 0) {
                // ... your existing fallback logic for multiple codes
                const code = codeMatches[0];
                const words = description.trim().split(/\s+/).filter(Boolean);

                let Category = "";
                for (const c of categoriesList) {
                    if (description.toLowerCase().includes(c.toLowerCase())) {
                        Category = c;
                        break;
                    }
                }

                const Type = words.filter(
                    w => !codeMatches.includes(w) && w.toLowerCase() !== Category.toLowerCase()
                ).pop() || "Generic";

                const Name = words.filter(w => w !== code && w !== Type && w !== Category).join(" ") || Type;

                // ← Add Unit/SubUnit extraction here
                let Unit = "";
                let SubUnit = "";
                const unitMatch = description.match(/unit\s+([^\s]+)/i);
                if (unitMatch) Unit = unitMatch[1];
                const subUnitMatch = description.match(/subunit\s+([^\s]+)/i);
                if (subUnitMatch) SubUnit = subUnitMatch[1];

                parsed = { Name, Code: code, Category, Type, Number: 1, Unit, SubUnit };
                parsed._otherCodes = codeMatches.slice(1);
                explanation = `I guessed this looks like ${codeMatches.length} item(s) based on your description.`;
            }
            else {
                // ... fallback for single code
                const codeMatch = description.match(/\bU\d{3,}\b/);
                const Code = codeMatch ? codeMatch[0] : "";
                const words = description.trim().split(/\s+/).filter(Boolean);
                const Name = Code || words[0] || "";

                let Category = "";
                for (const c of categoriesList) {
                    if (description.toLowerCase().includes(c.toLowerCase())) {
                        Category = c;
                        break;
                    }
                }

                const Type = words.filter(
                    w => w.toLowerCase() !== Name.toLowerCase() && w.toLowerCase() !== Category.toLowerCase()
                ).pop() || "";

                // ← Add Unit/SubUnit extraction here as well
                let Unit = "";
                let SubUnit = "";
                const unitMatch = description.match(/unit\s+([^\s]+)/i);
                if (unitMatch) Unit = unitMatch[1];
                const subUnitMatch = description.match(/subunit\s+([^\s]+)/i);
                if (subUnitMatch) SubUnit = subUnitMatch[1];

                parsed = { Name, Code, Category, Type, Number: 1, Unit, SubUnit };
                explanation = `I guessed this looks like 1 ${Category || "process item"} named ${Code || Name} of type ${Type}.`;
            }
        }


        // ----------------------
        // Parse connection (your existing helper)
        // ----------------------
        const connection = parseConnection(description);

        // ✅ FINAL RESPONSE
        return res.json({ explanation, parsed, connection });
    } catch (err) {
        console.error("API handler failed:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
