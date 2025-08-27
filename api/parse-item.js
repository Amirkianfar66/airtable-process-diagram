import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1").trim();
}

// Reserved action commands
const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

// Regex for valid 4-digit codes
const CODE_RE = /^[0-9]{4}$/;

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // 1️⃣ Check for exact action match
    const actionMatch = ACTION_COMMANDS.find(
        (cmd) => cmd.toLowerCase() === trimmed.toLowerCase()
    );
    if (actionMatch) {
        return {
            mode: "action",
            action: actionMatch,
            parsed: [],
            explanation: `Triggered action: ${actionMatch}`,
            connection: null,
        };
    }

    // 2️⃣ Otherwise, normal Gemini call
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- Always set "mode": "structured".
- Type must be a string. If multiple types are mentioned (e.g., "Tank and Pump"), generate **separate JSON objects** for each type.
- All fields must be non-null strings or numbers. If a value is missing, use:
    - "" (empty string) for text fields
    - 0 for Unit and SubUnit
    - 1 for Sequence and Number
    - [] for Connections
- If the user mentions "Draw N ...", set Number = N. Default to 1 if unspecified.
- Connections: map "Connect X to Y" → {"from": X, "to": Y}.
- If user says "Connect A and B", always output ONE connection only.
- Do NOT mirror the direction.
- Explanation: include a short human-readable note if relevant.
- Wrap structured PNID JSON in a \`\`\`json ... \`\`\` code block.
- Do NOT wrap chat mode responses in any code block or JSON.

2. Chat mode
- Triggered if input is small talk, greetings, or unrelated to PNID.
- Output plain text only.
- Always set "mode": "chat".

Never mix modes. Default to chat mode if unsure.

User Input: """${trimmed}"""
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.().trim() || "";
        console.log("👉 Gemini raw text:", text);

        if (!text) {
            return {
                parsed: [],
                explanation: "⚠️ AI returned empty response",
                mode: "chat",
                connection: null,
            };
        }

        // Try JSON parse
        try {
            const cleaned = cleanAIJson(text);

            let parsed;
            try {
                parsed = JSON.parse(cleaned);
            } catch (e) {
                // Handle multiple JSON objects concatenated
                const objects = cleaned
                    .split(/}\s*{/)
                    .map((part, idx, arr) => {
                        if (idx === 0 && arr.length > 1) return part + "}";
                        if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                        return "{" + part + "}";
                    });
                parsed = objects.map((obj) => JSON.parse(obj));
            }

            // 🔹 Normalize items
            const itemsArray = (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
                mode: "structured",
                Name: (item.Name || "").toString().trim(),
                Category: item.Category || "Equipment",
                Type: item.Type || "Generic",
                Unit: parseInt(item.Unit, 10) || 0,
                SubUnit: parseInt(item.SubUnit, 10) || 0,
                Sequence: parseInt(item.Sequence, 10) || 1,
                Number: parseInt(item.Number, 10) || 1,
                SensorType: item.SensorType || "",
                Explanation: item.Explanation || "Added PNID item",
                Connections: Array.isArray(item.Connections) ? item.Connections : [],
            }));

            // Generate PNID-style code (Unit + SubUnit + Sequence + Number)
            function generateCode(item) {
                return `${item.Unit}${item.SubUnit}${item.Sequence}${item.Number}`;
            }

            // --- Collect raw connections
            const allConnections = itemsArray.flatMap((i) => i.Connections || []);

            // --- Normalize connections (names or codes)
            const normalizedConnections = allConnections
                .map((c) => ({
                    from: (c.from || "").trim(),
                    to: (c.to || "").trim(),
                }))
                .filter((c) => c.from && c.to);

            let resolvedConnections = [];

            if (normalizedConnections.length > 0) {
                resolvedConnections = normalizedConnections.map((c) => {
                    const fromItem =
                        itemsArray.find(i => i.Name.toLowerCase() === c.from.toLowerCase()) ||
                        itemsArray.find(i => generateCode(i) === c.from) ||
                        itemsArray[0];

                    const toItem =
                        itemsArray.find(i => i.Name.toLowerCase() === c.to.toLowerCase()) ||
                        itemsArray.find(i => generateCode(i) === c.to) ||
                        itemsArray[1];

                    return {
                        from: generateCode(fromItem),
                        to: generateCode(toItem),
                    };
                });
            }

            // --- Fallback: if user said "connect" but AI didn’t resolve names
            const userAskedToConnect = /connect/i.test(trimmed);
            if (userAskedToConnect && resolvedConnections.length === 0 && itemsArray.length === 2) {
                // extract words around "connect"
                const connectMatch = trimmed.match(/connect\s+(.+?)\s+(?:to|and)\s+(.+)/i);

                if (connectMatch) {
                    const [, firstName, secondName] = connectMatch;

                    const firstItem =
                        itemsArray.find(i => i.Name.toLowerCase() === firstName.toLowerCase()) || itemsArray[0];
                    const secondItem =
                        itemsArray.find(i => i.Name.toLowerCase() === secondName.toLowerCase()) || itemsArray[1];

                    resolvedConnections = [
                        {
                            from: generateCode(firstItem),
                            to: generateCode(secondItem),
                        },
                    ];
                } else {
                    // fallback: just assume first → second
                    resolvedConnections = [
                        {
                            from: generateCode(itemsArray[0]),
                            to: generateCode(itemsArray[1]),
                        },
                    ];
                }
            }


            const cleanedItems = itemsArray.map((item) => ({
                ...item,
                Connections: [] // always wipe Gemini's raw
            }));

            let normalizedConnection = null;
            if (resolvedConnections.length > 0) {
                // only handle first connection for now
                normalizedConnection = {
                    sourceCode: resolvedConnections[0].from,
                    targetCode: resolvedConnections[0].to,
                };
            }

            return {
                parsed: cleanedItems,
                explanation: itemsArray[0]?.Explanation || "Added PNID item(s)",
                mode: "structured",
                connection: normalizedConnection,
            };


        } catch (err) {
            console.warn("⚠️ Not JSON, treating as chat:", err.message);
            return {
                parsed: [],
                explanation: text,
                mode: "chat",
                connection: null,
            };
        }
    } catch (err) {
        console.error("❌ parseItemLogic failed:", err);
        return {
            parsed: [],
            explanation: "⚠️ AI processing failed: " + (err.message || "Unknown error"),
            mode: "chat",
            connection: null,
        };
    }
}

// Default API handler
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const { description } = req.body;
        if (!description) return res.status(400).json({ error: "Missing description" });

        const aiResult = await parseItemLogic(description);
        res.status(200).json(aiResult);
    } catch (err) {
        console.error("/api/parse-item error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
}
