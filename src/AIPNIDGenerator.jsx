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

    // detect whether user explicitly asked to connect (affects direction policy)
    const isConnectCommand = /connect/i.test(description);

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

    // Chat mode -> show chat and return
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

    // build quick lookup of existing nodes by code/name
    const existingItems = existingNodes.map(n => n.data?.item).filter(Boolean);
    const codeToNodeId = new Map();
    const codeToItem = new Map();
    const nameToCode = new Map();

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

    // helper to compute PNID code like parse-item
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

    // pre-fill name->code for parsed items
    parsedItems.forEach(it => {
        const code = makeCodeForParsed(it);
        if (it.Name) nameToCode.set(it.Name.toLowerCase(), code);
    });

    // A set to track edges we've already added (sourceId|targetId)
    const addedEdges = new Set();

    // central helper for adding an edge while respecting dedupe and "connect" directionality
    function addEdge(sourceId, targetId, meta = {}) {
        if (!sourceId || !targetId) return false;
        const key = `${sourceId}|${targetId}`;
        const reverseKey = `${targetId}|${sourceId}`;

        // skip duplicate exact edge
        if (addedEdges.has(key)) return false;

        // If user asked to "connect" explicitly, avoid creating the reverse if it exists
        if (isConnectCommand && addedEdges.has(reverseKey)) {
            // don't add reverse if the forward edge is already present (respect original direction)
            return false;
        }

        // otherwise we still allow reverse if not a connect command (user might intend bi-directional)
        if (addedEdges.has(reverseKey) && isConnectCommand === false) {
            // allow both directions if explicitly produced by AI and not a simple "connect" command
            // but avoid duplicate of this same direction
        }

        // add edge
        newEdges.push({
            id: `edge-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: meta.type || 'smoothstep',
            animated: meta.animated !== undefined ? meta.animated : true,
            style: meta.style || { stroke: '#888', strokeWidth: 2 },
        });
        addedEdges.add(key);
        return true;
    }

    // Process parsed items -> create nodes only if not present in canvas
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

        // Optionally additional codes
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
            // reuse existing canvas node if code exists
            if (codeToNodeId.has(code)) {
                const existingItem = codeToItem.get(code);
                if (existingItem && !normalizedItems.find(it => it.Code === code)) normalizedItems.push(existingItem);
                allMessages.push({ sender: "AI", message: `Reused existing code: ${code}` });
                return;
            }

            // normalize connections on the parsed object (we'll resolve to codes later)
            const normalizedConnections = (p.Connections || []).map(conn => {
                let targetNameOrCode = null;

                if (typeof conn === "string") {
                    targetNameOrCode = conn;
                } else if (typeof conn === "object") {
                    targetNameOrCode = conn.to || conn.toId || conn.toName;
                }

                if (!targetNameOrCode) return null;

                // prefer existing items first
                const foundItem =
                    [...normalizedItems, ...existingNodes.map(n => n.data?.item)]
                        .find(i => i?.Code === targetNameOrCode || i?.Name === targetNameOrCode);

                return foundItem?.Code || targetNameOrCode;
            }).filter(Boolean);

            const nodeId = crypto?.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;

            const nodeItem = {
                id: nodeId,
                Name: NumberOfItems > 1 ? `${Name} ${codeIdx + 1}` : Name,
                Code: code,
                'Item Code': code,
                Category,
                Type,
                Unit: Unit ?? 'Default Unit',
                SubUnit: SubUnit ?? 'Default SubUnit',
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
    // Use connections produced by parseItemLogic if any (these are objects like {from, to})
    // --------------------------
    const rawConnections = Array.isArray(connection) ? connection : (connection ? [connection] : []);
    rawConnections.forEach(conn => {
        if (!conn) return;
        const fromVal = (conn.from || '').toString().trim();
        const toVal = (conn.to || '').toString().trim();
        if (!fromVal || !toVal) return;

        // Try to resolve names to codes
        let sourceCode = fromVal;
        let targetCode = toVal;

        if (!codeToNodeId.has(sourceCode) && nameToCode.has(sourceCode.toLowerCase())) {
            sourceCode = nameToCode.get(sourceCode.toLowerCase());
        }
        if (!codeToNodeId.has(targetCode) && nameToCode.has(targetCode.toLowerCase())) {
            targetCode = nameToCode.get(targetCode.toLowerCase());
        }

        // fallback: try matching parsedItems by name and compute code
        const parsedSource = parsedItems.find(i => i.Name && i.Name.toLowerCase() === (fromVal || '').toLowerCase());
        const parsedTarget = parsedItems.find(i => i.Name && i.Name.toLowerCase() === (toVal || '').toLowerCase());
        if (!codeToNodeId.has(sourceCode) && parsedSource) sourceCode = makeCodeForParsed(parsedSource);
        if (!codeToNodeId.has(targetCode) && parsedTarget) targetCode = makeCodeForParsed(parsedTarget);

        const sourceNodeId = codeToNodeId.get(sourceCode);
        const targetNodeId = codeToNodeId.get(targetCode);

        if (sourceNodeId && targetNodeId) {
            const added = addEdge(sourceNodeId, targetNodeId, { type: 'smoothstep' });
            if (added) allMessages.push({ sender: "AI", message: `→ Connected ${sourceCode} → ${targetCode}` });
        }
    });

    // --------------------------
    // Build edges from each nodeItem's Connections (normalizedItems are newly created + reused)
    // Respect connect-command directionality via addEdge's logic.
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];

    normalizedItems.forEach(item => {
        if (!item.Connections || !Array.isArray(item.Connections)) return;

        item.Connections.forEach(connTarget => {
            if (!connTarget) return;

            // resolve connTarget to node
            let targetNode = allNodesSoFar.find(n => n.data?.item?.Code === connTarget);
            if (!targetNode) {
                targetNode = allNodesSoFar.find(n => {
                    const nm = n.data?.item?.Name;
                    return nm && nm.toLowerCase() === (connTarget || '').toLowerCase();
                });
            }

            const sourceNode = allNodesSoFar.find(n => n.data?.item?.Code === item.Code);

            if (sourceNode && targetNode) {
                const added = addEdge(sourceNode.id, targetNode.id, { type: 'smoothstep' });
                if (added) {
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
    // chain in newNodes order only (first → second → ...)
    // this respects addEdge's dedupe and isConnectCommand behavior
    // --------------------------
    if (isConnectCommand && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            addEdge(newNodes[i].id, newNodes[i + 1].id, { type: 'smoothstep' });
        }
        allMessages.push({ sender: "AI", message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    allMessages.push({ sender: "AI", message: `→ Generated ${newNodes.length} total item(s)` });

    if (typeof setChatMessages === "function" && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return { nodes: [...existingNodes, ...newNodes], edges: newEdges, normalizedItems };
}
