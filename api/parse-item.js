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
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const { description, categories } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    const categoriesList = Array.isArray(categories) && categories.length
        ? categories
        : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

    let explanation = "";
    let parsed = null;

    // ----------------------
    // AI parsing
    // ----------------------
    const prompt = `
You are a process engineer assistant.
Extract structured data from the text. 
Return a short natural explanation + JSON.

JSON keys required: Name, Code, Category, Type, Number.
- Code: must always start with 'U' followed by digits if present.
- Number: how many items to generate (default 1 if not given).
- Category: one of [${categoriesList.join(", ")}].

Example format:
Explanation: "Looks like you want 2 equipment tanks named U123."
{
  "Name": "Tank",
  "Code": "U123",
  "Category": "Equipment",
  "Type": "Tank",
  "Number": 2
}

Text: "${description}"
`;

    try {
        const result = await model.generateContent(prompt);
        const content = result?.response?.text();

        // Split explanation from JSON if present
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
        // Fallback regex parsing for multiple codes
        const codeMatches = description.match(/\bU\d{3,}\b/g) || [];
        let parsedItems = [];

        if (codeMatches.length > 0) {
            parsedItems = codeMatches.map(code => {
                const words = description.trim().split(/\s+/).filter(Boolean);
                let Category = "";
                for (const c of categoriesList) {
                    if (description.toLowerCase().includes(c.toLowerCase())) {
                        Category = c;
                        break;
                    }
                }
                const Type = words.filter(
                    w => w.toLowerCase() !== code.toLowerCase() && w.toLowerCase() !== Category.toLowerCase()
                ).pop() || "Generic";

                return {
                    Name: description,
                    Code: code,
                    Category,
                    Type,
                    Number: 1
                };
            });
        } else {
            // fallback single item
            const codeMatch = description.match(/\bU\d{3,}\b/);
            const Code = codeMatch ? codeMatch[0] : `U${Math.floor(1000 + Math.random() * 9000)}`;
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
            ).pop() || "Generic";

            parsedItems = [{ Name, Code, Category, Type, Number: 1 }];
        }

        // ✅ Always use the first item for frontend single-object expectation
        parsed = parsedItems[0];

        explanation = `I guessed this looks like ${parsedItems.length} item(s) based on your description.`;
    }

