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

    let aiResult;
    try {
        aiResult = await parseItemLogic(description);

        if (Array.isArray(aiResult)) {
            aiResult = {
                mode: "structured",
                items: aiResult,
                explanation: null,
                connectionResolved: []
            };
        }
    } catch (err) {
        console.error('❌ Chat AI failed:', err);
        setChatMessages?.(prev => [
            ...prev,
            { sender: 'User', message: description },
            { sender: 'AI', message: '⚠️ AI processing failed.' }
        ]);
        return { nodes: existingNodes, edges: existingEdges };
    }

    const { mode, explanation, items = [], connectionResolved = [] } = aiResult;

    if (mode === "chat") {
        setChatMessages?.(prev => [
            ...prev,
            { sender: 'User', message: description },
            { sender: 'AI', message: explanation || 'Chat response received.' }
        ]);
        return { nodes: existingNodes, edges: existingEdges };
    }

    // --------------------------
    // Structured PNID logic
    // --------------------------
    const parsedItems = items.filter(Boolean);
    const newNodes = [];
    const newEdges = [...existingEdges];
    const normalizedItems = [];
    const allMessages = [{ sender: 'User', message: description }];

    parsedItems.forEach((p, idx) => {
        const Name = (p.Name || description).trim();
        const Category = p.Category || 'Equipment';
        const Type = p.Type || 'Generic';
        const NumberOfItems = p.Number || 1;
        const Unit = p.Unit ?? 0;
        const SubUnit = p.SubUnit ?? 0;
        const Sequence = p.Sequence ?? 1;

        const baseCode = generateCode({ Category, Type, Unit, SubUnit, Sequence, SensorType: p.SensorType || '' });
        const allCodes = [baseCode].filter(Boolean);

        for (let i = 1; i < NumberOfItems; i++) {
            const nextCode = generateCode({ Category, Type, Unit, SubUnit, Sequence: Sequence + i, SensorType: p.SensorType || '' });
            if (nextCode) allCodes.push(nextCode);
        }

        allCodes.forEach((code, codeIdx) => {
            const nodeId = crypto?.randomUUID?.() || `ai-${Date.now()}-${Math.random()}`;
            const nodeItem = {
                id: nodeId,
                Name: NumberOfItems > 1 ? `${Name} ${codeIdx + 1}` : Name,
                Code: code,
                'Item Code': code,
                Category,
                Type,
                Unit,
                SubUnit,
                Sequence: Sequence + codeIdx,
                Connections: Array.isArray(p.Connections) ? [...p.Connections] : []
            };

            newNodes.push({
                id: nodeId,
                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                data: { label: `${nodeItem.Code} - ${nodeItem.Name}`, item: nodeItem, icon: getItemIcon(nodeItem) },
                type: categoryTypeMap[Category] || 'scalableIcon'
            });

            normalizedItems.push(nodeItem);
            allMessages.push({ sender: 'AI', message: `Generated code: ${code}` });
        });

        if (explanation && idx === 0) {
            allMessages.push({ sender: 'AI', message: explanation });
        }
    });

    // --------------------------
    // Resolve connections
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];
    const codeToNodeId = new Map();
    const nameToNodeId = new Map();
    allNodesSoFar.forEach(n => {
        const item = n.data?.item;
        if (!item) return;
        if (item.Code != null) codeToNodeId.set(String(item.Code), n.id);
        if (item.Name) nameToNodeId.set(String(item.Name).toLowerCase(), n.id);
    });

    function addEdgeByNodeIds(sourceId, targetId, opts = {}) {
        if (!sourceId || !targetId) return false;
        const exists = [...existingEdges, ...newEdges].some(e => e.source === sourceId && e.target === targetId);
        if (exists) return false;
        newEdges.push({ id: `edge-${sourceId}-${targetId}`, source: sourceId, target: targetId, type: opts.type || 'smoothstep', animated: opts.animated ?? true, style: opts.style || { stroke: '#888', strokeWidth: 2 } });
        return true;
    }

    function resolveCodeString(ref) {
        if (!ref) return null;
        const str = String(ref).trim();
        const foundItem = [...normalizedItems, ...existingNodes.map(n => n.data?.item)].find(i => String(i?.Code) === str || (i?.Name?.toLowerCase() === str.toLowerCase()));
        return foundItem ? String(foundItem.Code) : str;
    }

    parserConnections.forEach(c => {
        if (!c) return;
        const resolvedFrom = resolveCodeString(c.from || c.source);
        const resolvedTo = resolveCodeString(c.to || c.target);
        const srcNodeId = codeToNodeId.get(resolvedFrom) || nameToNodeId.get((c.from || '').toLowerCase());
        const tgtNodeId = codeToNodeId.get(resolvedTo) || nameToNodeId.get((c.to || '').toLowerCase());
        if (srcNodeId && tgtNodeId) addEdgeByNodeIds(srcNodeId, tgtNodeId);
    });

    // --------------------------
    // Implicit sequential connections
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1 && newEdges.length === existingEdges.length) {
        for (let i = 0; i < newNodes.length - 1; i++) addEdgeByNodeIds(newNodes[i].id, newNodes[i + 1].id);
        allMessages.push({ sender: 'AI', message: `→ Automatically connected ${newNodes.length} nodes in sequence.` });
    }

    allMessages.push({ sender: 'AI', message: `→ Generated ${newNodes.length} total item(s)` });
    setChatMessages?.(prev => [...prev, ...allMessages]);

    return { nodes: [...existingNodes, ...newNodes], edges: [...newEdges], normalizedItems, messages: allMessages };
}
