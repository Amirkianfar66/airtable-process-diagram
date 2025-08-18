import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { description } = req.body;
  if (!description) return res.status(400).json({ error: "Missing description" });

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
