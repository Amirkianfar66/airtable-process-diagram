import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const { description, categories } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    const categoriesList = Array.isArray(categories) && categories.length
        ? categories
        : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

    const prompt = `You are a strict parser. Given a description, return JSON ONLY: Name, Category, Type.\nText: \"${description}\"`;

    try {
        const result = await model.generateContent(prompt);
        const content = result?.response?.text();
        const parsed = extractJSON(content);

        if (parsed) {
            const Name = (parsed.Name ?? "").toString().trim();
            const Category = (parsed.Category ?? "").toString().trim();
            const Type = (parsed.Type ?? "").toString().trim();
            return res.json({ Name, Category, Type });
        }
    } catch (err) {
        console.error("Gemini parse failed, falling back to regex", err);
    }

    // Always fallback regex parsing
    const codeMatch = description.match(/\b(U[A-Za-z0-9\-]+|[A-Za-z0-9]{2,})\b/);
    let Name = codeMatch ? codeMatch[0] : "";
    let Category = "";
    for (const c of categoriesList) if (description.toLowerCase().includes(c.toLowerCase())) { Category = c; break; }
    const words = description.trim().split(/\s+/).filter(Boolean);
    let Type = words.filter(w => w.toLowerCase() !== Name.toLowerCase() && w.toLowerCase() !== Category.toLowerCase()).pop() || "";

    return res.json({ Name, Category, Type });
}
