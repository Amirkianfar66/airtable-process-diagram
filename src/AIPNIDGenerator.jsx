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
        }

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
            Name: givenName,
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

        // ensure Name == Type (no numbers) and never empty
        const finalName = (Type || givenName || 'Item');

        const nodeItem = {
            id: nodeId,
            Name: finalName,
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
    // NOTE: build these AFTER newNodes are created but BEFORE connections are resolved.
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];

    // maps:
    // codeToNodeId: key = canonical code string -> node id
    // nameToNodeIds: key = normalized name -> [node ids]
    // typeToNodeIds: key = normalized type -> [node ids]
    const codeToNodeId = new Map();
    const nameToNodeIds = new Map();
    const typeToNodeIds = new Map();

    function normalizeKey(s) {
        if (!s && s !== 0) return '';
        return String(s).trim().toLowerCase().replace(/[_\s\-–—]+/g, ' ').replace(/[^\w\d ]+/g, '');
    }

    allNodesSoFar.forEach((n) => {
        const item = n?.data?.item;
        if (!item) return;

        const possibleCode =
            (item.Code ?? item['Item Code'] ?? item['ItemCode'] ?? item.code ?? '').toString().trim();
        if (possibleCode) codeToNodeId.set(possibleCode, n.id);

        if (item.Name) {
            const nm = normalizeKey(item.Name);
            if (nm) {
                if (!nameToNodeIds.has(nm)) nameToNodeIds.set(nm, []);
                nameToNodeIds.get(nm).push(n.id);
            }
        }

        if (item.Type) {
            const tp = normalizeKey(item.Type);
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

        const exists = newEdges.some(
            (e) => e.source === sourceId && e.target === targetId
        );
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

    // ------------- Robust resolvers -------------
    // Return canonical code (string) or null
    function resolveCodeOrNameToCode(ref) {
        if (!ref) return null;
        const raw = String(ref).trim();
        if (!raw) return null;

        // 1) exact code (prefer exact)
        if (codeToNodeId.has(raw)) return raw;

        const nKey = normalizeKey(raw);

        // 2) exact name match (normalized)
        if (nameToNodeIds.has(nKey)) {
            const nodeId = nameToNodeIds.get(nKey)[0]; // deterministic: first
            // find code for that node
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
            // fallback to original raw if name match had no code
            return raw;
        }

        // 3) exact type match
        if (typeToNodeIds.has(nKey)) {
            const nodeId = typeToNodeIds.get(nKey)[0];
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
            const node = allNodesSoFar.find(n => n.id === nodeId);
            if (node && node.data?.item) {
                return (node.data.item.Code ?? node.data.item['Item Code'] ?? node.data.item.Name ?? '').toString().trim();
            }
            return raw;
        }

        // 4) punctuation-insensitive code match (normalized compare)
        for (const codeKey of codeToNodeId.keys()) {
            if (normalizeKey(codeKey) === nKey) return codeKey;
            if (normalizeKey(codeKey).includes(nKey) || nKey.includes(normalizeKey(codeKey))) return codeKey;
        }

        // 5) Try to generate a candidate code (uses your generateCode - keep consistent)
        try {
            const guessItem = { Name: raw, Type: raw, Unit: 0, SubUnit: 0, Sequence: 1, Number: 1 };
            const guessed = generateCode(guessItem, itemsLibrary || [], existingNodes || [], normalizedItems || []);
            if (guessed) {
                const g = String(guessed).trim();
                if (codeToNodeId.has(g)) return g;
                for (const codeKey of codeToNodeId.keys()) {
                    if (normalizeKey(codeKey) === normalizeKey(g)) return codeKey;
                }
            }
        } catch (e) {
            console.debug('generateCode fallback failed:', e?.message || e);
        }

        // 6) Token / substring match scoring (best overlap)
        const refTokens = nKey.split(/\s+/).filter(Boolean);
        let best = { score: 0, code: null, nodeId: null };
        for (const [codeKey, nodeId] of codeToNodeId.entries()) {
            const node = allNodesSoFar.find(n => n.id === nodeId);
            const testName = normalizeKey(node?.data?.item?.Name || node?.data?.item?.Type || codeKey || '');
            const tokens = testName.split(/\s+/).filter(Boolean);
            const common = refTokens.filter(t => tokens.includes(t)).length;
            if (common > best.score) {
                best = { score: common, code: codeKey, nodeId };
            } else if (common === best.score && common > 0) {
                // tie-breaker: prefer same Unit/SubUnit if available (compare to first normalized item)
                const curNode = allNodesSoFar.find(n => n.id === best.nodeId);
                const candNode = node;
                const refUnit = normalizedItems[0]?.Unit;
                const curItem = curNode?.data?.item || {};
                const candItem = candNode?.data?.item || {};
                const curMatch = (curItem.Unit === refUnit) + (curItem.SubUnit === (normalizedItems[0]?.SubUnit));
                const candMatch = (candItem.Unit === refUnit) + (candItem.SubUnit === (normalizedItems[0]?.SubUnit));
                if (candMatch > curMatch) best = { score: common, code: codeKey, nodeId };
            }
        }
        if (best.score > 0) return best.code;

        // fallback: return raw so caller can try further
        return raw;
    }

    // Return nodeId (not code) or null
    function getNodeIdForRef(ref) {
        if (!ref) return null;
        const trimmed = String(ref).trim();
        if (!trimmed) return null;

        // 0) direct node id passed in
        if (allNodesSoFar.some(n => n.id === trimmed)) return trimmed;

        // 1) exact code mapping
        if (codeToNodeId.has(trimmed)) return codeToNodeId.get(trimmed);

        // 2) resolve canonical code then map to nodeId
        const canon = resolveCodeOrNameToCode(trimmed);
        if (canon && codeToNodeId.has(canon)) return codeToNodeId.get(canon);

        // 3) try normalized name map
        const nKey = normalizeKey(trimmed);
        if (nameToNodeIds.has(nKey)) return nameToNodeIds.get(nKey)[0];

        // 4) try type map
        if (typeToNodeIds.has(nKey)) return typeToNodeIds.get(nKey)[0];

        // 5) last-ditch: token overlap best node
        const tokens = nKey.split(/\s+/).filter(Boolean);
        let best = { score: 0, nodeId: null };
        for (const n of allNodesSoFar) {
            const test = normalizeKey(n.data?.item?.Name || n.data?.item?.Type || '');
            const tks = test.split(/\s+/).filter(Boolean);
            const common = tokens.filter(t => tks.includes(t)).length;
            if (common > best.score) best = { score: common, nodeId: n.id };
        }
        return best.score > 0 ? best.nodeId : null;
    }

    // --------------------------
    // Use parser connections if available
    // --------------------------
    if (Array.isArray(parserConnections) && parserConnections.length > 0) {
        allMessages.push({ sender: 'AI', message: `I understood the following connections:` });

        parserConnections.forEach((c) => {
            const rawFrom = (c.from ?? c.source ?? c.fromName ?? c.fromCode ?? '').toString().trim();
            const rawTo = (c.to ?? c.target ?? c.toName ?? c.toCode ?? '').toString().trim();

            // Resolve using the robust helpers (prefer node ids)
            let srcId = getNodeIdForRef(rawFrom);
            let tgtId = getNodeIdForRef(rawTo);

            // if not found, try resolveCodeOrName -> then node id
            if (!srcId) {
                const fromCode = resolveCodeOrNameToCode(rawFrom);
                if (fromCode && codeToNodeId.has(fromCode)) srcId = codeToNodeId.get(fromCode);
            }
            if (!tgtId) {
                const toCode = resolveCodeOrNameToCode(rawTo);
                if (toCode && codeToNodeId.has(toCode)) tgtId = codeToNodeId.get(toCode);
            }

            if (srcId && tgtId) {
                const added = addEdgeSafely(srcId, tgtId);
                if (added) {
                    allMessages.push({ sender: 'AI', message: `${rawFrom} → ${rawTo}` });
                }
            } else {
                console.debug('AI connection unresolved:', { rawFrom, rawTo, srcId, tgtId });
                // give user feedback in chat (non-blocking)
                allMessages.push({ sender: 'AI', message: `⚠️ Could not resolve connection: ${rawFrom} → ${rawTo}` });
            }
        });
    }

    // --------------------------
    // Fallback: item.Connections (try code/name/type lookups)
    // --------------------------
    if (newEdges.length === existingEdges.length) {
        normalizedItems.forEach((item) => {
            // derive srcId from the item's Code or Name/Type
            const srcId =
                getNodeIdForRef(item.Code ?? item['Item Code'] ?? item.Name ?? item.Type);

            (Array.isArray(item.Connections) ? item.Connections : []).forEach((conn) => {
                // conn might be string like "PUMP01" or "PUMP → TANK" or an object
                let targetRef = conn;
                if (typeof conn === 'object') {
                    targetRef = conn.to ?? conn.target ?? conn.toName ?? conn.toCode ?? '';
                } else if (typeof conn === 'string') {
                    // try to extract RHS if arrow-like
                    const m = conn.match(/(?:.+?)[\s]*[→\-–>|]+[\s]*(.+)/i);
                    if (m) targetRef = m[1].trim();
                }

                const tgtId = getNodeIdForRef(targetRef);
                if (srcId && tgtId) {
                    const added = addEdgeSafely(srcId, tgtId);
                    if (added) {
                        allMessages.push({ sender: 'AI', message: `→ Connected ${item.Code} → ${targetRef}` });
                    }
                } else {
                    console.debug('Fallback connection unresolved:', { itemCode: item.Code, conn, targetRef, srcId, tgtId });
                    allMessages.push({ sender: 'AI', message: `⚠️ Could not connect ${item.Code} → ${String(targetRef)}` });
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
