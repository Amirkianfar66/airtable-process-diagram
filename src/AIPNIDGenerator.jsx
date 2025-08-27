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
export default async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem,
    setChatMessages
) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // 1️⃣ Send input to Gemini for classification
    // 1️⃣ Send input to Gemini for classification
    // 1️⃣ Send input to Gemini for classification
    let normalizedItems = [];
    let aiResult;
    try {
        aiResult = await parseItemLogic(description);

        // Normalize if AI returned an array directly
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

    // Handle Hybrid action mode
    if (aiResult.mode === "action") {
        const action = aiResult.action;
        const actionMsg = `⚡ Action triggered: ${action}`;

        if (typeof setChatMessages === "function") {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: actionMsg }
            ]);
        }

        // TODO: call your export function if action === "Generate PNID"
        if (action === "Generate PNID") {
            // Example: generatePNID(existingNodes, existingEdges);
        }

        // Return existing nodes/edges since we don't add new items
        return { nodes: existingNodes, edges: existingEdges };
    }

    // 2️⃣ Branch based on AI classification
    if (mode === "chat") {
        // AI says this is general conversation → just show chat
        if (typeof setChatMessages === "function") {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: parsed.message || explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    } else if (mode === "structured" || mode === "pnid") {
        // PNID logic → generate nodes and edges
        // ... your existing PNID generation code here ...
    }


    // 2️⃣ Chat/human mode → reply directly
    if (mode === 'chat') {
        if (typeof setChatMessages === 'function') {
            setChatMessages(prev => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // 3️⃣ Structured PNID logic
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const newNodes = [];
    const newEdges = [...existingEdges];
    const allMessages = [{ sender: "User", message: description }];

    parsedItems.forEach((p, idx) => {
        const Name = (p.Name || description).trim();
        const Category = p.Category && p.Category !== '' ? p.Category : 'Equipment';
        const Type = p.Type && p.Type !== '' ? p.Type : 'Generic';
        const NumberOfItems = p.Number && p.Number > 0 ? p.Number : 1;

        const Unit = p.Unit ?? 0;
        const SubUnit = p.SubUnit ?? 0;
        const Sequence = p.Sequence ?? 1;

        // Generate base code
        const baseCode = generateCode({ Category, Type, Unit, SubUnit, Sequence, SensorType: p.SensorType || '' });
        const allCodes = [baseCode].filter(Boolean);

        // Optionally generate additional codes if NumberOfItems > 1
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

        // Create a node for each code
        allCodes.forEach((code, codeIdx) => {
            const nodeId = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;

            // 🔽 Normalize connections: map Name/Code → existing item.Code if found
            const normalizedConnections = (p.Connections || []).map(conn => {
                let targetNameOrCode = null;

                if (typeof conn === "string") {
                    targetNameOrCode = conn;
                } else if (typeof conn === "object") {
                    targetNameOrCode = conn.to || conn.toId; // Gemini uses {from, to}
                }

                if (!targetNameOrCode) return null;

                const foundItem =
                    [...normalizedItems, ...existingNodes.map(n => n.data?.item)]
                        .find(i => i?.Code === targetNameOrCode || i?.Name === targetNameOrCode);

                return foundItem?.Code || targetNameOrCode;
            }).filter(Boolean);



            // ✅ Create fully normalized item for ItemDetailCard
            const nodeItem = {
                id: nodeId,
                Name: NumberOfItems > 1 ? `${Name} ${codeIdx + 1}` : Name,
                Code: code,
                'Item Code': code,
                Category,
                Type,
                Unit: Unit ?? 'Default Unit',          // fallback if missing
                SubUnit: SubUnit ?? 'Default SubUnit', // fallback if missing
                Sequence: Sequence + codeIdx,
                Connections: normalizedConnections     // ✅ use normalized list
            };

            // push to nodes
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

            // ✅ push to normalizedItems array (so ProcessDiagram can use it)
            normalizedItems.push(nodeItem);

            allMessages.push({ sender: "AI", message: `Generated code: ${code}` });
        });


        if (explanation && idx === 0) {
            allMessages.push({ sender: "AI", message: explanation });
        }
    });

    // --------------------------
    // Explicit connections
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
                    animated: true
                });
            }
            allMessages.push({ sender: "AI", message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` });
        }
    }
    // --------------------------
    // Build edges from each item's Connections
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];

    normalizedItems.forEach(item => {
        if (!item.Connections || !Array.isArray(item.Connections)) return;

        item.Connections.forEach(connCode => {
            const sourceNode = allNodesSoFar.find(n => n.data?.item?.Code === item.Code);
            const targetNode = allNodesSoFar.find(
                n => n.data?.item?.Code === connCode || n.data?.item?.Name === connCode
            );

            if (sourceNode && targetNode) {
                const exists = newEdges.some(
                    e => e.source === sourceNode.id && e.target === targetNode.id
                );
                if (!exists) {
                    newEdges.push({
                        id: `edge-${sourceNode.id}-${targetNode.id}`,
                        source: sourceNode.id,
                        target: targetNode.id,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#888', strokeWidth: 2 },
                    });
                    allMessages.push({
                        sender: "AI",
                        message: `→ Connected ${item.Code} → ${connCode}`
                    });
                }
            }
        });
    });

    // --------------------------
    // Implicit connections (chain all new items)
    // --------------------------
    if (/Connect/i.test(description) && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            const exists = newEdges.some(e => e.source === newNodes[i].id && e.target === newNodes[i + 1].id);
            if (!exists) {
                newEdges.push({
                    id: `edge-${newNodes[i].id}-${newNodes[i + 1].id}`,
                    source: newNodes[i].id,
                    target: newNodes[i + 1].id,
                    animated: true
                });
            }
        }
        allMessages.push({ sender: "AI", message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    allMessages.push({ sender: "AI", message: `→ Generated ${newNodes.length} total item(s)` });

    if (typeof setChatMessages === "function" && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return { nodes: [...existingNodes, ...newNodes], edges: newEdges, normalizedItems };


} 