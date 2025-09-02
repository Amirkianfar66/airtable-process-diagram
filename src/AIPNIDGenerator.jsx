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
    const normalizedItems = []; // items metadata we expose
    const allMessages = [{ sender: 'User', message: description }];

    // Expand Number/Count into clones if necessary
    const expandedItems = [];
    parsedItems.forEach((p) => {
        // prefer Count (Gemini) but fall back to Number
        const qty = Math.max(1, parseInt(p?.Count ?? p?.Number ?? 1, 10));
        const baseName = (p.Name || p.Type || 'Item').toString().trim();

        if (qty > 1) {
            allMessages.push({
                sender: 'AI',
                message: `I understood that you want ${qty} items of type "${baseName}".`,
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
                // keep Name identical for clones per your preference
                Name: baseName,
                // record instance (1-based) so resolvers can map Tank2 -> instance 2
                Instance: i + 1,
                Number: 1,
                Count: 1,
            });
        }
    });

    // Create nodes from expanded items
    expandedItems.forEach((p, idx) => {
        const {
            Name: givenName,
            Category = 'Default',
            Type = 'Generic',
            Unit = 'Default Unit',
            SubUnit = 'Default SubUnit',
            Sequence,
            Instance,
        } = p;

        // ensure Sequence is numeric
        const seqNum = typeof Sequence === 'number' ? Sequence : Number(Sequence ?? (idx + 1));

        // generate canonical code (frontend authoritative)
        const code = generateCode({ ...p, Sequence: seqNum }, itemsLibrary, existingNodes, normalizedItems);

        const nodeId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `ai-${Date.now()}-${Math.random()}`;

        const nodeItem = {
            id: nodeId,
            Name: String(givenName),
            Instance: Instance ?? 1,
            Code: code,
            'Item Code': code,
            Category,
            Type,
            Unit,
            SubUnit,
            Sequence: seqNum,
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

    const codeToNodeId = new Map(); // canonical code -> nodeId (e.g. "1101" -> nodeId)
    const nodeIdToCode = new Map(); // nodeId -> code (reverse)
    const nameToNodeIds = new Map(); // normalized name -> [nodeIds] (includes existing + new)
    const newNameToNodeIds = new Map(); // normalized name -> [nodeIds] (newNodes only, preserves creation order)
    const typeToNodeIds = new Map(); // normalized type -> [nodeIds]
    const nameToCode = new Map(); // normalized display name -> canonical code (optional)

    function normalizeKey(s) {
        if (s === undefined || s === null) return '';
        return String(s).trim().toLowerCase().replace(/[_\s\-–—]+/g, ' ').replace(/[^\w\d ]+/g, '');
    }

    // populate maps
    allNodesSoFar.forEach((n, idx) => {
        const item = n?.data?.item;
        if (!item) return;

        const possibleCode = (item.Code ?? item['Item Code'] ?? '').toString().trim();
        if (possibleCode) {
            codeToNodeId.set(possibleCode, n.id);
            nodeIdToCode.set(n.id, possibleCode);
        }

        const displayName = item.Name || item.Type || '';
        const nm = normalizeKey(displayName);
        if (nm) {
            if (!nameToNodeIds.has(nm)) nameToNodeIds.set(nm, []);
            nameToNodeIds.get(nm).push(n.id);

            if (possibleCode) nameToCode.set(nm, possibleCode);
        }

        if (item.Type) {
            const tp = normalizeKey(item.Type);
            if (!typeToNodeIds.has(tp)) typeToNodeIds.set(tp, []);
            typeToNodeIds.get(tp).push(n.id);
        }
    });

    // newNodes-specific mapping (preserve creation order of the newly-created nodes)
    newNodes.forEach(n => {
        const it = n.data?.item || {};
        const nm = normalizeKey(it.Name || it.Type || '');
        if (!nm) return;
        if (!newNameToNodeIds.has(nm)) newNameToNodeIds.set(nm, []);
        newNameToNodeIds.get(nm).push(n.id);
    });

    console.debug('lookup maps', {
        codes: [...codeToNodeId.keys()].slice(0, 200),
        names: [...nameToCode.keys()].slice(0, 200),
        types: [...typeToNodeIds.keys()].slice(0, 200),
    });

    // --------------------------
    // Helpers for resolving Nth instance for same-name items
    // --------------------------
    // parse patterns like "Tank2", "Tank_2", "Tank 2" -> { base, index }
    function parseBaseAndIndex(ref) {
        if (!ref) return null;
        const s = String(ref).trim();
        const m = s.match(/^(.+?)[_\s-]*0*([0-9]+)$/);
        if (!m) return null;
        return { base: m[1].trim(), index: parseInt(m[2], 10) };
    }

    // Prefer new nodes for selecting the Nth instance (so Tank2 -> second of just-created Tanks),
    // but fall back to nameToNodeIds (which includes existing nodes)
    function getNthNodeIdForBaseName(baseRaw, n = 1) {
        if (!baseRaw) return null;
        const key = normalizeKey(baseRaw);
        // Try new nodes first (preserve creation order)
        const newList = newNameToNodeIds.get(key) || [];
        if (newList.length >= n) return newList[n - 1];
        // If not enough new nodes, fall back to global list (existing + new)
        const allList = nameToNodeIds.get(key) || [];
        if (allList.length >= n) return allList[n - 1];
        return null;
    }

    // --------------------------
    // Safe edge adder
    // --------------------------
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

        // 0) exact code
        if (codeToNodeId.has(raw)) return raw;

        // 1) numeric-suffix pattern (Tank2 -> pick 2nd Tank)
        const parsed = parseBaseAndIndex(raw);
        if (parsed) {
            const { base, index } = parsed;
            const nodeId = getNthNodeIdForBaseName(base, index);
            if (nodeId && nodeIdToCode.has(nodeId)) {
                return nodeIdToCode.get(nodeId);
            }
        }

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

        // 6) try stripping trailing two-digit groups
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

        // numeric-suffix pattern: try to map Tank2 -> second Tank (prefer newly-created nodes)
        const parsed = parseBaseAndIndex(trimmed);
        if (parsed) {
            const nodeId = getNthNodeIdForBaseName(parsed.base, parsed.index);
            if (nodeId) return nodeId;
        }

        // canonical code via resolver (may return a code)
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

    // --- BEGIN: REMAP AI edges to actual node IDs (drop-in) ---
    /**
     * Remap any edges that use Codes/Names as endpoints into edges that
     * use node.id (React Flow IDs). This ensures the returned edges
     * are renderable by the canvas without modifying the React handler.
     */

    // build a quick code/name -> nodeId map (prefer map you already have if available)
    const codeOrNameToNodeId = new Map();

    // prefer codeToNodeId if defined; otherwise build from allNodesSoFar
    for (const [k, v] of codeToNodeId.entries()) codeOrNameToNodeId.set(String(k), v);

    // also map normalized names -> nodeId using nameToNodeIds (first)
    for (const [name, ids] of nameToNodeIds.entries()) {
        if (ids && ids.length) codeOrNameToNodeId.set(String(name), ids[0]);
    }

    // fallback: map node item.Name and item.Code from allNodesSoFar
    allNodesSoFar.forEach(n => {
        const it = n?.data?.item || {};
        if (it.Code) codeOrNameToNodeId.set(String(it.Code), n.id);
        if (it['Item Code']) codeOrNameToNodeId.set(String(it['Item Code']), n.id);
        if (it.Name) codeOrNameToNodeId.set(String(it.Name), n.id);
        if (it.Type) codeOrNameToNodeId.set(String(it.Type), n.id);
        // also normalized name variants (no underscores / lowercase)
        if (it.Name) codeOrNameToNodeId.set(String(it.Name).replace(/[_\s]+/g, '').toLowerCase(), n.id);
        if (it.Name) codeOrNameToNodeId.set(String(it.Name).toLowerCase(), n.id);
    });

    // helper: try many variants to resolve a ref -> nodeId
    function resolveRefToNodeIdForReturn(ref) {
        if (!ref && ref !== 0) return null;
        const raw = String(ref).trim();
        if (!raw) return null;

        // 1) direct node id
        if (allNodesSoFar.some(n => n.id === raw)) return raw;

        // 2) exact code/name
        if (codeOrNameToNodeId.has(raw)) return codeOrNameToNodeId.get(raw);

        // 3) normalized variants
        const variants = [
            raw,
            raw.replace(/^0+/, ''),                 // strip leading zeros
            raw.replace(/\s+/g, ''),                // concat
            raw.replace(/\s+/g, '_'),               // underscored
            raw.toLowerCase(),
            raw.toLowerCase().replace(/[_\s]+/g, ''),
        ];
        for (const v of variants) {
            if (!v) continue;
            if (codeOrNameToNodeId.has(v)) return codeOrNameToNodeId.get(v);
        }

        // 4) try to match by numeric suffix base+index (Tank2 -> 2nd new Tank)
        const parsed = parseBaseAndIndex(raw);
        if (parsed) {
            const nodeId = getNthNodeIdForBaseName(parsed.base, parsed.index);
            if (nodeId) return nodeId;
        }

        // 5) try to match by normalized name tokens (best-effort)
        const key = raw.toLowerCase().replace(/[_\s]+/g, '');
        for (const [k, nodeId] of codeOrNameToNodeId.entries()) {
            if (!k) continue;
            const kk = String(k).toLowerCase().replace(/[_\s]+/g, '');
            if (kk === key || kk.endsWith(key) || kk.includes(key) || key.includes(kk)) {
                return nodeId;
            }
        }

        return null;
    }

    // remap edges: create a stable set to avoid duplicates
    const mappedEdgeSet = new Set();
    const remappedEdges = [];

    (newEdges || []).forEach(e => {
        if (!e) return;
        // if edge already references node ids, keep as-is
        const srcCandidate = resolveRefToNodeIdForReturn(e.source);
        const tgtCandidate = resolveRefToNodeIdForReturn(e.target);

        const srcId = srcCandidate || (allNodesSoFar.some(n => n.id === e.source) ? e.source : null);
        const tgtId = tgtCandidate || (allNodesSoFar.some(n => n.id === e.target) ? e.target : null);

        // If either side could not be resolved to a node id, skip adding the edge (avoids dangling edges)
        if (!srcId || !tgtId) {
            console.warn('Unresolved AI edge endpoint', { rawSource: e.source, rawTarget: e.target, srcResolved: srcId, tgtResolved: tgtId });
            return;
        }

        const edgeId = `edge-${srcId}-${tgtId}`;

        // avoid duplicates
        const sig = `${srcId}→${tgtId}`;
        if (mappedEdgeSet.has(sig)) return;
        mappedEdgeSet.add(sig);

        remappedEdges.push({
            ...e,
            id: edgeId,
            source: srcId,
            target: tgtId,
            data: { ...(e.data || {}), _rawSource: e.source, _rawTarget: e.target }
        });
    });

    // Replace newEdges with remappedEdges for return
    const existingSignatures = new Set((existingEdges || []).map(en => `${en.source}→${en.target}`));
    const finalEdges = [
        ...(existingEdges || []),
        ...remappedEdges.filter(re => !existingSignatures.has(`${re.source}→${re.target}`))
    ];

    // assign newEdges -> finalEdges so the rest of the function returns correct edges
    newEdges.length = 0;
    newEdges.push(...finalEdges);

    // --- END: REMAP AI edges to actual node IDs ---

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
