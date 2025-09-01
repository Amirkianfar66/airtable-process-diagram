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
// Helpers for name/code resolution
// --------------------------
function normalizeKey(s) {
    if (!s) return "";
    // lowercase, remove separators, keep alnum only, collapse numeric leading zeros
    const str = String(s).trim().toLowerCase();
    const compact = str.replace(/[_\s,-]+/g, "");
    return compact.replace(/^0+/, "").replace(/[^a-z0-9]/g, "");
}

/**
 * resolveRefToCode(ref, normalizedItems)
 * - Tries to map a reference (could be code like "0001" or name like "Tank1" or "Tank_2")
 *   to a canonical generated code (string) using normalizedItems.
 * - normalizedItems should be the array of items produced in this run (in creation order).
 */
function resolveRefToCode(ref, normalizedItems = []) {
    if (!ref) return null;
    const raw = String(ref).trim();

    // 1) Direct code match (exact)
    const direct = normalizedItems.find(i => String(i.Code) === raw);
    if (direct) return String(direct.Code);

    // 2) Exact name match (case-insensitive)
    const exact = normalizedItems.find(i => i.Name && i.Name.toLowerCase() === raw.toLowerCase());
    if (exact) return String(exact.Code);

    // 3) Name + index pattern, e.g. "Tank2", "Tank_2", "Tank 2"
    const m = raw.match(/^(.+?)[_\s-]*([0-9]+)$/);
    if (m) {
        const baseRaw = m[1];
        const idx = parseInt(m[2], 10);
        const baseKey = normalizeKey(baseRaw);

        // filter candidates whose normalized name starts with the baseKey
        const candidates = normalizedItems.filter(it => normalizeKey(it.Name).startsWith(baseKey));
        if (candidates.length > 0) {
            // idx is 1-based: return candidate[idx-1] if exists
            if (idx >= 1 && idx <= candidates.length) return String(candidates[idx - 1].Code);
            // out of range: return best-effort first
            return String(candidates[0].Code);
        }
    }

    // 4) Loose base-name match (no index): find first item whose normalized name starts with base
    const base = normalizeKey(raw);
    const loose = normalizedItems.find(it => normalizeKey(it.Name).startsWith(base));
    if (loose) return String(loose.Code);

    // 5) fallback: return raw so callers can decide
    return raw;
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

    // --------------------------
    // Handle explicit connections (from parseItemLogic). Prefer these first.
    // Ensure direction follows the parsed-items order (first-mentioned -> second-mentioned).
    // --------------------------
    const explicitConnectionsArr = Array.isArray(parserConnections) ? parserConnections : (parserConnections ? [parserConnections] : []);
    let explicitAddedCount = 0;

    // build a code -> index map based on normalizedItems order (this reflects parsed order)
    const codeToIndex = new Map();
    normalizedItems.forEach((item, idx) => {
        if (item && item.Code !== undefined && item.Code !== null) {
            codeToIndex.set(String(item.Code), idx);
            if (item.Name) {
                codeToIndex.set(String(item.Name).toLowerCase(), idx);
            }
        }
    });

    // --------------------------
    // Handle explicit connections (from parseItemLogic). Prefer these first.
    // Ensure direction follows the parsed-items order (first-mentioned -> second-mentioned).
    explicitConnectionsArr.forEach(connObj => {
        if (!connObj) return;

        const fromRef = connObj.sourceCode || connObj.from || connObj.fromCode || connObj.source || null;
        const toRef = connObj.targetCode || connObj.to || connObj.toCode || connObj.target || null;
        if (!fromRef || !toRef) return;

        // try a variety of variants for a reference like "Tank2" / "Tank 2" / "Tank_2" / "0001"
        function tryResolveVariants(ref) {
            if (!ref) return null;
            const raw = String(ref).trim();

            // 1) direct attempt with resolveRefToCode (your helper)
            let r = resolveRefToCode(raw, normalizedItems);
            if (r && r !== raw) return r;

            // 2) common variants
            const variants = [
                raw,
                raw.replace(/[_\s]+/g, ''),    // Tank 2 -> Tank2
                raw.replace(/[_\s]+/g, '_'),   // Tank 2 -> Tank_2
                raw.replace(/\s+/g, ' '),      // normalize spaces
                raw.toLowerCase(),
                raw.toLowerCase().replace(/[_\s]+/g, ''),
                raw.toLowerCase().replace(/[_\s]+/g, '_'),
            ].filter(Boolean);

            for (const v of variants) {
                r = resolveRefToCode(v, normalizedItems);
                if (r && r !== v) return r;
            }

            // 3) numeric-suffix heuristic: "Tank2" => "Tank 2" or "Tank_2"
            const m = raw.match(/^([a-zA-Z]+)0*([0-9]+)$/);
            if (m) {
                const tryA = `${m[1]} ${Number(m[2])}`;
                const tryB = `${m[1]}_${Number(m[2])}`;
                r = resolveRefToCode(tryA, normalizedItems) || resolveRefToCode(tryB, normalizedItems);
                if (r) return r;
            }

            // 4) fallback: if ref already looks like a generated code, return it directly
            if (String(raw).match(/^[0-9_]+$/)) return raw;

            return null;
        }

        let resolvedFromCode = tryResolveVariants(fromRef) || fromRef;
        let resolvedToCode = tryResolveVariants(toRef) || toRef;

        // Use parsed-order map to decide orientation: codeToIndex (built earlier)
        const idxFromVal = codeToIndex.has(String(resolvedFromCode)) ? codeToIndex.get(String(resolvedFromCode)) : Infinity;
        const idxToVal = codeToIndex.has(String(resolvedToCode)) ? codeToIndex.get(String(resolvedToCode)) : Infinity;

        // If both indexes are known and reversed, swap to maintain parsed first->second order
        if (Number.isFinite(idxFromVal) && Number.isFinite(idxToVal) && idxFromVal > idxToVal) {
            [resolvedFromCode, resolvedToCode] = [resolvedToCode, resolvedFromCode];
        }

        console.log("🔗 Trying explicit connection:", { fromRef, toRef, resolvedFromCode, resolvedToCode, idxFromVal, idxToVal });

        // locate node IDs (try code lookup then name lookup)
        let srcNodeId = codeToNodeId.get(String(resolvedFromCode));
        if (!srcNodeId && typeof resolvedFromCode === "string") {
            srcNodeId = nameToNodeId.get(String(resolvedFromCode).toLowerCase());
        }

        let tgtNodeId = codeToNodeId.get(String(resolvedToCode));
        if (!tgtNodeId && typeof resolvedToCode === "string") {
            tgtNodeId = nameToNodeId.get(String(resolvedToCode).toLowerCase());
        }

        // final fallback: search normalizedItems for matching code or name (loose)
        if ((!srcNodeId || !tgtNodeId) && normalizedItems.length) {
            if (!srcNodeId) {
                const cand = normalizedItems.find(it => String(it.Code) === String(resolvedFromCode) || (it.Name && it.Name.toLowerCase() === String(resolvedFromCode).toLowerCase()));
                if (cand) srcNodeId = codeToNodeId.get(String(cand.Code));
            }
            if (!tgtNodeId) {
                const cand = normalizedItems.find(it => String(it.Code) === String(resolvedToCode) || (it.Name && it.Name.toLowerCase() === String(resolvedToCode).toLowerCase()));
                if (cand) tgtNodeId = codeToNodeId.get(String(cand.Code));
            }
        }

        if (srcNodeId && tgtNodeId) {
            const added = addEdgeByNodeIds(srcNodeId, tgtNodeId, { type: 'smoothstep' });
            if (added) {
                allMessages.push({ sender: "AI", message: `→ Connected ${resolvedFromCode} → ${resolvedToCode}` });
                explicitAddedCount++;
            }
        } else {
            console.warn("⚠️ Could not resolve explicit connection to node IDs:", { fromRef, toRef, resolvedFromCode, resolvedToCode, srcNodeId, tgtNodeId, normalizedItems });
        }
    });


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
