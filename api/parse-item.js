import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ----------------------
// Helper functions
// ----------------------
function extractJSON(text) {
    if (!text) return null;
    try { return JSON.parse(text); }
    catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { return null; }
        }
        return null;
    }
}

function parseConnection(text) {
    // Matches: "Connect U123 to U456"
    const regex = /connect\s+(\S+)\s+to\s+(\S+)/i;
    const match = text.match(regex);
    if (!match) return null;
    return {
        sourceCode: match[1],
        targetCode: match[2]
    };
}

// ----------------------
// API Handler
// ----------------------
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const { description, categories } = req.body;
        if (!description) return res.status(400).json({ error: "Missing description" });

        const categoriesList = Array.isArray(categories) && categories.length
            ? categories
            : ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

        let explanation = "";
        let parsed = null;

        // ----------------------
        // AI parsing (your existing prompt code)
        // ----------------------
        const prompt = `
You are a process engineer assistant.
Extract structured data from the text.
Return a short natural explanation paragraph and JSON.

- JSON keys required: Name, Code, Category, Type, Number, Unit, SubUnit
- Code: always starts with 'U' + digits
- Number: how many items
- Category: one of [Equipment, Instrument, Inline Valve, Pipe, Electrical]
- Detect if multiple items are requested.
- Detect if a connection between items is requested.
- Explanation: give a single paragraph describing what should be drawn, including connections.

[
  { "text": "Draw 2 Equipment Tanks in Unit A Subunit 1 and connect them.", "explanation": "Two Equipment Tanks are placed in Unit A, Subunit 1, connected sequentially.", "parsed": [{ "Name": "Tank", "Code": "U101", "Category": "Equipment", "Type": "Tank", "Number": 2, "Unit": "Unit A", "SubUnit": "Subunit 1" }] },
  { "text": "Place a Filter in Unit 2 Subunit 3, then a Tank next to it.", "explanation": "Place one Equipment Filter in Unit 2, Subunit 3, and one Equipment Tank nearby.", "parsed": [{ "Name": "Filter", "Code": "U102", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit 2", "SubUnit": "Subunit 3" }, { "Name": "Tank", "Code": "U103", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit 2", "SubUnit": "Subunit 3" }] },
  { "text": "Add an Instrument Sensor Unit B Subunit 2 and connect it to the Tank U101.", "explanation": "Add an Instrument Sensor in Unit B, Subunit 2, connected to Tank U101.", "parsed": [{ "Name": "Sensor", "Code": "U104", "Category": "Instrument", "Type": "Sensor", "Number": 1, "Unit": "Unit B", "SubUnit": "Subunit 2" }], "connection": { "sourceCode": "U104", "targetCode": "U101" } },
  { "text": "Draw 3 Inline Valves in Subunit 5 of Unit C.", "explanation": "Three Inline Valves are placed in Unit C, Subunit 5.", "parsed": [{ "Name": "Inline Valve", "Code": "U105", "Category": "Inline Valve", "Type": "Valve", "Number": 3, "Unit": "Unit C", "SubUnit": "Subunit 5" }] },
  { "text": "Place Equipment Pump in Unit D and connect it to the Chiller in Subunit 2.", "explanation": "Place one Equipment Pump in Unit D and connect it to a Chiller in Subunit 2.", "parsed": [{ "Name": "Pump", "Code": "U106", "Category": "Equipment", "Type": "Pump", "Number": 1, "Unit": "Unit D", "SubUnit": "" }], "connection": { "sourceCode": "U106", "targetCode": "U107" } },
  { "text": "Draw a Tank and a Filter, connect them in Unit 1 Subunit 1.", "explanation": "Place one Tank and one Filter in Unit 1, Subunit 1, connected sequentially.", "parsed": [{ "Name": "Tank", "Code": "U107", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit 1", "SubUnit": "Subunit 1" }, { "Name": "Filter", "Code": "U108", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit 1", "SubUnit": "Subunit 1" }] },
  { "text": "Add Instrument General Unit X Subunit Y after the Pump.", "explanation": "Add one Instrument General in Unit X, Subunit Y, placed after the Pump.", "parsed": [{ "Name": "Instrument", "Code": "U109", "Category": "Instrument", "Type": "General", "Number": 1, "Unit": "Unit X", "SubUnit": "Subunit Y" }] },
  { "text": "Connect Filter U108 to Tank U107 and then add another Tank U110 in Subunit 2.", "explanation": "Connect Filter U108 to Tank U107, then place a new Tank U110 in Subunit 2.", "parsed": [{ "Name": "Tank", "Code": "U110", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "", "SubUnit": "Subunit 2" }], "connection": { "sourceCode": "U108", "targetCode": "U107" } },
  { "text": "Place 2 Chillers and 1 Pump in Unit E and Subunit 3, connect all of them sequentially.", "explanation": "Place two Chillers and one Pump in Unit E, Subunit 3, connected in sequence.", "parsed": [{ "Name": "Chiller", "Code": "U111", "Category": "Equipment", "Type": "Chiller", "Number": 2, "Unit": "Unit E", "SubUnit": "Subunit 3" }, { "Name": "Pump", "Code": "U112", "Category": "Equipment", "Type": "Pump", "Number": 1, "Unit": "Unit E", "SubUnit": "Subunit 3" }] },
  { "text": "Draw Equipment Tank in Unit F Subunit 1 and Equipment Filter in Unit F Subunit 2, then connect them.", "explanation": "Place a Tank in Unit F Subunit 1 and a Filter in Unit F Subunit 2, connected sequentially.", "parsed": [{ "Name": "Tank", "Code": "U113", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit F", "SubUnit": "Subunit 1" }, { "Name": "Filter", "Code": "U114", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit F", "SubUnit": "Subunit 2" }] },
  { "text": "Add Inline Valve U115 and connect to Pump U112.", "explanation": "Add one Inline Valve U115 and connect it to Pump U112.", "parsed": [{ "Name": "Inline Valve", "Code": "U115", "Category": "Inline Valve", "Type": "Valve", "Number": 1, "Unit": "", "SubUnit": "" }], "connection": { "sourceCode": "U115", "targetCode": "U112" } },
  { "text": "Place 3 Tanks in Unit G sequentially.", "explanation": "Place three Tanks in Unit G, connected sequentially.", "parsed": [{ "Name": "Tank", "Code": "U116", "Category": "Equipment", "Type": "Tank", "Number": 3, "Unit": "Unit G", "SubUnit": "" }] },
  { "text": "Draw Pump and Filter in Unit H Subunit 1, connect Pump to Filter.", "explanation": "Place one Pump and one Filter in Unit H Subunit 1, connected Pump → Filter.", "parsed": [{ "Name": "Pump", "Code": "U117", "Category": "Equipment", "Type": "Pump", "Number": 1, "Unit": "Unit H", "SubUnit": "Subunit 1" }, { "Name": "Filter", "Code": "U118", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit H", "SubUnit": "Subunit 1" }], "connection": { "sourceCode": "U117", "targetCode": "U118" } },
  { "text": "Add Instrument Sensor and connect to Valve U115.", "explanation": "Add one Instrument Sensor connected to Valve U115.", "parsed": [{ "Name": "Sensor", "Code": "U119", "Category": "Instrument", "Type": "Sensor", "Number": 1, "Unit": "", "SubUnit": "" }], "connection": { "sourceCode": "U119", "targetCode": "U115" } },
  { "text": "Place 2 Equipment Pumps in Subunit 4, Unit I, connect them.", "explanation": "Place two Equipment Pumps in Unit I, Subunit 4, connected sequentially.", "parsed": [{ "Name": "Pump", "Code": "U120", "Category": "Equipment", "Type": "Pump", "Number": 2, "Unit": "Unit I", "SubUnit": "Subunit 4" }] },
  { "text": "Draw a Chiller in Unit J and connect it to Tank U116.", "explanation": "Place one Chiller in Unit J, connected to Tank U116.", "parsed": [{ "Name": "Chiller", "Code": "U121", "Category": "Equipment", "Type": "Chiller", "Number": 1, "Unit": "Unit J", "SubUnit": "" }], "connection": { "sourceCode": "U121", "targetCode": "U116" } },
  { "text": "Add Filter and then Tank in Subunit 6 of Unit K.", "explanation": "Place one Filter and one Tank in Unit K, Subunit 6, sequentially.", "parsed": [{ "Name": "Filter", "Code": "U122", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit K", "SubUnit": "Subunit 6" }, { "Name": "Tank", "Code": "U123", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit K", "SubUnit": "Subunit 6" }] },
  { "text": "Draw Instrument Sensor in Unit L Subunit 1.", "explanation": "Place one Instrument Sensor in Unit L, Subunit 1.", "parsed": [{ "Name": "Sensor", "Code": "U124", "Category": "Instrument", "Type": "Sensor", "Number": 1, "Unit": "Unit L", "SubUnit": "Subunit 1" }] },
  { "text": "Connect Tank U123 to Chiller U121.", "explanation": "Connect Tank U123 to Chiller U121.", "parsed": [], "connection": { "sourceCode": "U123", "targetCode": "U121" } },
  { "text": "Place Equipment Tank, Filter, and Pump in Unit M, Subunit 2, connect sequentially.", "explanation": "Place one Tank, one Filter, and one Pump in Unit M, Subunit 2, connected in sequence.", "parsed": [{ "Name": "Tank", "Code": "U125", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit M", "SubUnit": "Subunit 2" }, { "Name": "Filter", "Code": "U126", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit M", "SubUnit": "Subunit 2" }, { "Name": "Pump", "Code": "U127", "Category": "Equipment", "Type": "Pump", "Number": 1, "Unit": "Unit M", "SubUnit": "Subunit 2" }] },
  { "text": "Draw 4 Inline Valves in Unit N, connect them all.", "explanation": "Place four Inline Valves in Unit N, connected sequentially.", "parsed": [{ "Name": "Inline Valve", "Code": "U128", "Category": "Inline Valve", "Type": "Valve", "Number": 4, "Unit": "Unit N", "SubUnit": "" }] },
  { "text": "Place Pump in Unit O Subunit 1, then Tank in Subunit 2, connect Pump to Tank.", "explanation": "Place one Pump in Unit O Subunit 1 and one Tank in Subunit 2, connected Pump → Tank.", "parsed": [{ "Name": "Pump", "Code": "U129", "Category": "Equipment", "Type": "Pump", "Number": 1, "Unit": "Unit O", "SubUnit": "Subunit 1" }, { "Name": "Tank", "Code": "U130", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit O", "SubUnit": "Subunit 2" }], "connection": { "sourceCode": "U129", "targetCode": "U130" } }
  { "text": "Add a Filter in Subunit 3, Unit P and connect it to Pump U129.", "explanation": "Place one Filter in Unit P, Subunit 3, connected to Pump U129.", "parsed": [{ "Name": "Filter", "Code": "U131", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit P", "SubUnit": "Subunit 3" }], "connection": { "sourceCode": "U131", "targetCode": "U129" } },
  { "text": "Draw 2 Tanks and 1 Chiller in Unit Q Subunit 2, connect sequentially.", "explanation": "Place two Tanks and one Chiller in Unit Q, Subunit 2, connected in sequence.", "parsed": [{ "Name": "Tank", "Code": "U132", "Category": "Equipment", "Type": "Tank", "Number": 2, "Unit": "Unit Q", "SubUnit": "Subunit 2" }, { "Name": "Chiller", "Code": "U133", "Category": "Equipment", "Type": "Chiller", "Number": 1, "Unit": "Unit Q", "SubUnit": "Subunit 2" }] },
  { "text": "Place Pump U127 in Unit R, then connect to Filter U131.", "explanation": "Place Pump U127 in Unit R and connect it to Filter U131.", "parsed": [], "connection": { "sourceCode": "U127", "targetCode": "U131" } },
  { "text": "Add Instrument General in Unit S Subunit 1.", "explanation": "Place one Instrument General in Unit S, Subunit 1.", "parsed": [{ "Name": "Instrument", "Code": "U134", "Category": "Instrument", "Type": "General", "Number": 1, "Unit": "Unit S", "SubUnit": "Subunit 1" }] },
  { "text": "Draw Chiller and connect to Tank U132.", "explanation": "Place one Chiller and connect it to Tank U132.", "parsed": [{ "Name": "Chiller", "Code": "U135", "Category": "Equipment", "Type": "Chiller", "Number": 1, "Unit": "", "SubUnit": "" }], "connection": { "sourceCode": "U135", "targetCode": "U132" } },
  { "text": "Place 3 Inline Valves in Unit T and connect them sequentially.", "explanation": "Place three Inline Valves in Unit T, connected in sequence.", "parsed": [{ "Name": "Inline Valve", "Code": "U136", "Category": "Inline Valve", "Type": "Valve", "Number": 3, "Unit": "Unit T", "SubUnit": "" }] },
  { "text": "Draw Tank U130 next to Filter U131 and connect both to Pump U129.", "explanation": "Tank U130 and Filter U131 are placed next to each other and connected to Pump U129.", "parsed": [], "connection": { "sourceCode": "U130", "targetCode": "U129" } },
  { "text": "Add 2 Equipment Pumps in Subunit 5 of Unit U.", "explanation": "Place two Equipment Pumps in Unit U, Subunit 5.", "parsed": [{ "Name": "Pump", "Code": "U137", "Category": "Equipment", "Type": "Pump", "Number": 2, "Unit": "Unit U", "SubUnit": "Subunit 5" }] },
  { "text": "Connect Chiller U133 to Tank U132.", "explanation": "Connect Chiller U133 to Tank U132.", "parsed": [], "connection": { "sourceCode": "U133", "targetCode": "U132" } },
  { "text": "Draw Equipment Tank and Equipment Filter in Unit V Subunit 2 and connect.", "explanation": "Place one Tank and one Filter in Unit V, Subunit 2, connected sequentially.", "parsed": [{ "Name": "Tank", "Code": "U138", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit V", "SubUnit": "Subunit 2" }, { "Name": "Filter", "Code": "U139", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit V", "SubUnit": "Subunit 2" }] },
  { "text": "Place Instrument Sensor in Unit W Subunit 3.", "explanation": "Place one Instrument Sensor in Unit W, Subunit 3.", "parsed": [{ "Name": "Sensor", "Code": "U140", "Category": "Instrument", "Type": "Sensor", "Number": 1, "Unit": "Unit W", "SubUnit": "Subunit 3" }] },
  { "text": "Draw 2 Equipment Chillers in Unit X Subunit 1.", "explanation": "Place two Chillers in Unit X, Subunit 1.", "parsed": [{ "Name": "Chiller", "Code": "U141", "Category": "Equipment", "Type": "Chiller", "Number": 2, "Unit": "Unit X", "SubUnit": "Subunit 1" }] },
  { "text": "Add Pump U137 and connect to Filter U139.", "explanation": "Connect Pump U137 to Filter U139.", "parsed": [], "connection": { "sourceCode": "U137", "targetCode": "U139" } },
  { "text": "Place 3 Tanks in Unit Y, Subunit 3, connect sequentially.", "explanation": "Place three Tanks in Unit Y, Subunit 3, connected sequentially.", "parsed": [{ "Name": "Tank", "Code": "U142", "Category": "Equipment", "Type": "Tank", "Number": 3, "Unit": "Unit Y", "SubUnit": "Subunit 3" }] },
  { "text": "Draw Filter and then Tank in Subunit 4 of Unit Z.", "explanation": "Place one Filter and one Tank in Unit Z, Subunit 4, sequentially.", "parsed": [{ "Name": "Filter", "Code": "U143", "Category": "Equipment", "Type": "Filter", "Number": 1, "Unit": "Unit Z", "SubUnit": "Subunit 4" }, { "Name": "Tank", "Code": "U144", "Category": "Equipment", "Type": "Tank", "Number": 1, "Unit": "Unit Z", "SubUnit": "Subunit 4" }] },
  { "text": "Connect Tank U142 to Pump U137.", "explanation": "Connect Tank U142 to Pump U137.", "parsed": [], "connection": { "sourceCode": "U142", "targetCode": "U137" } },
  { "text": "Add 2 Instrument Sensors in Unit AA Subunit 2.", "explanation": "Place two Instrument Sensors in Unit AA, Subunit 2.", "parsed": [{ "Name": "Sensor", "Code": "U145", "Category": "Instrument", "Type": "Sensor", "Number": 2, "Unit": "Unit AA", "SubUnit": "Subunit 2" }] },
  { "text": "Draw 2 Inline Valves in Unit AB, connect them.", "explanation": "Place two Inline Valves in Unit AB, connected sequentially.", "parsed": [{ "Name": "Inline Valve", "Code": "U146", "Category": "Inline Valve", "Type": "Valve", "Number": 2, "Unit": "Unit AB", "SubUnit": "" }] },
  { "text": "Place Equipment Tank U144 next to Filter U143 and connect them.", "explanation": "Connect Tank U144 and Filter U143 sequentially.", "parsed": [], "connection": { "sourceCode": "U144", "targetCode": "U143" } },
  { "text": "Draw Pump in Subunit 5 of Unit AC.", "explanation": "Place one Pump in Unit AC, Subunit 5.", "parsed": [{ "Name": "Pump", "Code": "U147", "Category": "Equipment", "Type": "Pump", "Number": 1, "Unit": "Unit AC", "SubUnit": "Subunit 5" }] },
  { "text": "Add Chiller and connect to Tank U142.", "explanation": "Connect Chiller to Tank U142.", "parsed": [{ "Name": "Chiller", "Code": "U148", "Category": "Equipment", "Type": "Chiller", "Number": 1, "Unit": "", "SubUnit": "" }], "connection": { "sourceCode": "U148", "targetCode": "U142" } },
  { "text": "Draw 2 Inline Valves in Unit AB, connect them.", "explanation": "Place two Inline Valves in Unit AB, connected sequentially.", "parsed": [{ "Name": "Inline Valve", "Code": "U146", "Category": "Inline Valve", "Type": "Valve", "Number": 2, "Unit": "Unit AB", "SubUnit": "" }] },
]



Text: "${description}"
`;


        try {
            const result = await model.generateContent(prompt);
            const content = result?.response?.text();

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = extractJSON(jsonMatch[0]);
                explanation = content.replace(jsonMatch[0], "").trim();
            } else {
                explanation = content.trim();
            }
        } catch (err) {
            console.error("Gemini parse failed, falling back to regex", err);
        }

        // ----------------------
        // Fallback regex parsing (your existing code)
        // ----------------------
        if (!parsed) {
            const codeMatches = description.match(/\bU\d{3,}\b/g) || [];

            if (codeMatches.length > 0) {
                // ... your existing fallback logic for multiple codes
                const code = codeMatches[0];
                const words = description.trim().split(/\s+/).filter(Boolean);

                let Category = "";
                for (const c of categoriesList) {
                    if (description.toLowerCase().includes(c.toLowerCase())) {
                        Category = c;
                        break;
                    }
                }

                const Type = words.filter(
                    w => !codeMatches.includes(w) && w.toLowerCase() !== Category.toLowerCase()
                ).pop() || "Generic";

                const Name = words.filter(w => w !== code && w !== Type && w !== Category).join(" ") || Type;

                // ← Add Unit/SubUnit extraction here
                let Unit = "";
                let SubUnit = "";
                const unitMatch = description.match(/unit\s+([^\s]+)/i);
                if (unitMatch) Unit = unitMatch[1];
                const subUnitMatch = description.match(/subunit\s+([^\s]+)/i);
                if (subUnitMatch) SubUnit = subUnitMatch[1];

                parsed = { Name, Code: code, Category, Type, Number: 1, Unit, SubUnit };
                parsed._otherCodes = codeMatches.slice(1);
                explanation = `I guessed this looks like ${codeMatches.length} item(s) based on your description.`;
            }
            else {
                // ... fallback for single code
                const codeMatch = description.match(/\bU\d{3,}\b/);
                const Code = codeMatch ? codeMatch[0] : "";
                const words = description.trim().split(/\s+/).filter(Boolean);
                const Name = Code || words[0] || "";

                let Category = "";
                for (const c of categoriesList) {
                    if (description.toLowerCase().includes(c.toLowerCase())) {
                        Category = c;
                        break;
                    }
                }

                const Type = words.filter(
                    w => w.toLowerCase() !== Name.toLowerCase() && w.toLowerCase() !== Category.toLowerCase()
                ).pop() || "";

                // ← Add Unit/SubUnit extraction here as well
                let Unit = "";
                let SubUnit = "";
                const unitMatch = description.match(/unit\s+([^\s]+)/i);
                if (unitMatch) Unit = unitMatch[1];
                const subUnitMatch = description.match(/subunit\s+([^\s]+)/i);
                if (subUnitMatch) SubUnit = subUnitMatch[1];

                parsed = { Name, Code, Category, Type, Number: 1, Unit, SubUnit };
                explanation = `I guessed this looks like 1 ${Category || "process item"} named ${Code || Name} of type ${Type}.`;
            }
        }


        // ----------------------
        // Parse connection (your existing helper)
        // ----------------------
        const connection = parseConnection(description);

        // ✅ FINAL RESPONSE
        return res.json({ explanation, parsed, connection });
    } catch (err) {
        console.error("API handler failed:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
