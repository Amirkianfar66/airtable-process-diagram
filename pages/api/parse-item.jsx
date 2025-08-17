import OpenAI from "openai";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Missing description" });
        }

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Extract structured info into JSON with fields: Name, Category, Type."
                },
                {
                    role: "user",
                    content: description
                }
            ],
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        res.status(200).json(parsed);
    } catch (err) {
        console.error("Parse error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
