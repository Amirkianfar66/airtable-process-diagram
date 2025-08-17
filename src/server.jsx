// server.js
import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Robust JSON extractor: tries JSON.parse first, then looks for a JSON object substring.
 */
function extractJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        // Try to extract a JSON substring {...}
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

app.post('/api/parse-item', async (req, res) => {
    const { description, categories } = req.body;
    if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: 'Missing description (string expected).' });
    }

    // Default categories if client didn't supply
    const categoriesList = Array.isArray(categories) && categories.length > 0
        ? categories
        : ['Equipment', 'Instrument', 'Inline Valve', 'Pipe', 'Electrical'];

    // Build a clear system + user prompt that requests JSON only
    const system = `You are a strict parser. Given a short natural-language item description, return JSON ONLY with exact keys: Name, Category, Type.
- Category must be one of: ${categoriesList.join(', ')} if it is present in text; otherwise return empty string for Category.
- Name is typically a code (e.g. "U123", "UXXXX") or the remaining identifying token.
- Type is the type (e.g. Tank, Pump, Level instrument) — if absent return empty string.
Return JSON only with no extra text.`;

    const user = `Text: "${description}"
Return:
{
  "Name": "<name or empty string>",
  "Category": "<one of the listed categories or empty string>",
  "Type": "<type or empty string>"
}`;

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0,
            max_tokens: 300,
        });

        const content = response?.choices?.[0]?.message?.content;
        const parsed = extractJSON(content);

        if (parsed && typeof parsed === 'object') {
            // Ensure keys exist and are strings
            const Name = (parsed.Name ?? parsed.name ?? '').toString().trim();
            const Category = (parsed.Category ?? parsed.category ?? '').toString().trim();
            const Type = (parsed.Type ?? parsed.type ?? '').toString().trim();

            // If category is not one of categoriesList, normalize to empty string
            const normalizedCategory = categoriesList.find(c => c.toLowerCase() === Category.toLowerCase()) || '';

            return res.json({ Name, Category: normalizedCategory, Type });
        }

        // Fallback: try simple heuristic parsing (very small fallback)
        // - Take first token that looks like code (U followed by digits/letters) as Name
        // - Look for any category keyword
        // - Last token (not category) as Type
        const lower = description.toLowerCase();
        let Name = '';
        const codeMatch = description.match(/\b(U[A-Za-z0-9\-]+|[A-Za-z0-9]{2,})\b/); // simple heuristic
        if (codeMatch) Name = codeMatch[0];

        let Category = '';
        for (const c of categoriesList) {
            if (lower.includes(c.toLowerCase())) { Category = c; break; }
        }

        // Type fallback: last word that isn't the detected category or the name
        const words = description.trim().split(/\s+/).filter(Boolean);
        let Type = '';
        if (words.length > 0) {
            // remove name and category tokens from words, then take last leftover
            const filtered = words.filter(w => w.toLowerCase() !== (Name || '').toLowerCase() && w.toLowerCase() !== (Category || '').toLowerCase());
            if (filtered.length > 0) Type = filtered[filtered.length - 1];
        }

        return res.json({ Name: Name || '', Category: Category || '', Type: Type || '' });
    } catch (err) {
        console.error('AI parse failed', err);
        return res.status(500).json({ error: 'AI parse failed', details: err?.message || String(err) });
    }
});

// honor PORT if set (deployment)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
