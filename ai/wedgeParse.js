// ai/wedgeParse.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export async function wedgeParse(description) {
    const prompt = `...`;

    const result = await model.generateContent(prompt);
    console.log("👉 Raw Gemini result:", result);

    const text = result.response.text?.().trim?.();
    console.log("👉 Gemini text output:", text);

    try {
        const parsed = JSON.parse(text);
        return { parsed, explanation: parsed.Explanation || "", mode: "structured" };
    } catch {
        return { parsed: {}, explanation: text, mode: "chat" };
    }
}
