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

function parseConnection(text, items) {
    const regex1 = /connect\s+(\w+)\s+to\s+(\w+)/i;
    const regex2 = /(\w+)\s+connect\s+(\w+)/i;
    let match = text.match(regex1);
    if (!match) match = text.match(regex2);
    if (!match) return null;

    const findItemCode = (token) => {
        const item = items?.find(i =>
            i?.Code?.toLowerCase() === token.toLowerCase() ||
            i?.Name?.toLowerCase() === token.toLowerCase() ||
            i?.Type?.toLowerCase() === token.toLowerCase()
        );
        return item ? item.Code : token;
    };

    return { sourceCode: findItemCode(match[1]), targetCode: findItemCode(match[2]) };
}

function generateCode(idx) {
    return `U${(idx + 1).toString().padStart(3, "0")}`;
}

// Ensure every item has a valid Code
function normalizeItems(items) {
    return items.map((item, idx) => {
        if (!item.Code || typeof item.Code !== "string") {
            item.Code = generateCode(idx);
        }
        if (!item.Type) item.Type = "Generic";
        if (!item.Category) item.Category = "Equipment";
        if (!item.Number) item.Number = 1;
        if (!item.Name) item.Name = item.Type;
        return item;
    });
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

⚠️ VERY IMPORTANT: Do not invent meaningless types like "them". If the type is unclear, use "Generic" instead.
⚠️ VERY IMPORTANT: If the text describes a connection (e.g., "connect tank to filter"), extract BOTH items separately and also include a connection object {sourceCode, targetCode}.

Example format:
Explanation: "Looks like you want 2 equipment tanks named U123 in Unit A, SubUnit 1, connected to U456."
{
  "Items": [
    {
      "Name": "Tank",
      "Code": "U123",
      "Category": "Equipment",
      "Type": "Tank",
      "Number": 2,
      "Unit": "Unit A",
      "SubUnit": "SubUnit 1"
    },
    {
      "Name": "Filter",
      "Code": "U456",
      "Category": "Equipment",
      "Type": "Filter",
      "Number": 1,
      "Unit": "Unit A",
      "SubUnit": "SubUnit 1"
    }
  ],
  "Connection": {"sourceCode": "U123", "targetCode": "U456"}
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
            const itemPhrases = description.split(/\band\b|,|\+/i).map(s => s.trim()).filter(Boolean);

            const items = itemPhrases.map((phrase, idx) => {
                const codeMatch = phrase.match(/\bU\d{3,}\b/);
                const Code = codeMatch ? codeMatch[0] : generateCode(idx);
                const parts = phrase.split(/\s+/).filter(Boolean);

                let Category = "";
                for (const c of categoriesList) {
                    if (phrase.toLowerCase().includes(c.toLowerCase())) {
                        Category = c;
                        break;
                    }
                }

                const Type = parts.filter(
                    w => w.toLowerCase() !== Category.toLowerCase() && !/U\d+/.test(w)
                ).pop() || "Generic";

                const Name = Type;

                let Unit = "";
                let SubUnit = "";
                const unitMatch = phrase.match(/unit\s+([^\s]+)/i);
                if (unitMatch) Unit = unitMatch[1];
                const subUnitMatch = phrase.match(/subunit\s+([^\s]+)/i);
                if (subUnitMatch) SubUnit = subUnitMatch[1];

                return { Name, Code, Category: Category || "Equipment", Type, Number: 1, Unit, SubUnit };
            });

            parsed = { Items: items };
            explanation = `I guessed this looks like ${items.length} item(s) based on your description.`;
        }

        // Normalize items to always have valid fields
        parsed.Items = normalizeItems(parsed.Items || []);

        const connection = parseConnection(description, parsed?.Items);
        if (parsed && !parsed.Connection && connection) {
            parsed.Connection = connection;
        }

        return res.json({ explanation, parsed, connection: parsed.Connection || null });
    } catch (err) {
        console.error("API handler failed:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}