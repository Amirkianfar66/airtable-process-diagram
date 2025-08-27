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

        // Return existing nodes/edges since we don't add new items in action
        return { nodes: existingNodes, edges: existingEdges };
    }

    // Chat mode → show chat
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

    // 3️⃣ Structured PNID logic
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const newNodes = []; // only nodes created by AI during this call
    const newEdges = [...existingEdges];
    const allMessages = [{ sender: "User", message: description }];

    // Helper: map existing node Codes -> node
    const existingItemsMapByCode = new Map();
    const existingItemsMapByName = new Map();
    existingNodes.forEach(n => {
        const item = n.data?.item;
        if (!item) return;
        if (item.Code) existingItemsMapByCode.set(item.Code.toString(), n);
        if (item.Name) existingItemsMapByName.set(item.Name.toString().toLowerCase(), n);
    });

    // Create or reuse nodes for each parsed item
    parsedItems.forEach((p, idx) => {
        const Name = (p.Name || description).toString().trim();
        const Category = p.Category && p.Category !== '' ? p.Category : 'Equipment';
        const Type = p.Type && p.Type !== '' ? p.Type : 'Generic';
        const NumberOfItems = p.Number && p.Number > 0 ? p.Number : 1;

        const Unit = p.Unit ?? 0;
        const SubUnit = p.SubUnit ?? 0;
        const Sequence = p.Sequence ?? 1;

        // Generate base code and optionally additional codes
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

        // For each code: if an existing node with that code exists, reuse it.
        allCodes.forEach((code, codeIdx) => {
            // try to find existing node by Code
            const existingNode = existingItemsMapByCode.get(String(code));
            if (existingNode) {
                // reuse existing node (do not recreate)
                const existingItem = existingNode.data?.item;
                // ensure normalizedItems includes this item so edges can be built
                normalizedItems.push(existingItem);
                allMessages.push({ sender: "AI", message: `Reused existing item: ${code} (${existingItem.Name})` });
                return;
            }

            // Not found in existing nodes → create new node
            const nodeId = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}-${Math.random()}`;

            // temporarily map connections to raw target name/code string (we'll resolve after creating all nodes)
            const rawConnections = (p.Connections || []).map(conn => {
                if (typeof conn === "string") return conn;
                if (typeof conn === "object") return conn.to || conn.toId || conn.toName || null;
                return null;
            }).filter(Boolean);

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
                Connections: rawConnections // store raw strings for post-resolution
            };

            // push to newNodes and normalizedItems
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

    // Build a lookup of code => node (look in existingNodes and newNodes)
    const allNodesSoFar = [...existingNodes, ...newNodes];
    const codeToNode = new Map();
    const nameToNode = new Map();
    allNodesSoFar.forEach(n => {
        const it = n.data?.item;
        if (!it) return;
        if (it.Code) codeToNode.set(String(it.Code), n);
        if (it.Name) nameToNode.set(String(it.Name).toLowerCase(), n);
    });

    // Post-process normalizedItems' Connections: convert names -> codes, create placeholders if necessary
    for (let i = 0; i < normalizedItems.length; i++) {
        const item = normalizedItems[i];
        if (!item.Connections || !Array.isArray(item.Connections)) continue;

        const resolved = [];
        for (const raw of item.Connections) {
            if (!raw) continue;
            const rawStr = String(raw).trim();

            // 1) if it's already a code and exists -> keep code
            if (codeToNode.has(rawStr)) {
                resolved.push(rawStr);
                continue;
            }

            // 2) if a node exists with that name -> convert to its code
            const byName = nameToNode.get(rawStr.toLowerCase());
            if (byName && byName.data?.item?.Code) {
                resolved.push(String(byName.data.item.Code));
                continue;
            }

            // 3) if raw looks like a 4-digit code but doesn't exist in canvas -> create placeholder node with that Code
            if (/^[0-9]{4}$/.test(rawStr)) {
                // create placeholder only if not already created
                if (!codeToNode.has(rawStr)) {
                    const placeholderId = crypto.randomUUID ? crypto.randomUUID() : `ai-ph-${Date.now()}-${Math.random()}`;
                    const placeholderItem = {
                        id: placeholderId,
                        Name: rawStr, // fallback name is the code
                        Code: rawStr,
                        'Item Code': rawStr,
                        Category: 'Equipment',
                        Type: 'Generic',
                        Unit: 0,
                        SubUnit: 0,
                        Sequence: 1,
                        Connections: []
                    };
                    const placeholderNode = {
                        id: placeholderId,
                        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                        data: { label: `${placeholderItem.Code} - ${placeholderItem.Name}`, item: placeholderItem, icon: getItemIcon(placeholderItem) },
                        type: categoryTypeMap[placeholderItem.Category] || 'scalableIcon',
                    };
                    newNodes.push(placeholderNode);
                    normalizedItems.push(placeholderItem);
                    codeToNode.set(rawStr, placeholderNode);
                    nameToNode.set(String(placeholderItem.Name).toLowerCase(), placeholderNode);
                    allMessages.push({ sender: "AI", message: `→ Created placeholder for missing code ${rawStr}` });
                }
                resolved.push(rawStr);
                continue;
            }

            // 4) otherwise treat as name: if not found create placeholder (name -> generated code)
            const nameKey = rawStr.toLowerCase();
            if (!nameToNode.has(nameKey)) {
                // generate a code for placeholder using a fallback deterministic method (so repeated calls map to same code in this run)
                const fallbackCode = generateCode({ Category: 'Equipment', Type: 'Generic', Unit: 0, SubUnit: 0, Sequence: 9, Number: Math.floor(Math.random() * 90) + 10 });
                const phId = crypto.randomUUID ? crypto.randomUUID() : `ai-ph-${Date.now()}-${Math.random()}`;
                const placeholderItem = {
                    id: phId,
                    Name: rawStr,
                    Code: fallbackCode,
                    'Item Code': fallbackCode,
                    Category: 'Equipment',
                    Type: 'Generic',
                    Unit: 0,
                    SubUnit: 0,
                    Sequence: 1,
                    Connections: []
                };
                const placeholderNode = {
                    id: phId,
                    position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                    data: { label: `${placeholderItem.Code} - ${placeholderItem.Name}`, item: placeholderItem, icon: getItemIcon(placeholderItem) },
                    type: categoryTypeMap[placeholderItem.Category] || 'scalableIcon',
                };
                newNodes.push(placeholderNode);
                normalizedItems.push(placeholderItem);
                codeToNode.set(String(placeholderItem.Code), placeholderNode);
                nameToNode.set(nameKey, placeholderNode);
                allMessages.push({ sender: "AI", message: `→ Created placeholder for missing item "${rawStr}" as ${placeholderItem.Code}` });
                resolved.push(String(placeholderItem.Code));
            } else {
                const found = nameToNode.get(nameKey);
                resolved.push(String(found.data.item.Code));
            }
        }

        // replace with resolved codes
        item.Connections = Array.from(new Set(resolved)); // dedupe
    }

    // --------------------------
    // Explicit connection param (from parseItemLogic)
    // --------------------------
    if (connection && connection.sourceCode && connection.targetCode) {
        const sourceNode = codeToNode.get(String(connection.sourceCode));
        const targetNode = codeToNode.get(String(connection.targetCode));

        if (sourceNode && targetNode) {
            const exists = newEdges.some(e => e.source === sourceNode.id && e.target === targetNode.id);
            if (!exists) {
                newEdges.push({
                    id: `edge-${sourceNode.id}-${targetNode.id}`,
                    source: sourceNode.id,
                    target: targetNode.id,
                    animated: true,
                    type: 'smoothstep',
                    style: { stroke: '#888', strokeWidth: 2 },
                });
            }
            allMessages.push({ sender: "AI", message: `→ Connected ${connection.sourceCode} → ${connection.targetCode}` });
        }
    }

    // --------------------------
    // Build edges from each item's Connections
    // --------------------------
    const finalAllNodes = [...existingNodes, ...newNodes];

    // helper to find node by code or name
    const findNodeByCodeOrName = key => {
        // search code
        const byCode = finalAllNodes.find(n => n.data?.item?.Code === key);
        if (byCode) return byCode;
        // search name
        return finalAllNodes.find(n => String(n.data?.item?.Name).toLowerCase() === String(key).toLowerCase());
    };

    normalizedItems.forEach(item => {
        if (!item.Connections || !Array.isArray(item.Connections)) return;

        item.Connections.forEach(connCode => {
            const sourceNode = finalAllNodes.find(n => n.data?.item?.Code === item.Code);
            const targetNode = findNodeByCodeOrName(connCode);

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
                        message: `→ Connected ${item.Code} → ${connCode}`
                    });
                }
            }
        });
    });

    // --------------------------
    // Implicit chaining if user asked "connect" and newNodes created
    // (only chain AI-created nodes in order)
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            const a = newNodes[i];
            const b = newNodes[i + 1];
            const exists = newEdges.some(e => e.source === a.id && e.target === b.id);
            if (!exists) {
                newEdges.push({
                    id: `edge-${a.id}-${b.id}`,
                    source: a.id,
                    target: b.id,
                    animated: true
                });
            }
        }
        allMessages.push({ sender: "AI", message: `→ Automatically connected ${newNodes.length} AI-created nodes in sequence.` });
    }

    allMessages.push({ sender: "AI", message: `→ Generated ${newNodes.length} total new item(s)` });

    if (typeof setChatMessages === "function" && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: newEdges,
        normalizedItems
    };
}
