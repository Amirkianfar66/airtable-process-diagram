// ai/wedgeParse.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function wedgeParse(description) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
    You are a PNID assistant. 
    Parse the following natural language into *valid JSON only*. 
    No explanations outside the JSON. 
    Input: "${description}"
    Required fields:
    { "Name": "", "Category": "", "Type": "", "Unit": 0, "SubUnit": 0,
      "Sequence": 0, "Number": 0, "SensorType": "", "Explanation": "", "Connections": [] }
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // 🛠 Extract JSON if Gemini adds fluff
    const match = text.match(/\{[\s\S]*\}/);
    if (match) text = match[0];

    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("❌ JSON parse failed:", text);
        return { Explanation: text, parsed: {} };
    }
}
