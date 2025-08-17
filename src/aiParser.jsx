// aiParser.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Parse a text description into { Name, Category, Type } using GPT
 */
export async function parseItemText(description, categories = ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"]) {
  if (!description) return null;

  const prompt = `
You are an assistant that extracts structured information from a short item description.
Extract Name, Category, and Type from the following text.

Text: "${description}"

Rules:
- Name is usually a unique code like UXXXX.
- Category must be one of: ${categories.join(", ")}.
- Type is the remaining description that is not Name or Category.
- Return JSON only, like:
{ "Name": "...", "Category": "...", "Type": "..." }
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  try {
    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (err) {
    console.error("GPT parse error:", err, response.choices[0].message.content);
    return null;
  }
}
