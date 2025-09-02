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
                Name: qty > 1 ? `${p.Name || p.Type || 'Item'}_${i + 1}` : p.Name,
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
    const nameToNodeId = new Map();    // key: trimmed lowercased name -> nodeId
    const typeToNodeIds = new Map();   // key: trimmed lowercased type -> array of nodeIds

    allNodesSoFar.forEach((n) => {
        const item = n?.data?.item;
        if (!item) return;

        const possibleCode =
            (item.Code ?? item['Item Code'] ?? item['ItemCode'] ?? item.code ?? '').toString().trim();
        if (possibleCode) codeToNodeId.set(possibleCode, n.id);

        if (item.Name) {
            const nm = String(item.Name).trim();
            if (nm) nameToNodeId.set(nm.toLowerCase(), n.id);
        }

        if (item.Type) {
            const tp = String(item.Type).trim().toLowerCase();
            if (!typeToNodeIds.has(tp)) typeToNodeIds.set(tp, []);
            typeToNodeIds.get(tp).push(n.id);
        }
    });

    // Safe edge-adder that falls back if addEdgeByNodeIds is missing
    function addEdgeSafely(sourceId, targetId, opts = {}) {
        if (!sourceId || !targetId) return false;

        // If original helper exists, prefer it
        if (typeof addEdgeByNodeIds === 'function') {
            try {
                return addEdgeByNodeIds(sourceId, targetId, opts);
            } catch (err) {
                console.warn('addEdgeByNodeIds threw, falling back:', err);
            }
        }

        // Local fallback: avoid duplicates and push to newEdges
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

    // Helper: resolve a textual ref into a canonical code or raw string (tries code, name, type, normalizedItems)
    function resolveCodeOrName(ref) {
        if (!ref) return null;
        const raw = String(ref).trim();
        if (!raw) return null;

        // 1) exact code
        if (codeToNodeId.has(raw)) return raw;

        // 2) exact name (case-insensitive)
        const nameKey = raw.toLowerCase();
        if (nameToNodeId.has(nameKey)) {
            // return the canonical code for that node if available
            const nodeId = nameToNodeId.get(nameKey);
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
            // otherwise return raw so callers can try name lookup
            return raw;
        }

        // 3) match by Type (return first matching node's code if available)
        if (typeToNodeIds.has(nameKey)) {
            const nodeId = typeToNodeIds.get(nameKey)[0];
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
            // fallback: return node id as raw string
            return nodeId;
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

    // Helper: get nodeId for code/name/type value (tries code, then name, then type)
    function getNodeIdForRef(ref) {
        if (!ref) return null;
        const trimmed = String(ref).trim();
        if (!trimmed) return null;

        // Try exact code
        if (codeToNodeId.has(trimmed)) return codeToNodeId.get(trimmed);

        // Try name
        if (nameToNodeId.has(trimmed.toLowerCase())) return nameToNodeId.get(trimmed.toLowerCase());

        // Try type (returns first node for that type)
        const maybeType = trimmed.toLowerCase();
        if (typeToNodeIds.has(maybeType) && typeToNodeIds.get(maybeType).length > 0) {
            return typeToNodeIds.get(maybeType)[0];
        }

        // Not found
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
    // Fallback: item.Connections (try both name & code & type lookups)
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


    return {
        nodes: [...existingNodes, ...newNodes],
        edges: newEdges,
        normalizedItems,
        messages: allMessages,
    };
}
