import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function extractJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e2) {
                return null;
            }
        }
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const { description, categories } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    const categoriesList = Array.isArray(categories) && categories.length
        ? categories
        : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

    // 👉 Updated prompt to include a human-style explanation AND JSON
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


    let explanation = "";
    let parsed = null;

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
        // ✅ Fallback regex parsing
        // Code must always start with U + digits
        const codeMatch = description.match(/\bU\d{3,}\b/);
        const Code = codeMatch ? codeMatch[0] : "";

        // Try to extract a number of items (e.g. "2 Tanks")
        const numberMatch = description.match(/\b\d+\b/);
        const Number = numberMatch ? parseInt(numberMatch[0], 10) : 1;

        // Fallback Name = if no code, fallback to first token
        const words = description.trim().split(/\s+/).filter(Boolean);
        const Name = Code || words[0] || "";

        // Category = find closest match
        let Category = "";
        for (const c of categoriesList) {
            if (description.toLowerCase().includes(c.toLowerCase())) {
                Category = c;
                break;
            }
        }

        // Type = last word not equal to Name/Category
        const Type = words.filter(
            w =>
                w.toLowerCase() !== Name.toLowerCase() &&
                w.toLowerCase() !== Category.toLowerCase()
        ).pop() || "";

        parsed = { Name, Code, Category, Type, Number };
        explanation = `I guessed this looks like ${Number} ${Category || "process item"}(s) named ${Code || Name} of type ${Type}.`;
    }

    return res.json({
        explanation,
        parsed
    });
}

