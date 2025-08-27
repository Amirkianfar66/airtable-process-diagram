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


// --------------------------
// AI PNID generator (with human AI layer)
// --------------------------
async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    let normalizedItems = [];
    let aiResult;
    try {
        aiResult = await parseItemLogic(description);

        if (Array.isArray(aiResult)) {
            aiResult = {
                mode: "structured",
                parsed: aiResult,
                explanation: null,
                connection: null
            };
        }
    } catch (err) {
        console.error('❌ Chat AI failed:', err);
        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: '⚠️ AI processing failed.' }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    const { mode, explanation, parsed = {}, connection } = aiResult;

    // 🔹 Action mode
    if (mode === "action") {
        const action = aiResult.action;
        const actionMsg = `⚡ Action triggered: ${action}`;

        if (typeof setChatMessages === "function") {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: actionMsg }
            ]);
        }

        return { nodes: existingNodes, edges: existingEdges };
    }

    // 🔹 Chat mode
    if (mode === "chat") {
        if (typeof setChatMessages === "function") {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: parsed.message || explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // 🔹 Structured PNID logic
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const newNodes = [];
    const newEdges = [...existingEdges];
    const allMessages = [{ sender: "User", message: description }];

    parsedItems.forEach((p, idx) => {
        const Name = (p.Name || description).trim();
        const Category = p.Category || 'Equipment';
        const Type = p.Type || 'Generic';
        const NumberOfItems = p.Number && p.Number > 0 ? p.Number : 1;

        const Unit = p.Unit ?? 0;
        const SubUnit = p.SubUnit ?? 0;
        const Sequence = p.Sequence ?? 1;

        const baseCode = generateCode({ Category, Type, Unit, SubUnit, Sequence, SensorType: p.SensorType || '' });
        const allCodes = [baseCode].filter(Boolean);

        for (let i = 1; i < NumberOfItems; i++) {
            const nextCode = generateCode({
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: Sequence + i,
                SensorType: p.SensorType || ''
            });
            if (nextCode) allCodes.push(nextCode);
        }

        allCodes.forEach((code, codeIdx) => {
            const nodeId = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;

            const normalizedConnections = (p.Connections || []).map(conn => {
                let target = null;
                if (typeof conn === "string") {
                    target = conn;
                } else if (typeof conn === "object") {
                    target = conn.to || conn.toId;
                }
                if (!target) return null;

                const foundItem =
                    [...normalizedItems, ...existingNodes.map(n => n.data?.item)]
                        .find(i => i?.Code === target || i?.Name === target);

                return foundItem?.Code || target;
            }).filter(Boolean);

            const nodeItem = {
                id: nodeId,
                Name: NumberOfItems > 1 ? `${Name} ${codeIdx + 1}` : Name,
                Code: code,
                'Item Code': code,
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: Sequence + codeIdx,
                Connections: normalizedConnections
            };

            newNodes.push({
                id: nodeId,
                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                data: {
                    label: `${nodeItem.Code} - ${nodeItem.Name}`,
                    item: nodeItem,
                    icon: getItemIcon(nodeItem)
                },
                type: categoryTypeMap[Category] || 'scalableIcon',
            });

            normalizedItems.push(nodeItem);

            allMessages.push({ sender: "AI", message: `Generated code: ${code}` });
        });

        if (explanation && idx === 0) {
            allMessages.push({ sender: "AI", message: explanation });
        }
    });

    // --------------------------
    // Connection handling
    // --------------------------
    if (connection && connection.sourceCode && connection.targetCode) {
        const sourceNode = [...existingNodes, ...newNodes].find(n => n.data?.item?.Code === connection.sourceCode);
        const targetNode = [...existingNodes, ...newNodes].find(n => n.data?.item?.Code === connection.targetCode);

        if (sourceNode && targetNode) {
            const exists = newEdges.some(e => e.source === sourceNode.id && e.target === targetNode.id);
            if (!exists) {
                newEdges.push({
                    id: `edge-${sourceNode.id}-${targetNode.id}`,
                    source: sourceNode.id,
                    target: targetNode.id,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#888', strokeWidth: 2 },
                });
            }
            allMessages.push({ sender: "AI", message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` });
        }
    } else if (parsedItems.length >= 2) {
        const first = parsedItems[0];
        const rest = parsedItems.slice(1);

        for (let i = 0; i < rest.length; i++) {
            const sourceNode = [...existingNodes, ...newNodes].find(n => n.data?.item?.Code === first.Code);
            const targetNode = [...existingNodes, ...newNodes].find(n => n.data?.item?.Code === rest[i].Code);

            if (sourceNode && targetNode) {
                const exists = newEdges.some(e => e.source === sourceNode.id && e.target === targetNode.id);
                if (!exists) {
                    newEdges.push({
                        id: `edge-${sourceNode.id}-${targetNode.id}`,
                        source: sourceNode.id,
                        target: targetNode.id,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#888', strokeWidth: 2 },
                    });
                }
                allMessages.push({ sender: "AI", message: `→ Connected ${first.Code} → ${rest[i].Code}` });
            }
        }
    }

    // ✅ Final return (inside function)
    return {
        nodes: [...existingNodes, ...newNodes],
        edges: [...existingEdges, ...newEdges],
        normalizedItems: parsedItems,
        messages: allMessages,
    };
}

export default AIPNIDGenerator;
