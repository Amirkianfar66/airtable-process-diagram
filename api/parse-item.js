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

// ---- helpers ----
const CODE_RE = /^\d{4}$/; // e.g., 1201, 2202

export async function parseItemLogic(description) {
    const trimmed = description.trim();

    // 1) Action commands
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

    // Capture any explicit 4-digit codes the USER typed (these are allowed to cross-batch)
    const explicitCodesInInput = Array.from(new Set(trimmed.match(/\b\d{4}\b/g) || []));

    // 2) Structured prompt
    const prompt = `
You are a PNID assistant with two modes: structured PNID mode and chat mode.

Rules:

1. Structured PNID mode
- Triggered if input starts with a command (Draw, Connect, Add, Generate, PnID) or clearly describes equipment, piping, instruments, or diagrams.
- Output ONLY valid JSON with these fields:
  { mode, Name, Category, Type, Unit, SubUnit, Sequence, Number, SensorType, Explanation, Connections }
- Always set "mode": "structured".
- If multiple items are mentioned (e.g., "Tank and Pump"), return SEPARATE JSON objects for each item.
- For missing values, use:
    - "" for text fields, 0 for Unit/SubUnit, 1 for Sequence/Number, [] for Connections
- "Connections": map "Connect X to Y" → {"from": X, "to": Y}. Use "Tank"/"Pump" if codes are unknown.

2. Chat mode
- If unrelated to PNID → plain text only (mode "chat").

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
                // handle concatenated JSON objects
                const objects = cleaned
                    .split(/}\s*{/)
                    .map((part, idx, arr) => {
                        if (idx === 0 && arr.length > 1) return part + "}";
                        if (idx === arr.length - 1 && arr.length > 1) return "{" + part;
                        return "{" + part + "}";
                    });
                parsed = objects.map((obj) => JSON.parse(obj));
            }

            // Normalize items
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

            // Collect raw connections proposed by the model
            const allConnections = itemsArray.flatMap((i) => i.Connections || []);

            // ---- STRICT resolution rules ----
            // Accept ONLY:
            //   A) connections where BOTH endpoints are 4-digit codes that the USER explicitly typed
            // Everything else (placeholders like "Pump"/"Tank", or model-invented codes) is ignored.
            const userExplicitCodeConnections = allConnections
                .map((c) => ({
                    from: (c.from || "").trim(),
                    to: (c.to || "").trim(),
                }))
                .filter(
                    (c) =>
                        CODE_RE.test(c.from) &&
                        CODE_RE.test(c.to) &&
                        explicitCodesInInput.includes(c.from) &&
                        explicitCodesInInput.includes(c.to)
                );

            // Dedup (preserving order)
            const uniqueConnections = Array.from(
                new Map(userExplicitCodeConnections.map((c) => [c.from + "->" + c.to, c])).values()
            );

            // --- Per-batch auto-connect fallback ---
            // If the user said "connect" but we didn't accept any explicit code connections,
            // and exactly 2 items are in this batch, let the CLIENT auto-connect
            // (we return no connection so the frontend can wire the 2 freshly-created nodes in order).
            const userAskedToConnect = /connect/i.test(trimmed);
            const shouldAutoConnect = userAskedToConnect && uniqueConnections.length === 0 && itemsArray.length === 2;

            return {
                parsed: itemsArray,
                explanation: itemsArray[0]?.Explanation || "Added PNID item(s)",
                mode: "structured",
                connection: shouldAutoConnect ? [] : uniqueConnections,
                // Note: returning [] (not null) keeps schema stable; client should auto-connect per batch.
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
