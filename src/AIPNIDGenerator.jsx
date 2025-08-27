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

        // Return existing nodes/edges since we don't add new items
        return { nodes: existingNodes, edges: existingEdges };
    }

    // Chat mode
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

    // Structured PNID logic
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const newNodes = [];
    const newEdges = [...existingEdges];
    const allMessages = [{ sender: "User", message: description }];

    // Build quick lookup of existing nodes by code & by name (prefer existing canvas)
    const existingItems = existingNodes.map(n => n.data?.item).filter(Boolean);
    const codeToNodeId = new Map();   // code => nodeId (includes existing)
    const codeToItem = new Map();     // code => item object
    const nameToCode = new Map();     // name => code (for resolving by name)

    existingNodes.forEach(n => {
        const it = n.data?.item;
        if (!it) return;
        if (it.Code) {
            codeToNodeId.set(it.Code, n.id);
            codeToItem.set(it.Code, it);
        }
        if (it.Name) {
            nameToCode.set(it.Name.toLowerCase(), it.Code || it.Name);
        }
    });

    // Process parsed items and create nodes only if code not already present in canvas
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

        // Create a node for each code, but reuse existing canvas node if code exists there
        allCodes.forEach((code, codeIdx) => {
            // If the code already exists in canvas -> reuse it (do not create new node)
            if (codeToNodeId.has(code)) {
                const existingItem = codeToItem.get(code);
                // ensure normalizedItems contains this item so connections can reference it
                if (!normalizedItems.find(it => it.Code === code)) {
                    normalizedItems.push(existingItem);
                }
                // still add a message that code was recognized
                allMessages.push({ sender: "AI", message: `Reused existing code: ${code}` });
                return;
            }

            // Normalize connections: respect direction when object form is used
            const normalizedConnections = [];
            const existingItemsPool = [...existingItems]; // prefer existing canvas items when resolving targets

            (p.Connections || []).forEach(conn => {
                if (!conn) return;

                // CASE 1: string connection -> treat as outgoing to that name/code
                if (typeof conn === "string") {
                    const targetNameOrCode = conn.trim();
                    // search existing canvas items first
                    const found =
                        existingItemsPool.find(i => i?.Code === targetNameOrCode || (i?.Name && i.Name.toLowerCase() === targetNameOrCode.toLowerCase()))
                        || normalizedItems.find(i => i?.Code === targetNameOrCode || (i?.Name && i.Name.toLowerCase() === targetNameOrCode.toLowerCase()));

                    if (found) {
                        normalizedConnections.push(found.Code || targetNameOrCode);
                    } else {
                        normalizedConnections.push(targetNameOrCode);
                    }
                    return;
                }

                // CASE 2: object connection -> { from, to } or similar
                if (typeof conn === "object") {
                    const fromVal = (conn.from || conn.fromName || "").toString().trim();
                    const toVal = (conn.to || conn.toName || conn.toId || "").toString().trim();
                    if (!fromVal || !toVal) return;

                    // Determine whether this generated code or parsed name equals the `from` (so it's outgoing for this item)
                    const thisIsSource =
                        // match parsed name (case-insensitive)
                        (p.Name && fromVal.toLowerCase() === p.Name.toLowerCase()) ||
                        // match generated code string (AI might return code strings)
                        (fromVal === code) ||
                        // or match PNID style code for this parsed object
                        (fromVal === generateCode(p));

                    if (!thisIsSource) {
                        // it's an incoming connection for this node — skip adding outgoing here
                        return;
                    }

                    // resolve 'toVal' (prefer existing canvas item)
                    const foundTarget =
                        existingItemsPool.find(i => i?.Code === toVal || (i?.Name && i.Name.toLowerCase() === toVal.toLowerCase()))
                        || normalizedItems.find(i => i?.Code === toVal || (i?.Name && i.Name.toLowerCase() === toVal.toLowerCase()));

                    if (foundTarget) {
                        normalizedConnections.push(foundTarget.Code || toVal);
                    } else {
                        normalizedConnections.push(toVal);
                    }
                    return;
                }
            });

            // unique and filter
            const uniqueConnections = Array.from(new Set(normalizedConnections)).filter(Boolean);

            // ✅ Create fully normalized item for ItemDetailCard
            const nodeItem = {
                id: null, // will be set when we create node below
                Name: NumberOfItems > 1 ? `${Name} ${codeIdx + 1}` : Name,
                Code: code,
                'Item Code': code,
                Category,
                Type,
                Unit: Unit ?? 'Default Unit',
                SubUnit: SubUnit ?? 'Default SubUnit',
                Sequence: Sequence + codeIdx,
                Connections: uniqueConnections
            };

            // Create new node (only when not in canvas)
            const nodeId = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;
            nodeItem.id = nodeId;

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

            // Add to normalizedItems and maps for later resolution
            normalizedItems.push(nodeItem);
            codeToNodeId.set(code, nodeId);
            codeToItem.set(code, nodeItem);
            if (nodeItem.Name) nameToCode.set(nodeItem.Name.toLowerCase(), code);

            allMessages.push({ sender: "AI", message: `Generated code: ${code}` });
        });

        if (explanation && idx === 0) {
            allMessages.push({ sender: "AI", message: explanation });
        }
    });

    // --------------------------
    // Build edges from explicit normalized `connection` returned by parseItemLogic
    // connection may be raw objects; try to resolve to codes then node ids
    // --------------------------
    if (connection && Array.isArray(connection) && connection.length > 0) {
        // connection may be an array of {from,to} objects — try to handle all
        connection.forEach(rawConn => {
            if (!rawConn) return;
            const fromVal = (rawConn.from || rawConn.fromName || "").toString().trim();
            const toVal = (rawConn.to || rawConn.toName || rawConn.toId || "").toString().trim();
            if (!fromVal || !toVal) return;

            // try to resolve source code (prefer existing canvas)
            let sourceCode =
                (existingItems.find(i => i.Code === fromVal) && fromVal) ||
                (codeToItem.has(fromVal) && fromVal) ||
                // maybe user used name -> try to map name to code
                (nameToCode.get(fromVal.toLowerCase())) ||
                null;

            let targetCode =
                (existingItems.find(i => i.Code === toVal) && toVal) ||
                (codeToItem.has(toVal) && toVal) ||
                (nameToCode.get(toVal.toLowerCase())) ||
                null;

            if (!sourceCode && !targetCode) {
                // fallback: generate codes from parsedItems if names match
                const sourceParsed = parsedItems.find(i => i.Name.toLowerCase() === fromVal.toLowerCase());
                const targetParsed = parsedItems.find(i => i.Name.toLowerCase() === toVal.toLowerCase());
                if (sourceParsed) sourceCode = generateCode(sourceParsed);
                if (targetParsed) targetCode = generateCode(targetParsed);
            }

            // If resolved, map to node ids and add edge
            const sourceNodeId = sourceCode ? codeToNodeId.get(sourceCode) : null;
            const targetNodeId = targetCode ? codeToNodeId.get(targetCode) : null;

            if (sourceNodeId && targetNodeId) {
                const exists = newEdges.some(e => e.source === sourceNodeId && e.target === targetNodeId);
                if (!exists) {
                    newEdges.push({
                        id: `edge-${sourceNodeId}-${targetNodeId}`,
                        source: sourceNodeId,
                        target: targetNodeId,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#888', strokeWidth: 2 },
                    });
                    allMessages.push({ sender: "AI", message: `→ Connected ${sourceCode} → ${targetCode}` });
                }
            }
        });
    }

    // --------------------------
    // Build edges from each nodeItem's Connections (normalizedItems contains newly created items + reused existing items)
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];

    normalizedItems.forEach(item => {
        if (!item.Connections || !Array.isArray(item.Connections)) return;

        item.Connections.forEach(connCodeOrName => {
            // try to resolve to node id by code first, then by name in existing nodes
            let targetNode = allNodesSoFar.find(n => n.data?.item?.Code === connCodeOrName);
            if (!targetNode) {
                targetNode = allNodesSoFar.find(n => n.data?.item?.Name && n.data.item.Name.toLowerCase() === (connCodeOrName || '').toLowerCase());
            }

            const sourceNode = allNodesSoFar.find(n => n.data?.item?.Code === item.Code);

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
                    allMessages.push({
                        sender: "AI",
                        message: `→ Connected ${item.Code} → ${targetNode.data?.item?.Code || targetNode.data?.item?.Name}`
                    });
                }
            }
        });
    });

    // --------------------------
    // Implicit connections (if user wrote "connect" and multiple new nodes exist, chain them in sequence)
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1) {
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
