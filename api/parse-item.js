// --- 1. Wedge AI (Gemini wrapper)
// Natural language → structured object
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function wedgeParse(description) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
  You are a PNID assistant. Parse the following natural language into structured JSON.
  Input: "${description}"
  Output fields: Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections.
  `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
        return JSON.parse(text);
    } catch (err) {
        return { explanation: text, parsed: {} };
    }
}

// --- 2. API Layer (/api/parse-item.js)
// Wraps wedge AI and ensures clean structured output
import { wedgeParse } from "../ai/wedgeParse.js";
import { generateCode } from "../src/codeGenerator.js";

export default async function handler(req, res) {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    const aiResult = await wedgeParse(description);
    const parsed = aiResult?.parsed || {};

    // Normalize + code generation
    const code = generateCode({
        Category: parsed.Category || "Equipment",
        Type: parsed.Type || "Generic",
        Unit: parsed.Unit || 0,
        SubUnit: parsed.SubUnit || 0,
        Sequence: parsed.Sequence || 1,
        SensorType: parsed.SensorType || ""
    });

    res.json({
        parsed: { ...parsed, Code: code },
        explanation: aiResult.explanation,
        connection: aiResult.connection || null
    });
}

// --- 3. Frontend glue (aiParser.js)
// Helper for calling /api/parse-item from React components

export async function parseItemText(description) {
    try {
        const res = await fetch("/api/parse-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description })
        });

        if (!res.ok) throw new Error("API error");
        return await res.json();
    } catch (err) {
        console.error("parseItemText error", err);
        return null;
    }
}
