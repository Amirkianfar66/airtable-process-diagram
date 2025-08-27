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
                connection: null,
                connectionResolved: []
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

    const { mode, explanation, parsed = {}, connection, connectionResolved = [] } = aiResult;

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

        return { nodes: existingNodes, edges: existingEdges };
    }

    // Chat mode
    if (mode === "chat") {
        if (typeof setChatMessages === "function") {
            setChatMessages(prev => [
                ...prev,
                { sender: "User", message: description },
                { sender: "AI", message: parsed?.message || explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // Structured PNID logic
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const newNodes = [];
    const newEdges = [...existingEdges];
    const allMessages = [{ sender: "User", message: description }];

    // Build quick lookup of existing nodes by code (prefer canvas)
    const existingItems = existingNodes.map(n => n.data?.item).filter(Boolean);
    const codeToNodeId = new Map();   // code => nodeId (includes existing)
    const codeToItem = new Map();     // code => item object
    const nameToCode = new Map();     // name(lower) => code

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

    // Helper to compute PNID code same way parse-item does
    function makeCodeForParsed(item) {
        return generateCode({
            Category: item.Category || 'Equipment',
            Type: item.Type || 'Generic',
            Unit: item.Unit ?? 0,
            SubUnit: item.SubUnit ?? 0,
            Sequence: item.Sequence ?? 1,
            Number: item.Number ?? 1,
            SensorType: item.SensorType || ''
        });
    }

    // Pre-fill name -> code based on parsedItems
    parsedItems.forEach(it => {
        const code = makeCodeForParsed(it);
        if (it.Name) nameToCode.set(it.Name.toLowerCase(), code);
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
                if (!normalizedItems.find(it => it.Code === code)) normalizedItems.push(existingItem);
                allMessages.push({ sender: "AI", message: `Reused existing code: ${code}` });
                return;
            }

            // Normalize connections declared on this parsed object (we don't use raw 'connection' here)
            const normalizedConnections = (p.Connections || []).map(conn => {
                if (!conn) return null;
                if (typeof conn === "string") {
                    // string might be "A to B" or a name — but final resolution will happen later
                    return conn.trim();
                } else if (typeof conn === "object") {
                    // If AI gave object connections like { from: "Tank", to: "Pump" }, only keep outgoing where 'from' matches this parsed item
                    const fromVal = (conn.from || conn.fromName || "").toString().trim();
                    const toVal = (conn.to || conn.toName || conn.toId || "").toString().trim();
                    // if fromVal matches this parsed item name or code, it's an outgoing
                    const thisIsSource = (fromVal && (fromVal.toLowerCase() === (p.Name || '').toLowerCase())) || fromVal === code || fromVal === makeCodeForParsed(p);
                    if (thisIsSource && toVal) {
                        // prefer parsed name->code mapping if available
                        return nameToCode.get(toVal.toLowerCase()) || toVal;
                    }
                    return null;
                }
                return null;
            }).filter(Boolean);

            const uniqueConnections = Array.from(new Set(normalizedConnections)).filter(Boolean);

            // ✅ Create fully normalized item for ItemDetailCard
            const nodeItem = {
                id: null,
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
    // Use the resolved connections from API (connectionResolved) first if present.
    // connectionResolved entries are { from: codeOrName, to: codeOrName }
    // --------------------------
    const connectionArray = Array.isArray(connectionResolved) && connectionResolved.length > 0
        ? connectionResolved
        : (Array.isArray(connection) ? connection : []);

    if (connectionArray && connectionArray.length > 0) {
        connectionArray.forEach(conn => {
            if (!conn) return;
            const fromVal = (conn.from || '').toString().trim();
            const toVal = (conn.to || '').toString().trim();
            if (!fromVal || !toVal) return;

            // Resolve source/target to known codes (prefer existing canvas codeToNodeId)
            let sourceCode = fromVal;
            let targetCode = toVal;

            // If the from/to look like a parsed name, map to code
            if (!codeToNodeId.has(sourceCode) && nameToCode.has(sourceCode.toLowerCase())) {
                sourceCode = nameToCode.get(sourceCode.toLowerCase());
            }
            if (!codeToNodeId.has(targetCode) && nameToCode.has(targetCode.toLowerCase())) {
                targetCode = nameToCode.get(targetCode.toLowerCase());
            }

            // If still not a code but matches parsedItems names, convert
            const parsedSource = parsedItems.find(i => i.Name && i.Name.toLowerCase() === (fromVal || '').toLowerCase());
            const parsedTarget = parsedItems.find(i => i.Name && i.Name.toLowerCase() === (toVal || '').toLowerCase());
            if (!codeToNodeId.has(sourceCode) && parsedSource) sourceCode = makeCodeForParsed(parsedSource);
            if (!codeToNodeId.has(targetCode) && parsedTarget) targetCode = makeCodeForParsed(parsedTarget);

            const sourceNodeId = codeToNodeId.get(sourceCode);
            const targetNodeId = codeToNodeId.get(targetCode);

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

        item.Connections.forEach(connTarget => {
            if (!connTarget) return;
            // try to resolve connTarget to code first, then name
            let targetNode = allNodesSoFar.find(n => n.data?.item?.Code === connTarget);
            if (!targetNode) {
                targetNode = allNodesSoFar.find(n => {
                    const nm = n.data?.item?.Name;
                    return nm && nm.toLowerCase() === (connTarget || '').toLowerCase();
                });
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
                    ani
