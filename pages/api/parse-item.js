// pages/api/parse-item.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });

    try {
        const prompt = `
Extract Name, Category, Type from the text:
"${description}"
Return JSON only with keys: Name, Category, Type
Example: "Draw an U123 Equipment Tank" → { "Name": "U123", "Category": "Equipment", "Type": "Tank" }
    `;
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        res.status(200).json(parsed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "AI parse failed", details: err.message });
    }
}
