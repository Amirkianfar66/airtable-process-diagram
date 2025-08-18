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
Given a description of a process item, do TWO things:

1. Write a short natural explanation of what the item seems to be.
2. Then output JSON ONLY with keys: Name, Category, Type.

Example format:
Explanation: "Looks like you want an equipment tank named U123."
{
  "Name": "U123",
  "Category": "Equipment",
  "Type": "Tank"
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
        const codeMatch = description.match(/\b(U[A-Za-z0-9\-]+|[A-Za-z0-9]{2,})\b/);
        const Name = codeMatch ? codeMatch[0] : "";
        let Category = "";
        for (const c of categoriesList) {
            if (description.toLowerCase().includes(c.toLowerCase())) {
                Category = c;
                break;
            }
        }
        const words = description.trim().split(/\s+/).filter(Boolean);
        const Type = words.filter(
            w => w.toLowerCase() !== Name.toLowerCase() && w.toLowerCase() !== Category.toLowerCase()
        ).pop() || "";

        parsed = { Name, Category, Type };
        explanation = `I guessed this looks like a ${Category || "process item"} named ${Name} of type ${Type}.`;
    }

    return res.json({
        explanation,
        parsed
    });
}
