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
    // prefer parser-resolved connections when available
    const parserConnections = aiResult.connectionResolved || connection || [];


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
                { sender: "AI", message: parsed.message || explanation }
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // 3️⃣ Structured PNID logic
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const newNodes = [];
    const newEdges = []; // only new edges here; we'll return combined [...existingEdges, ...newEdges]
    const allMessages = [{ sender: "User", message: description }];

    // Create nodes / normalizedItems
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
            const nodeId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `ai-${Date.now()}-${Math.random()}`;

            // Normalize connections: map Name/Code → existing item.Code if found
            const normalizedConnections = (p.Connections || []).map(conn => {
                let targetNameOrCode = null;

                if (typeof conn === "string") {
                    targetNameOrCode = conn;
                } else if (typeof conn === "object") {
                    targetNameOrCode = conn.to || conn.toId || conn.toString?.();
                }

                if (!targetNameOrCode) return null;

                const foundItem =
                    [...normalizedItems, ...existingNodes.map(n => n.data?.item)]
                        .find(i => i?.Code === targetNameOrCode || i?.Name === targetNameOrCode);

                return foundItem?.Code || targetNameOrCode;
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
   

    // Build helper maps to resolve codes/names -> node IDs
    const allNodesSoFar = [...existingNodes, ...newNodes];
    const codeToNodeId = new Map();
    const nameToNodeId = new Map();
    allNodesSoFar.forEach(n => {
        const item = n.data?.item;
        if (!item) return;
        if (item.Code !== undefined && item.Code !== null) codeToNodeId.set(String(item.Code), n.id);
        if (item.Name) nameToNodeId.set(String(item.Name).toLowerCase(), n.id);
    });

    // helper to add edge without duplicating (checks existingEdges + newEdges)
    function addEdgeByNodeIds(sourceId, targetId, opts = {}) {
        if (!sourceId || !targetId) return false;
        const exists = [...existingEdges, ...newEdges].some(e => e.source === sourceId && e.target === targetId);
        if (exists) return false;
        newEdges.push({
            id: `edge-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: opts.type || 'smoothstep',
            animated: opts.animated !== undefined ? opts.animated : true,
            style: opts.style || { stroke: '#888', strokeWidth: 2 },
        });
        return true;
    }

    // Resolve a reference (could be code or name) to a canonical code string if possible, otherwise return original
    function resolveCodeString(ref) {
        if (!ref) return null;
        const str = String(ref).trim();
        // first look for exact Code among existing/new items
        const foundItem = [...normalizedItems, ...existingNodes.map(n => n.data?.item)]
            .find(i => String(i?.Code) === str || (i?.Name && i.Name.toLowerCase() === str.toLowerCase()));
        if (foundItem) return String(foundItem.Code);
        return str;
    }

    // --------------------------
    // Handle explicit connections (from parseItemLogic). Prefer these first.
    // --------------------------
    // Handle explicit connections (from parseItemLogic). Prefer these first.
    // But ensure direction follows the parsed-items order (first-mentioned -> second-mentioned).
    // --------------------------
    const explicitConnectionsArr = Array.isArray(connection) ? connection : (connection ? [connection] : []);
    let explicitAddedCount = 0;

    // build a code -> index map based on normalizedItems order (this reflects parsed order)
    const codeToIndex = new Map();
    normalizedItems.forEach((item, idx) => {
        if (item && item.Code !== undefined && item.Code !== null) {
            codeToIndex.set(String(item.Code), idx);
            if (item.Name) {
                // also store by name lowercased so resolveCodeString can find order if needed
                codeToIndex.set(String(item.Name).toLowerCase(), idx);
            }
        }
    });

    explicitConnectionsArr.forEach(connObj => {
        if (!connObj) return;

        // Normalize shapes: either { sourceCode, targetCode } (our normalized shape)
        // or { from, to } coming from Gemini.
        let fromRef = connObj.sourceCode || connObj.from || connObj.fromCode || connObj.source || null;
        let toRef = connObj.targetCode || connObj.to || connObj.toCode || connObj.target || null;

        if (!fromRef || !toRef) return;

        // Resolve to canonical code strings (tries to find existing/new items by name/code)
        const resolvedFromCode = resolveCodeString(fromRef);
        const resolvedToCode = resolveCodeString(toRef);

        // If both resolved codes are found, check their parsed order (if available) and swap if reversed.
        let finalFromCode = resolvedFromCode;
        let finalToCode = resolvedToCode;

        const idxFrom = codeToIndex.has(String(resolvedFromCode)) ? codeToIndex.get(String(resolvedFromCode)) : Infinity;
        const idxTo = codeToIndex.has(String(resolvedToCode)) ? codeToIndex.get(String(resolvedToCode)) : Infinity;

        // If both indexes are finite and the "from" appears after the "to" in parsed order, swap them.
        if (Number.isFinite(idxFrom) && Number.isFinite(idxTo) && idxFrom > idxTo) {
            finalFromCode = resolvedToCode;
            finalToCode = resolvedFromCode;
        }

        // If we couldn't resolve codes, fallback to parsedItems order (if there are at least 2 items)
        if ((!finalFromCode || !finalToCode) && parsedItems.length >= 2) {
            const firstCode = normalizedItems[0]?.Code;
            const secondCode = normalizedItems[1]?.Code;
            if (firstCode && secondCode) {
                finalFromCode = String(firstCode);
                finalToCode = String(secondCode);
            }
        }

        const srcNodeId = codeToNodeId.get(String(finalFromCode));
        const tgtNodeId = codeToNodeId.get(String(finalToCode));

        if (srcNodeId && tgtNodeId) {
            const added = addEdgeByNodeIds(srcNodeId, tgtNodeId, { type: 'smoothstep' });
            if (added) {
                allMessages.push({ sender: "AI", message: `→ Connected ${finalFromCode} → ${finalToCode}` });
                explicitAddedCount++;
            }
        }
    });

    // Build edges from each item's Connections
    // If explicit connections were present, skip per-item connections to avoid duplicates/reversed edges.
    // --------------------------
    if (explicitAddedCount === 0) {
        // No explicit connections added → fall back to per-item Connections
        normalizedItems.forEach(item => {
            if (!item.Connections || !Array.isArray(item.Connections)) return;

            item.Connections.forEach(connTarget => {
                if (!connTarget) return;

                const resolvedTargetCode = resolveCodeString(connTarget);
                const sourceNodeId = codeToNodeId.get(String(item.Code));
                const targetNodeId = codeToNodeId.get(String(resolvedTargetCode));

                if (sourceNodeId && targetNodeId) {
                    const added = addEdgeByNodeIds(sourceNodeId, targetNodeId, { type: 'smoothstep' });
                    if (added) {
                        allMessages.push({
                            sender: "AI",
                            message: `→ Connected ${item.Code} → ${resolvedTargetCode}`
                        });
                    }
                }
            });
        });
    } else {
        allMessages.push({ sender: "AI", message: `→ Skipped per-item Connections because explicit connection(s) were provided.` });
    }

    // --------------------------
    // Implicit connections (chain all new items) — only when user asked to "connect" and there were no explicit connections
    // --------------------------
    if (/connect/i.test(description) && explicitAddedCount === 0 && newNodes.length > 1) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            addEdgeByNodeIds(newNodes[i].id, newNodes[i + 1].id, { animated: true });
        }
        allMessages.push({ sender: "AI", message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    allMessages.push({ sender: "AI", message: `→ Generated ${newNodes.length} total item(s)` });

    if (typeof setChatMessages === "function" && allMessages.length > 0) {
        setChatMessages(prev => [...prev, ...allMessages]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: [...existingEdges, ...newEdges],
        normalizedItems,
        messages: allMessages,
    };
}
const { nodes: aiNodes, edges: aiEdges, normalizedItems } = await AIPNIDGenerator(parsedOrders);

// merge aiEdges into rebuiltEdges (avoid duplicates)
const mergedEdges = [...rebuiltEdges];
(aiEdges || []).forEach(e => {
    if (!mergedEdges.some(me => me.id === e.id)) mergedEdges.push(e);
});
setEdges(mergedEdges);
