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
        const prompt = `...`; // keep exactly as in your current code

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

                parsed = { Name, Code: code, Category, Type, Number: 1 };
                parsed._otherCodes = codeMatches.slice(1);
                explanation = `I guessed this looks like ${codeMatches.length} item(s) based on your description.`;
            } else {
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

                parsed = { Name, Code, Category, Type, Number: 1 };
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
