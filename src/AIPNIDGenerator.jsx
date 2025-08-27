// src/utils/AIPNIDGenerator.js
import { getItemIcon, categoryTypeMap } from './IconManager';
import { generateCode } from './codeGenerator';
import { parseItemLogic } from '../api/parse-item'; // Gemini wrapper

// --------------------------
// ChatBox component
// --------------------------
export function ChatBox({ messages }) {
    return (
        <div
            style={{
                padding: 10,
                border: "2px solid #007bff",
                borderRadius: 8,
                maxHeight: "300px",
                overflowY: "auto",
                backgroundColor: "#f9f9f9",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
            }}
        >
            {messages.map((msg, index) => {
                const isUser = msg.sender === "User";
                return (
                    <div
                        key={index}
                        style={{
                            alignSelf: isUser ? "flex-start" : "flex-end",
                            backgroundColor: isUser ? "#e0f0ff" : "#007bff",
                            color: isUser ? "black" : "white",
                            padding: "8px 12px",
                            borderRadius: 16,
                            maxWidth: "70%",
                            wordWrap: "break-word",
                            fontSize: 14,
                        }}
                    >
                        {msg.message}
                    </div>
                );
            })}
        </div>
    );
}


export default async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { normalizedItems: [] };

    let normalizedItems = [];
    let aiResult;

    try {
        aiResult = await parseItemLogic(description);

        if (Array.isArray(aiResult)) {
            aiResult = { mode: "structured", parsed: aiResult };
        }
    } catch (err) {
        console.error("❌ Chat AI failed:", err);
        if (setChatMessages) {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: "⚠️ AI processing failed." }
            ]);
        }
        return { normalizedItems: [] };
    }

    const { mode, explanation, parsed = [] } = aiResult;

    // 🟦 Mode: pure chat
    if (mode === "chat") {
        if (setChatMessages) {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: explanation || parsed.message }
            ]);
        }
        return { normalizedItems: [] };
    }

    // 🟩 Mode: structured PNID
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const allMessages = [{ sender: "User", message: description }];

    parsedItems.forEach((p, idx) => {
        const Name = (p.Name || description).trim();
        const Category = p.Category || "Equipment";
        const Type = p.Type || "Generic";
        const Unit = p.Unit ?? "Default Unit";
        const SubUnit = p.SubUnit ?? "Default SubUnit";
        const Sequence = p.Sequence ?? 1;
        const NumberOfItems = p.Number > 0 ? p.Number : 1;

        // Generate codes
        for (let i = 0; i < NumberOfItems; i++) {
            const code = generateCode({
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: Sequence + i,
                SensorType: p.SensorType || ""
            });

            const nodeItem = {
                id: crypto.randomUUID(),
                Name: NumberOfItems > 1 ? `${Name} ${i + 1}` : Name,
                Code: code,
                "Item Code": code,
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: Sequence + i,
                Connections: p.Connections || [] // store raw, let buildDiagram handle
            };

            normalizedItems.push(nodeItem);
            allMessages.push({ sender: "AI", message: `Generated code: ${code}` });
        }

        if (explanation && idx === 0) {
            allMessages.push({ sender: "AI", message: explanation });
        }
    });

    allMessages.push({ sender: "AI", message: `→ Generated ${normalizedItems.length} item(s)` });

    if (setChatMessages && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return { normalizedItems };
}
