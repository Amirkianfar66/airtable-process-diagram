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
    // Build maps for lookups
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];
    const codeToNodeId = new Map();
    const nameToNodeId = new Map();
    allNodesSoFar.forEach((n) => {
        const item = n.data?.item;
        if (!item) return;
        if (item.Code) codeToNodeId.set(String(item.Code), n.id);
        if (item.Name) nameToNodeId.set(String(item.Name).toLowerCase(), n.id);
    });

    function addEdgeByNodeIds(sourceId, targetId, opts = {}) {
        if (!sourceId || !targetId) return false;
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

    function resolveCodeOrName(ref) {
        if (!ref) return null;
        const str = String(ref).trim();
        const found = [...normalizedItems, ...existingNodes.map((n) => n.data?.item)].find(
            (i) => String(i?.Code) === str || (i?.Name && i.Name.toLowerCase() === str.toLowerCase())
        );
        return found ? String(found.Code) : str;
    }

    // --------------------------
    // Use parser connections if available
    // --------------------------
    if (Array.isArray(parserConnections) && parserConnections.length > 0) {
        parserConnections.forEach((c) => {
            const fromRef = resolveCodeOrName(c.from || c.source || c.fromCode || c.fromName);
            const toRef = resolveCodeOrName(c.to || c.target || c.toCode || c.toName);

            const srcId = codeToNodeId.get(fromRef) || nameToNodeId.get((c.from || '').toLowerCase());
            const tgtId = codeToNodeId.get(toRef) || nameToNodeId.get((c.to || '').toLowerCase());

            if (srcId && tgtId) {
                const added = addEdgeByNodeIds(srcId, tgtId);
                if (added) allMessages.push({ sender: 'AI', message: `→ Connected ${c.from} → ${c.to}` });
            }
        });
    }

    // --------------------------
    // Fallback: item.Connections
    // --------------------------
    if (newEdges.length === existingEdges.length) {
        normalizedItems.forEach((item) => {
            item.Connections.forEach((conn) => {
                const targetCode = resolveCodeOrName(conn);
                const srcId = codeToNodeId.get(String(item.Code));
                const tgtId = codeToNodeId.get(String(targetCode));
                if (srcId && tgtId) {
                    const added = addEdgeByNodeIds(srcId, tgtId);
                    if (added) allMessages.push({ sender: 'AI', message: `→ Connected ${item.Code} → ${targetCode}` });
                }
            });
        });
    }

    // --------------------------
    // Auto-connect chain if user asked
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1 && newEdges.length === existingEdges.length) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            addEdgeByNodeIds(newNodes[i].id, newNodes[i + 1].id);
        }
        allMessages.push({ sender: 'AI', message: `→ Auto-connected ${newNodes.length} nodes.` });
    }

    allMessages.push({ sender: 'AI', message: `→ Generated ${newNodes.length} item(s)` });

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
