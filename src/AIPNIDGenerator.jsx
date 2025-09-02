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

    allNodesSoFar.forEach((n) => {
        const item = n?.data?.item;
        if (!item) return;

        // Prefer canonical Code, but accept Item Code or other variants
        const possibleCode =
            (item.Code ?? item['Item Code'] ?? item['ItemCode'] ?? item.code ?? '').toString().trim();
        if (possibleCode) codeToNodeId.set(possibleCode, n.id);

        if (item.Name) {
            const nm = String(item.Name).trim();
            if (nm) nameToNodeId.set(nm.toLowerCase(), n.id);
        }
    });

    // Helper: robust resolver that returns a canonical code OR the trimmed raw string
    function resolveCodeOrName(ref) {
        if (!ref) return null;
        const raw = String(ref).trim();
        if (!raw) return null;

        // 1) If the raw matches an existing code key directly (exact)
        if (codeToNodeId.has(raw)) return raw;

        // 2) If raw matches a name (case-insensitive)
        const nameKey = raw.toLowerCase();
        if (nameToNodeId.has(nameKey)) {
            const nodeId = nameToNodeId.get(nameKey);
            // return the code key that corresponds to that nodeId (reverse lookup)
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
            // if no code mapping found, return raw (so callers can attempt name lookup)
            return raw;
        }

        // 3) Search normalizedItems (these are item objects we just created)
        const foundInNormalized = [...normalizedItems].find((i) => {
            const iCode = (i?.Code ?? i['Item Code'] ?? '').toString().trim();
            if (iCode && iCode === raw) return true;
            if (i?.Name && i.Name.toString().trim().toLowerCase() === nameKey) return true;
            return false;
        });
        if (foundInNormalized) {
            const iCode = (foundInNormalized.Code ?? foundInNormalized['Item Code'] ?? '').toString().trim();
            if (iCode) return iCode;
            return String(foundInNormalized.Name || raw).trim();
        }

        // 4) Fallback: return trimmed raw (caller will try name-map)
        return raw;
    }

    // Helper to get nodeId by either code or name
    function getNodeIdForRef(ref) {
        if (!ref) return null;
        const trimmed = String(ref).trim();
        if (!trimmed) return null;

        // Try code map first (exact)
        const byCode = codeToNodeId.get(trimmed);
        if (byCode) return byCode;

        // Try name map
        const byName = nameToNodeId.get(trimmed.toLowerCase());
        if (byName) return byName;

        // Try treat trimmed as code key again (in case resolveCodeOrName returned something different)
        if (codeToNodeId.has(trimmed)) return codeToNodeId.get(trimmed);

        return null;
    }

    // --------------------------
    // Use parser connections if available
    // --------------------------
    if (Array.isArray(parserConnections) && parserConnections.length > 0) {
        allMessages.push({ sender: 'AI', message: `I understood the following connections:` });

        parserConnections.forEach((c) => {
            // Support different shapes: {from, to}, {source, target}, strings, etc.
            const rawFrom = (c.from ?? c.source ?? c.fromName ?? c.fromCode ?? '').toString().trim();
            const rawTo = (c.to ?? c.target ?? c.toName ?? c.toCode ?? '').toString().trim();

            // Resolve to canonical code or raw string
            const fromRef = resolveCodeOrName(rawFrom);
            const toRef = resolveCodeOrName(rawTo);

            const srcId = getNodeIdForRef(fromRef) || getNodeIdForRef(rawFrom);
            const tgtId = getNodeIdForRef(toRef) || getNodeIdForRef(rawTo);

            if (srcId && tgtId) {
                const added = addEdgeByNodeIds(srcId, tgtId);
                if (added) {
                    const msg = `${rawFrom} → ${rawTo}`;
                    allMessages.push({ sender: 'AI', message: msg });
                }
            } else {
                console.debug('AI connection unresolved:', { rawFrom, rawTo, fromRef, toRef, srcId, tgtId });
            }
        });
    }

    // --------------------------
    // Fallback: item.Connections (try both name & code lookups)
    // --------------------------
    if (newEdges.length === existingEdges.length) {
        normalizedItems.forEach((item) => {
            const srcId = getNodeIdForRef(item.Code ?? item['Item Code'] ?? item.Name);
            (Array.isArray(item.Connections) ? item.Connections : []).forEach((conn) => {
                const targetRef = resolveCodeOrName(conn);
                const tgtId = getNodeIdForRef(targetRef) || getNodeIdForRef(conn);
                if (srcId && tgtId) {
                    const added = addEdgeByNodeIds(srcId, tgtId);
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
            addEdgeByNodeIds(newNodes[i].id, newNodes[i + 1].id);
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
