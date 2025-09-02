// File: src/utils/AIPNIDGenerator.js
// =============================
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
    let aiResult;
    try {
        aiResult = await parseItemLogic(description);

        // Normalize if AI returned an array directly
        if (Array.isArray(aiResult)) {
            aiResult = {
                mode: 'structured',
                parsed: aiResult,
                items: aiResult,
                explanation: null,
                connection: null,
                connectionResolved: [],
            };
        }
    } catch (err) {
        console.error('❌ Chat AI failed:', err);
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

    // prefer items[] from parser; then parsed; then fallback to []
    const parsedItems = Array.isArray(aiResult?.items) && aiResult.items.length > 0
        ? aiResult.items
        : Array.isArray(aiResult?.parsed)
            ? aiResult.parsed
            : aiResult?.parsed
                ? [aiResult.parsed]
                : [];

    // prefer parser-resolved connections when available
    const parserConnections =
        aiResult?.connectionResolved ||
        aiResult?.connections ||
        aiResult?.connection ||
        [];

    // Handle Hybrid action mode
    if (aiResult?.mode === 'action') {
        const action = aiResult.action;
        const actionMsg = `⚡ Action triggered: ${action}`;

        if (typeof setChatMessages === 'function') {
            setChatMessages((prev) => [
                ...prev,
                { sender: 'User', message: description },
                { sender: 'AI', message: actionMsg },
            ]);
        }

        return { nodes: existingNodes, edges: existingEdges };
    }

    // Chat mode
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

    const newNodes = [];
    const newEdges = [...existingEdges]; // start with existing edges so dedupe checks include them
    const normalizedItems = [];
    const allMessages = [{ sender: 'User', message: description }];

    // Expand quantity safely
    const expandedItems = [];
    parsedItems.forEach((p) => {
        const qty = Math.max(1, parseInt(p?.Number ?? 1, 10));
        for (let i = 0; i < qty; i++) {
            expandedItems.push({
                ...p,
                Sequence: (p.Sequence ?? 1) + i,
                Name: qty > 1 ? `${p.Name || p.Type || 'Item'}_${i + 1}` : p.Name,
                Number: 1, // each clone now represents a single item
            });
        }
    });
    // Use expandedItems instead of parsedItems for the node generation loop
    expandedItems.forEach((p, idx) => {
        // ... generate nodes as usual ...
    });


            const nodeId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `ai-${Date.now()}-${Math.random()}`;

            const nodeItem = {
                id: nodeId,
                Name: count > 1 ? `${Name} ${i + 1}` : Name,
                Code: code,
                'Item Code': code,
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: seq,
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
        }

        if (explanation && idx === 0) {
            allMessages.push({ sender: 'AI', message: explanation });
        }
    });

    // Build helper maps to resolve codes/names -> node IDs (includes existing + new)
    const allNodesSoFar = [...existingNodes, ...newNodes];
    const codeToNodeId = new Map();
    const nameToNodeId = new Map();
    allNodesSoFar.forEach((n) => {
        const item = n.data?.item;
        if (!item) return;
        if (item.Code !== undefined && item.Code !== null) codeToNodeId.set(String(item.Code), n.id);
        if (item.Name) nameToNodeId.set(String(item.Name).toLowerCase(), n.id);
    });

    // helper to add edge without duplicating (checks existingEdges + newEdges)
    function addEdgeByNodeIds(sourceId, targetId, opts = {}) {
        if (!sourceId || !targetId) return false;
        const exists = [...existingEdges, ...newEdges].some((e) => e.source === sourceId && e.target === targetId);
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
        const foundItem = [...normalizedItems, ...existingNodes.map((n) => n.data?.item)]
            .find((i) => String(i?.Code) === str || (i?.Name && i.Name.toLowerCase() === str.toLowerCase()));
        if (foundItem) return String(foundItem.Code);
        return str;
    }

    // --------------------------
    // Prefer parser-provided resolved connections (connectionResolved / connections)
    // --------------------------
    if (Array.isArray(parserConnections) && parserConnections.length > 0) {
        parserConnections.forEach((c) => {
            if (!c) return;
            const resolvedFrom = resolveCodeString(c.from || c.source || c.fromCode || c.fromName || '');
            const resolvedTo = resolveCodeString(c.to || c.target || c.toCode || c.toName || '');

            const srcNodeId = codeToNodeId.get(String(resolvedFrom)) || nameToNodeId.get(String((c.from || '').toLowerCase()));
            const tgtNodeId = codeToNodeId.get(String(resolvedTo)) || nameToNodeId.get(String((c.to || '').toLowerCase()));

            if (srcNodeId && tgtNodeId) {
                const added = addEdgeByNodeIds(srcNodeId, tgtNodeId, { type: 'smoothstep' });
                if (added) allMessages.push({ sender: 'AI', message: `→ Connected ${c.from} → ${c.to}` });
            }
        });
    }

    // --------------------------
    // Fall back: build edges from each item's Connections if parser didn't provide explicit ones
    // --------------------------
    const explicitAdded = newEdges.length > existingEdges.length;
    if (!explicitAdded) {
        normalizedItems.forEach((item) => {
            if (!item.Connections || !Array.isArray(item.Connections)) return;
            item.Connections.forEach((connTarget) => {
                const resolvedTargetCode = resolveCodeString(connTarget);
                const sourceNodeId = codeToNodeId.get(String(item.Code));
                const targetNodeId = codeToNodeId.get(String(resolvedTargetCode));

                if (sourceNodeId && targetNodeId) {
                    const added = addEdgeByNodeIds(sourceNodeId, targetNodeId, { type: 'smoothstep' });
                    if (added) {
                        allMessages.push({ sender: 'AI', message: `→ Connected ${item.Code} → ${resolvedTargetCode}` });
                    }
                }
            });
        });
    }

    // --------------------------
    // Implicit connections (chain all new items) — only when user asked to "connect" and there were no explicit connections
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1 && newEdges.length === existingEdges.length) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            addEdgeByNodeIds(newNodes[i].id, newNodes[i + 1].id, { animated: true });
        }
        allMessages.push({ sender: 'AI', message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    allMessages.push({ sender: 'AI', message: `→ Generated ${newNodes.length} total item(s)` });

    if (typeof setChatMessages === 'function' && allMessages.length > 0) {
        setChatMessages((prev) => [...prev, ...allMessages]);
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: [...newEdges],
        normalizedItems,
        messages: allMessages,
    };
}
