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
// AI PNID generator (main export)
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

    // 1) call parser
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

    // resolve parsed items array
    const parsedItems =
        Array.isArray(aiResult?.items) && aiResult.items.length > 0
            ? aiResult.items
            : Array.isArray(aiResult?.parsed)
                ? aiResult.parsed
                : aiResult?.parsed
                    ? [aiResult.parsed]
                    : [];

    const parserConnections =
        aiResult?.connectionResolved ||
        aiResult?.connections ||
        aiResult?.connection ||
        [];

    // short-circuit action/chat modes
    if (aiResult?.mode === 'action') {
        const action = aiResult.action;
        const msg = `⚡ Action triggered: ${action}`;
        if (typeof setChatMessages === 'function') {
            setChatMessages((prev) => [...prev, { sender: 'User', message: description }, { sender: 'AI', message: msg }]);
        }
        return { nodes: existingNodes, edges: existingEdges };
    }

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
    // Build nodes (from parsedItems)
    // --------------------------
    const newNodes = [];
    const newEdges = [...existingEdges];
    const normalizedItems = [];
    const allMessages = [{ sender: 'User', message: description }];

    // Expand Number into clones if necessary
    const expandedItems = [];
    parsedItems.forEach((p) => {
        const qty = Math.max(1, parseInt(p?.Number ?? 1, 10));

        if (qty > 1) {
            allMessages.push({
                sender: 'AI',
                message: `I understood that you want ${qty} items of type "${p.Name || p.Type || 'Item'}".`,
            });

            const conns = Array.isArray(p.Connections) ? p.Connections : [];
            if (conns.length > 0) {
                allMessages.push({
                    sender: 'AI',
                    message: `These items should be connected to: ${conns.join(', ')}`,
                });
            }
        }

        for (let i = 0; i < qty; i++) {
            expandedItems.push({
                ...p,
                Sequence: (p.Sequence ?? 1) + i,
                Name: p.Type || p.Name || 'Item',
                Number: 1,
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

        // keep generateCode as the authoritative generator (frontend)
        const code = generateCode(p, itemsLibrary, existingNodes, normalizedItems);

        const nodeId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `ai-${Date.now()}-${Math.random()}`;

        const finalName = Type || givenName || 'Item';

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
    // Build maps AFTER newNodes are created
    // --------------------------
    const allNodesSoFar = [...existingNodes, ...newNodes];

    const codeToNodeId = new Map(); // canonical code -> nodeId
    const nameToNodeIds = new Map(); // normalized name -> [nodeIds]
    const typeToNodeIds = new Map(); // normalized type -> [nodeIds]
    const nameToCode = new Map(); // normalized display name -> canonical code (useful when parser returns names)

    function normalizeKey(s) {
        if (s === undefined || s === null) return '';
        return String(s).trim().toLowerCase().replace(/[_\s\-–—]+/g, ' ').replace(/[^\w\d ]+/g, '');
    }

    allNodesSoFar.forEach((n) => {
        const item = n?.data?.item;
        if (!item) return;

        const possibleCode =
            (item.Code ?? item['Item Code'] ?? item._generatedCode ?? item._baseCode ?? '').toString().trim();
        if (possibleCode) codeToNodeId.set(possibleCode, n.id);

        const displayName = item.Name || item.Type || '';
        const nm = normalizeKey(displayName);
        if (nm) {
            if (!nameToNodeIds.has(nm)) nameToNodeIds.set(nm, []);
            nameToNodeIds.get(nm).push(n.id);

            // Map normalized display name -> canonical code (prefer declared Code)
            if (possibleCode) nameToCode.set(nm, possibleCode);
        }

        if (item.Type) {
            const tp = normalizeKey(item.Type);
            if (!typeToNodeIds.has(tp)) typeToNodeIds.set(tp, []);
            typeToNodeIds.get(tp).push(n.id);
        }
    });

    console.debug('lookup maps', {
        codes: [...codeToNodeId.keys()],
        names: [...nameToCode.keys()],
        types: [...typeToNodeIds.keys()],
    });

    // Safe edge adder
    function addEdgeSafely(sourceId, targetId, opts = {}) {
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

    // small helper: if parser returns instance-like numeric codes (110101) we can produce stripped candidates (1101)
    function stripTrailingTwoDigitsCandidates(code) {
        if (!code) return [];
        let s = String(code).trim();
        const out = [s];
        while (s.length > 2) {
            const m = s.match(/^(.*?)(\d{2})$/);
            if (!m) break;
            s = m[1];
            if (s) out.push(s);
            else break;
        }
        return out;
    }

    // --------------------------
    // Robust resolvers
    // --------------------------

    // resolve ref -> canonical code (string) or raw if unresolved
    function resolveCodeOrNameToCode(ref) {
        if (!ref) return null;
        const raw = String(ref).trim();
        if (!raw) return null;

        // 1) exact code
        if (codeToNodeId.has(raw)) return raw;

        const nKey = normalizeKey(raw);

        // 2) direct name -> code mapping (high priority)
        if (nameToCode.has(nKey)) {
            return nameToCode.get(nKey);
        }

        // 3) exact name match -> return code of first matching node
        if (nameToNodeIds.has(nKey)) {
            const nodeId = nameToNodeIds.get(nKey)[0];
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
        }

        // 4) exact type match
        if (typeToNodeIds.has(nKey)) {
            const nodeId = typeToNodeIds.get(nKey)[0];
            for (const [codeKey, id] of codeToNodeId.entries()) {
                if (id === nodeId) return codeKey;
            }
        }

        // 5) punctuation-insensitive code compare
        for (const codeKey of codeToNodeId.keys()) {
            if (normalizeKey(codeKey) === nKey) return codeKey;
            if (normalizeKey(codeKey).includes(nKey) || nKey.includes(normalizeKey(codeKey))) return codeKey;
        }

        // 6) try stripping trailing two-digit groups (defensive). If you prefer NOT to map instance codes, you can remove this block.
        const candidates = stripTrailingTwoDigitsCandidates(raw);
        for (const cand of candidates) {
            if (codeToNodeId.has(cand)) return cand;
            for (const codeKey of codeToNodeId.keys()) {
                if (normalizeKey(codeKey) === normalizeKey(cand) || normalizeKey(codeKey).includes(normalizeKey(cand))) {
                    return codeKey;
                }
            }
        }

        // 7) generate candidate via generateCode (fallback)
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

        // 8) token/substring fuzzy scoring as final attempt
        const refTokens = nKey.split(/\s+/).filter(Boolean);
        let best = { score: 0, code: null, nodeId: null };
        for (const [codeKey, nodeId] of codeToNodeId.entries()) {
            const node = allNodesSoFar.find((n) => n.id === nodeId);
            const testName = normalizeKey(node?.data?.item?.Name || node?.data?.item?.Type || codeKey || '');
            const tokens = testName.split(/\s+/).filter(Boolean);
            const common = refTokens.filter((t) => tokens.includes(t)).length;
            if (common > best.score) {
                best = { score: common, code: codeKey, nodeId };
            } else if (common === best.score && common > 0) {
                // tie-breaker prefer same Unit/SubUnit if available compared to first normalized item
                const curNode = allNodesSoFar.find((n) => n.id === best.nodeId);
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

        // fallback: return raw (caller may try getNodeIdForRef)
        return raw;
    }

    // resolve ref -> nodeId (preferred)
    function getNodeIdForRef(ref) {
        if (!ref) return null;
        const trimmed = String(ref).trim();
        if (!trimmed) return null;

        // direct node id?
        if (allNodesSoFar.some((n) => n.id === trimmed)) return trimmed;

        // exact code map
        if (codeToNodeId.has(trimmed)) return codeToNodeId.get(trimmed);

        // canonical code via resolver
        const canon = resolveCodeOrNameToCode(trimmed);
        if (canon && codeToNodeId.has(canon)) return codeToNodeId.get(canon);

        // normalized name -> first node id
        const nKey = normalizeKey(trimmed);
        if (nameToNodeIds.has(nKey)) return nameToNodeIds.get(nKey)[0];

        // type -> first node id
        if (typeToNodeIds.has(nKey)) return typeToNodeIds.get(nKey)[0];

        // last ditch: token overlap best node
        const tokens = nKey.split(/\s+/).filter(Boolean);
        let best = { score: 0, nodeId: null };
        for (const n of allNodesSoFar) {
            const test = normalizeKey(n.data?.item?.Name || n.data?.item?.Type || '');
            const tks = test.split(/\s+/).filter(Boolean);
            const common = tokens.filter((t) => tks.includes(t)).length;
            if (common > best.score) best = { score: common, nodeId: n.id };
        }
        return best.score > 0 ? best.nodeId : null;
    }

    // --------------------------
    // Use parser-provided connections (if any)
    // --------------------------
    if (Array.isArray(parserConnections) && parserConnections.length > 0) {
        allMessages.push({ sender: 'AI', message: `I understood the following connections:` });

        parserConnections.forEach((c) => {
            const rawFrom = (c.from ?? c.source ?? c.fromName ?? c.fromCode ?? '').toString().trim();
            const rawTo = (c.to ?? c.target ?? c.toName ?? c.toCode ?? '').toString().trim();

            const fromCode = resolveCodeOrNameToCode(rawFrom); // canonical code (e.g. "1101")
            const toCode = resolveCodeOrNameToCode(rawTo);

            const srcId = fromCode ? codeToNodeId.get(fromCode) : getNodeIdForRef(rawFrom);
            const tgtId = toCode ? codeToNodeId.get(toCode) : getNodeIdForRef(rawTo);

            if (srcId && tgtId) {
                const added = addEdgeSafely(srcId, tgtId);
                if (added) {
                    allMessages.push({ sender: 'AI', message: `${rawFrom} → ${rawTo}` });
                }
            } else {
                console.debug('AI connection unresolved:', { rawFrom, rawTo, fromCode, toCode, srcId, tgtId });
                // user feedback
                allMessages.push({ sender: 'AI', message: `⚠️ Could not resolve connection: ${rawFrom} → ${rawTo}` });
            }
        });
    }

    // --------------------------
    // Fallback: use item.Connections on the normalizedItems
    // --------------------------
    if (newEdges.length === existingEdges.length) {
        normalizedItems.forEach((item) => {
            const srcId = getNodeIdForRef(item.Code ?? item['Item Code'] ?? item.Name ?? item.Type);
            (Array.isArray(item.Connections) ? item.Connections : []).forEach((conn) => {
                // conn might be "A → B" or "B" etc.
                let targetRef = conn;
                if (typeof conn === 'object') {
                    targetRef = conn.to ?? conn.target ?? conn.toName ?? conn.toCode ?? '';
                } else if (typeof conn === 'string') {
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
    // Auto-connect chain if requested
    // --------------------------
    if (/connect/i.test(description) && newNodes.length > 1 && newEdges.length === existingEdges.length) {
        for (let i = 0; i < newNodes.length - 1; i++) {
            addEdgeSafely(newNodes[i].id, newNodes[i + 1].id);
        }
        allMessages.push({ sender: 'AI', message: `→ Auto-connected ${newNodes.length} nodes.` });
    }

    // final summary + chat update
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
