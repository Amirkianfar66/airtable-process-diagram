// File: src/utils/AIPNIDGenerator.js
// ===================================
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
                border: '2px solid #007bff',
                borderRadius: 8,
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#f9f9f9',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}
        >
            {messages.map((msg, index) => {
                const isUser = msg.sender === 'User';
                return (
                    <div
                        key={index}
                        style={{
                            alignSelf: isUser ? 'flex-start' : 'flex-end',
                            backgroundColor: isUser ? '#e0f0ff' : '#007bff',
                            color: isUser ? 'black' : 'white',
                            padding: '8px 12px',
                            borderRadius: 16,
                            maxWidth: '70%',
                            wordWrap: 'break-word',
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
// AI PNID generator
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

    // 1️⃣ Parse with AI
    let aiResult;
    try {
        aiResult = await parseItemLogic(description);

        // Normalize shape if AI returns array
        if (Array.isArray(aiResult)) {
            aiResult = {
                mode: 'structured',
                items: aiResult,
                parsed: aiResult,
                explanation: null,
                connectionResolved: [],
            };
        }
    } catch (err) {
        console.error('❌ AI parse failed:', err);
        if (typeof setChatMessages === 'function') {
            setChatMessages((prev) => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: '⚠️ AI processing failed.' },
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    const { mode, explanation } = aiResult || {};

    // Fallbacks for parsed items
    const parsedItems =
        Array.isArray(aiResult?.items) && aiResult.items.length > 0
            ? aiResult.items
            : Array.isArray(aiResult?.parsed)
                ? aiResult.parsed
                : aiResult?.parsed
                    ? [aiResult.parsed]
                    : [];

    // Parser-provided connections
    const parserConnections =
        aiResult?.connectionResolved ||
        aiResult?.connections ||
        aiResult?.connection ||
        [];

    // Handle "action" mode
    if (aiResult?.mode === 'action') {
        const action = aiResult.action;
        const msg = `⚡ Action triggered: ${action}`;
        if (typeof setChatMessages === 'function') {
            setChatMessages((prev) => [...prev, { sender: 'User', message: description }, { sender: 'AI', message: msg }]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // Handle "chat" mode
    if (mode === 'chat') {
        if (typeof setChatMessages === 'function') {
            setChatMessages((prev) => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: aiResult?.parsed?.message || explanation },
            ]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

    // --------------------------
    // Build nodes
    // --------------------------
    const newNodes = [];
    const newEdges = [...existingEdges];
    const normalizedItems = [];
    const allMessages = [{ sender: 'User', message: description }];

    // Expand Number into multiple clones if needed
    const expandedItems = [];
    parsedItems.forEach((p) => {
        const qty = Math.max(1, parseInt(p?.Number ?? 1, 10));

        // ✅ Chat feedback about quantity
        if (qty > 1) {
            allMessages.push({
                sender: 'AI',
                message: `I understood that you want ${qty} items of type "${p.Name || p.Type || 'Item'}".`
            });

            const conns = Array.isArray(p.Connections) ? p.Connections : [];
            if (conns.length > 0) {
                allMessages.push({
                    sender: 'AI',
                    message: `These items should be connected to: ${conns.join(', ')}`
                });
            }
        } // <- closes the qty>1 if correctly

        for (let i = 0; i < qty; i++) {
            expandedItems.push({
                ...p,
                Sequence: (p.Sequence ?? 1) + i,
                // Name is exactly the Type (no numbers). Fallback to Type if Name missing.
                Name: (p.Type || p.Name || 'Item'),
                Number: 1, // clones are 1 each
            });
        }

    });

    expandedItems.forEach((p, idx) => {
        const {
            Name,
            Category = 'Default',
            Type = 'Generic',
            Unit = 'Default Unit',
            SubUnit = 'Default SubUnit',
            Sequence,
        } = p;

        const code = generateCode(p, itemsLibrary, existingNodes, normalizedItems);

        const nodeId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `ai-${Date.now()}-${Math.random()}`;

        const nodeItem = {
            id: nodeId,
            Name,
            Code: code,
            'Item Code': code,
            Category,
            Type,
            Unit,
            SubUnit,
            Sequence,
            Connections: Array.isArray(p?.Connections) ? [...p.Connections] : [],
        };

        newNodes.push({
            id: nodeId,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: { label: `${nodeItem.Code} - ${nodeItem.Name}`, item: nodeItem, icon: getItemIcon(nodeItem) },
            type: categoryTypeMap[Category] || 'scalableIcon',
        });

        normalizedItems.push(nodeItem);
        if (code) allMessages.push({ sender: 'AI', message: `Generated code: ${code}` });

        if (explanation && idx === 0) {
            allMessages.push({ sender: 'AI', message: explanation });
        }
    });

    // --------------------------
    // Build maps for lookups (robust + normalized keys)
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];
    const codeToNodeId = new Map();    // key: trimmed code string -> nodeId
    const nameToNodeIds = new Map();   // key: trimmed lowercased name -> array of nodeIds
    const typeToNodeIds = new Map();   // key: trimmed lowercased type -> array of nodeIds

    allNodesSoFar.forEach((n) => {
        const item = n?.data?.item;
        if (!item) return;

        const possibleCode =
            (item.Code ?? item['Item Code'] ?? item['ItemCode'] ?? item.code ?? '').toString().trim();
        if (possibleCode) codeToNodeId.set(possibleCode, n.id);

        if (item.Name) {
            const nm = String(item.Name).trim().toLowerCase();
            if (nm) {
                if (!nameToNodeIds.has(nm)) nameToNodeIds.set(nm, []);
                nameToNodeIds.get(nm).push(n.id);
            }
        }

        if (item.Type) {
            const tp = String(item.Type).trim().toLowerCase();
            if (!typeToNodeIds.has(tp)) typeToNodeIds.set(tp, []);
            typeToNodeIds.get(tp).push(n.id);
        }
    });

    // debug dump (optional) — remove or comment out in production
    console.debug('lookup maps', {
        codes: [...codeToNodeId.keys()],
        names: [...nameToNodeIds.keys()],
        types: [...typeToNodeIds.keys()],
    });

    // Safe edge adder (prefers existing helper but falls back)
    function addEdgeSafely(sourceId, targetId, opts = {}) {
        if (!sourceId || !targetId) return false;

        if (typeof addEdgeByNodeIds === 'function') {
            try {
                return addEdgeByNodeIds(sourceId, targetId, opts);
            } catch (e) {
                console.warn('addEdgeByNodeIds threw, fallback will be used', e);
            }
        }

        const exists = newEdges.some((e) => e.source === sourceId && e.target === targetId);
        if (exists) return false;
        newEdges.push({
            id: `edge-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: opts.type || 'smoothstep',
            animated: opts.animated ?? true,
            style: opts.style || { stroke: '#888', strokeWidth: 2 },
        });
        return true;
    }

    // Resolve textual ref -> canonical code or name (string only)
    function resolveCodeOrName(ref) {
        if (!ref) return null;
        const raw = String(ref).trim();
        if (!raw) return null;

        // 1) exact code
        if (codeToNodeId.has(raw)) return raw;

        // 2) exact name (case-insensitive)
        const nameKey = raw.toLowerCase();
        if (nameToNodeIds.has(nameKey)) {
            // return code of the first node that has this name if available
            const nodeIds = nameToNodeIds.get(nameKey);
            const nodeId = nodeIds && nodeIds[0];
            if (nodeId) {
                for (const [codeKey, id] of codeToNodeId.entries()) {
                    if (id === nodeId) return codeKey;
                }
            }
            // otherwise return the raw name (caller may try name lookup)
            return raw;
        }

        // 3) match by Type (return code of first node for that type if available)
        if (typeToNodeIds.has(nameKey)) {
            const nodeId = typeToNodeIds.get(nameKey)[0];
            if (nodeId) {
                for (const [codeKey, id] of codeToNodeId.entries()) {
                    if (id === nodeId) return codeKey;
                }
                // if no code found, try return node's Name if present
                const node = allNodesSoFar.find((n) => n.id === nodeId);
                if (node && node.data?.item) {
                    const alt = (node.data.item.Code ?? node.data.item['Item Code'] ?? node.data.item.Name ?? '').toString().trim();
                    if (alt) return alt;
                }
            }
            // fallback to raw
            return raw;
        }

        // 4) search normalizedItems (match Code, Name, Type)
        const foundInNormalized = normalizedItems.find((i) => {
            const iCode = (i?.Code ?? i?.['Item Code'] ?? '').toString().trim();
            if (iCode && iCode === raw) return true;
            if (i?.Name && i.Name.toString().trim().toLowerCase() === nameKey) return true;
            if (i?.Type && i.Type.toString().trim().toLowerCase() === nameKey) return true;
            return false;
        });
        if (foundInNormalized) {
            const iCode = (foundInNormalized.Code ?? foundInNormalized['Item Code'] ?? '').toString().trim();
            if (iCode) return iCode;
            return String(foundInNormalized.Name || foundInNormalized.Type || raw).trim();
        }

        // 5) fallback
        return raw;
    }

    // get nodeId by code | name | type. name returns first matching nodeId deterministically.
    function getNodeIdForRef(ref) {
        if (!ref) return null;
        const trimmed = String(ref).trim();
        if (!trimmed) return null;

        // accept direct node id if passed
        if (allNodesSoFar.some((n) => n.id === trimmed)) return trimmed;

        // try exact code
        if (codeToNodeId.has(trimmed)) return codeToNodeId.get(trimmed);

        // try name (first id)
        const nameArr = nameToNodeIds.get(trimmed.toLowerCase());
        if (nameArr && nameArr.length > 0) return nameArr[0];

        // try type -> first node id
        const maybeType = trimmed.toLowerCase();
        if (typeToNodeIds.has(maybeType) && typeToNodeIds.get(maybeType).length > 0) {
            return typeToNodeIds.get(maybeType)[0];
        }

        return null;
    }

    // --------------------------
    // Use parser connections if available
    // --------------------------
    if (Array.isArray(parserConnections) && parserConnections.length > 0) {
        allMessages.push({ sender: 'AI', message: `I understood the following connections:` });

        parserConnections.forEach((c) => {
            const rawFrom = (c.from ?? c.source ?? c.fromName ?? c.fromCode ?? '').toString().trim();
            const rawTo = (c.to ?? c.target ?? c.toName ?? c.toCode ?? '').toString().trim();

            const fromRef = resolveCodeOrName(rawFrom);
            const toRef = resolveCodeOrName(rawTo);

            const srcId = getNodeIdForRef(fromRef) || getNodeIdForRef(rawFrom);
            const tgtId = getNodeIdForRef(toRef) || getNodeIdForRef(rawTo);

            if (srcId && tgtId) {
                const added = addEdgeSafely(srcId, tgtId);
                if (added) {
                    allMessages.push({ sender: 'AI', message: `${rawFrom} → ${rawTo}` });
                }
            } else {
                console.debug('AI connection unresolved:', { rawFrom, rawTo, fromRef, toRef, srcId, tgtId });
            }
        });
    }

    // --------------------------
    // Fallback: item.Connections (try code/name/type lookups)
    // --------------------------
    if (newEdges.length === existingEdges.length) {
        normalizedItems.forEach((item) => {
            const srcId = getNodeIdForRef(item.Code ?? item['Item Code'] ?? item.Name ?? item.Type);
            (Array.isArray(item.Connections) ? item.Connections : []).forEach((conn) => {
                const targetRef = resolveCodeOrName(conn);
                const tgtId = getNodeIdForRef(targetRef) || getNodeIdForRef(conn);
                if (srcId && tgtId) {
                    const added = addEdgeSafely(srcId, tgtId);
                    if (added) {
                        allMessages.push({ sender: 'AI', message: `→ Connected ${item.Code} → ${targetRef}` });
                    }
                } else {
                    console.debug('Fallback connection unresolved:', { itemCode: item.Code, conn, targetRef, srcId, tgtId });
                }
            });
        });
    }

    // --------------------------
    // Auto-connect chain if user asked
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1 && (newEdges.length === existingEdges.length)) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            addEdgeSafely(newNodes[i].id, newNodes[i + 1].id);
        }
        allMessages.push({ sender: 'AI', message: `→ Auto-connected ${newNodes.length} nodes.` });
    }

    // ✅ Summary
    allMessages.push({ sender: 'AI', message: `→ Generated ${newNodes.length} item(s) and ${newEdges.length - existingEdges.length} connection(s).` });

    if (typeof setChatMessages === 'function') {
        setChatMessages((prev) => [...prev, ...allMessages]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: newEdges,
        normalizedItems,
        messages: allMessages,
    };
}
