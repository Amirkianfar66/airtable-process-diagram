import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

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

app.post("/api/parse-item", async (req, res) => {
    const { description, categories } = req.body;
    if (!description || typeof description !== "string") {
        return res.status(400).json({ error: "Missing description" });
    }

    const categoriesList = Array.isArray(categories) && categories.length
        ? categories
        : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

    const prompt = `You are a strict parser. Given a description, return JSON ONLY: Name, Category, Type.
Text: "${description}"`;

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

        // fallback regex
        const codeMatch = description.match(/\b(U[A-Za-z0-9\-]+|[A-Za-z0-9]{2,})\b/);
        let Name = codeMatch ? codeMatch[0] : "";
        let Category = "";
        for (const c of categoriesList) if (description.toLowerCase().includes(c.toLowerCase())) { Category = c; break; }
        const words = description.trim().split(/\s+/).filter(Boolean);
        let Type = words.filter(w => w.toLowerCase() !== Name.toLowerCase() && w.toLowerCase() !== Category.toLowerCase()).pop() || "";

        return res.json({ Name, Category, Type });
    } catch (err) {
        console.error("Gemini parse failed", err);
        return res.status(500).json({ error: "Parse failed", details: err?.message || String(err) });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
