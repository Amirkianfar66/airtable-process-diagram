// ai/wedgeParse.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function wedgeParse(description) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
You are a PNID assistant.

Task:
1. If the input is conversational (like "hi", "hello", "how are you?", "what is a pump?"),
   reply naturally as if you are a human process engineer talking to a colleague.
   Do NOT output JSON in this case — just give a friendly, natural response.

2. If the input is a PNID command (like "Draw 1 equipment tank", "Add 2 pumps", "Connect pump to tank"),
   output ONLY structured JSON with the following fields:
   {
     "Name": "...",
     "Category": "...",
     "Type": "...",
     "Unit": "...",
     "SubUnit": "...",
     "Sequence": "...",
     "Number": "...",
     "SensorType": "...",
     "Explanation": "...",
     "Connections": [...]
   }

Input: """${description}"""

Now respond according to the rules above.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Try to parse JSON if possible
    try {
        const parsed = JSON.parse(text);
        return { parsed, explanation: parsed.Explanation || "", mode: "structured" };
    } catch {
        // If not JSON → it's a natural chat response
        return { parsed: {}, explanation: text, mode: "chat" };
    }
}
