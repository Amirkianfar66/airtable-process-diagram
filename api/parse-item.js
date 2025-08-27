// /api/parse-item.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utility to clean Markdown code blocks from AI output
function cleanAIJson(text) {
    // Remove ```json ... ``` or ``` ... ``` blocks
    return text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1").trim();
}

// Reserved action commands
const ACTION_COMMANDS = ["Generate PNID", "Export", "Clear", "Save"];

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // 1️⃣ Check for action command
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

    // 2️⃣ Structured prompt
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- Always set "mode": "structured".
- If multiple items are mentioned, return multiple JSON objects.
- Connections: "Connect A to B" → {"from": A, "to": B}.
- If AI uses "Tank"/"Pump" instead of codes, still output them as placeholders.

2. Chat mode
- If unrelated to PNID → plain text only.

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
                        if (idx === arr.length - 1 && arr.length > 1)
                            return "{" + part;
                        return "{" + part + "}";
                    });
                parsed = objects.map((obj) => JSON.parse(obj));
            }

            // 🔹 Normalize items
            const itemsArray = (Array.isArray(parsed) ? parsed : [parsed]).map(
                (item) => ({
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
                    Connections: Array.isArray(item.Connections)
                        ? item.Connections
                        : [],
                })
            );

            // --- Code generator helper ---
            function generateCode({ Unit, SubUnit, Sequence, Number }) {
                const u = String(Unit).padStart(1, "0");
                const su = String(SubUnit).padStart(1, "0");
                const seq = String(Sequence).padStart(2, "0");
                const num = String(Number).padStart(2, "0");
                return `${u}${su}${seq}${num}`;
            }

            // 🔹 Resolve AI connections inside this batch only
            const allConnections = itemsArray.flatMap((i) => i.Connections);

            const normalizedConnections = allConnections
                .map((c) => {
                    let from = (c.from || "").trim();
                    let to = (c.to || "").trim();

                    // Replace "Tank"/"Pump" placeholders with actual codes from this batch
                    if (/^tank$/i.test(from)) {
                        const tank = itemsArray.find((i) =>
                            /tank/i.test(i.Type)
                        );
                        if (tank) from = generateCode(tank);
                    }
                    if (/^pump$/i.test(from)) {
                        const pump = itemsArray.find((i) =>
                            /pump/i.test(i.Type)
                        );
                        if (pump) from = generateCode(pump);
                    }
                    if (/^tank$/i.test(to)) {
                        const tank = itemsArray.find((i) =>
                            /tank/i.test(i.Type)
                        );
                        if (tank) to = generateCode(tank);
                    }
                    if (/^pump$/i.test(to)) {
                        const pump = itemsArray.find((i) =>
                            /pump/i.test(i.Type)
                        );
                        if (pump) to = generateCode(pump);
                    }

                    return { from, to };
                })
                .filter((c) => c.from && c.to);

            // 🔹 Deduplicate
            const uniqueConnections = Array.from(
                new Map(
                    normalizedConnections.map((c) => [c.from + "->" + c.to, c])
                ).values()
            );

            // --- Auto-connect fallback (per batch only) ---
            if (
                itemsArray.length === 2 &&
                /connect/i.test(trimmed) &&
                uniqueConnections.length === 0
            ) {
                const prevCode = generateCode(itemsArray[0]);
                const currCode = generateCode(itemsArray[1]);
                uniqueConnections.push({ from: prevCode, to: currCode });
            }

            return {
                parsed: itemsArray,
                explanation: itemsArray[0]?.Explanation || "Added PNID item(s)",
                mode: "structured",
                connection: uniqueConnections,
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
            explanation:
                "⚠️ AI processing failed: " + (err.message || "Unknown error"),
            mode: "chat",
            connection: null,
        };
    }
}

// Default API handler
export default async function handler(req, res) {
    try {
        if (req.method !== "POST")
            return res.status(405).send("Method Not Allowed");

        const { description } = req.body;
        if (!description)
            return res.status(400).json({ error: "Missing description" });

        const aiResult = await parseItemLogic(description);
        res.status(200).json(aiResult);
    } catch (err) {
        console.error("/api/parse-item error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
}
