import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNodesState, useEdgesState, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';
import GroupDetailCard from './GroupDetailCard';
import { getItemIcon, handleItemChangeNode } from './IconManager';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import DiagramCanvas from './DiagramCanvas';
import AddItemButton from './AddItemButton';
import { buildDiagram } from './diagramBuilder';

const mergeEdges = (prevEdges = [], newEdges = [], validNodeIds = new Set()) => {
    const key = (e) => `${e.source}->${e.target}`;
    const filterValid = (arr) =>
        (arr || []).filter((e) => e && validNodeIds.has(String(e.source)) && validNodeIds.has(String(e.target)));
    const prevFiltered = filterValid(prevEdges);
    const newFiltered = filterValid(newEdges);
    const seen = new Set(prevFiltered.map(key));
    const merged = [...prevFiltered];
    for (const e of newFiltered) if (!seen.has(key(e))) merged.push(e);
    return merged;
};

const normalizeTypeKey = (s) =>
    (s || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "");

// --- Type resolvers (resolve Airtable rec ids -> readable names) ---
const isRecId = (s) => typeof s === 'string' && s.startsWith('rec');

async function buildTypeIdToNameMap() {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const equipTypesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
    const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;
    const headers = { Authorization: `Bearer ${token}` };
    const map = new Map();

    async function loadTable(tableId) {
        if (!tableId) return;
        let offset = null;
        do {
            const url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            const res = await fetch(url, { headers });
            if (!res.ok) break;
            const data = await res.json();
            (data.records || []).forEach(r => {
                const name =
                    r?.fields?.['Still Pipe'] ||
                    r?.fields?.['Name'] ||
                    r?.fields?.['Type'] ||
                    '';
                if (name) map.set(r.id, String(name));
            });
            offset = data.offset;
        } while (offset);
    }

    await loadTable(equipTypesTableId);
    await loadTable(valveTypesTableId);
    return map;
}

async function resolveTypesInItems(items) {
    try {
        const idMap = await buildTypeIdToNameMap();
        return items.map((it) => {
            const raw = Array.isArray(it.Type) ? (it.Type[0] ?? '') : (it.Type ?? '');
            if (isRecId(raw) && idMap.has(raw)) {
                const name = idMap.get(raw);
                return { ...it, Type: name, TypeKey: normalizeTypeKey(name) };
            }
            return it;
        });
    } catch {
        return items;
    }
}

// --- Helper: drop direct src->dst edges when a valve node routes between them ---
const pruneDirectEdgesIfValvePresent = (edges = [], nodes = []) => {
    const E = Array.isArray(edges) ? edges : [];
    if (!E.length) return E;

    const nodeMap = new Map((nodes || []).map(n => [String(n.id), n]));
    const isValve = (n) => {
        const it = n?.data?.item;
        const cat = it?.['Category Item Type'] ?? it?.Category ?? '';
        return String(cat).trim().toLowerCase() === 'inline valve';
    };

    // src -> [edges]
    const outBySrc = new Map();
    for (const e of E) {
        if (!outBySrc.has(e.source)) outBySrc.set(e.source, []);
        outBySrc.get(e.source).push(e);
    }

    // Any path src -> V (valve) and V -> dst means: drop direct src -> dst (and reverse for safety)
    const blockPairs = new Set();
    for (const e1 of E) {
        const maybeValve = nodeMap.get(String(e1.target));
        if (!maybeValve || !isValve(maybeValve)) continue;

        const viaValve = outBySrc.get(maybeValve.id) || [];
        for (const e2 of viaValve) {
            blockPairs.add(`${e1.source}->${e2.target}`);  // src -> dst
            blockPairs.add(`${e2.target}->${e1.source}`);  // dst -> src (optional)
        }
    }

    return E.filter(e => !blockPairs.has(`${e.source}->${e.target}`));
};

export const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
};

export const fetchData = async () => {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

    let allRecords = [];
    let offset = null;
    const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

    do {
        const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset;
    } while (offset);

    return allRecords.map((rec) => ({ id: rec.id, ...rec.fields }));
};

export default function ProcessDiagram() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [aiDescription, setAiDescription] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [unitLayoutOrder, setUnitLayoutOrder] = useState([]);
    const [availableUnitsForConfig, setAvailableUnitsForConfig] = useState([]);
    const prevItemsRef = useRef([]);

    const updateNode = useCallback((id, newData) => {
        setNodes((nds) => nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node)));
    }, [setNodes]);

    const deleteNode = useCallback((id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }, [setNodes, setEdges]);

    // ---------- Selection: only set when we truly have a node/edge; never clear on empty ----------
    const onSelectionChange = useCallback(
        ({ nodes: selNodes = [], edges: selEdges = [] }) => {
            setSelectedNodes(selNodes);

            if (selNodes.length === 1) {
                const selNode = selNodes[0];
                const fromItems = items.find((it) => String(it.id) === String(selNode.id));
                const live = { x: selNode?.position?.x, y: selNode?.position?.y };
                if (fromItems) { setSelectedItem({ ...fromItems, ...live }); return; }
                if (selNode?.data?.item) { setSelectedItem({ ...selNode.data.item, ...live }); return; }
                // leave selectedItem as-is if we couldn’t resolve yet (avoid flicker)
                return;
            }

            if (selEdges.length === 1) {
                const edge = selEdges[0];
                const fromItem = items.find((it) => it.id === edge.source) || null;
                const toItem = items.find((it) => it.id === edge.target) || null;
                setSelectedItem({
                    id: edge.id,
                    Name: 'Edge inspector',
                    'Item Code': edge.id,
                    edgeId: edge.id,
                    from: fromItem?.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
                    to: toItem?.Name ? `${toItem.Name} (${edge.target})` : edge.target,
                    x: (fromItem?.x && toItem?.x) ? (fromItem.x + toItem.x) / 2 : undefined,
                    y: (fromItem?.y && toItem?.y) ? (fromItem.y + toItem.y) / 2 : undefined,
                    _edge: edge,
                });
                return;
            }

            // If neither nodes nor edges selected, DO NOT clear selectedItem here.
            // This prevents brief empty-selection events from hiding the panel.
        },
        [items]
    );
    // --- Persist canvas edges -> Airtable "Connections" (debounced) ---
    const persistDebounceRef = React.useRef(null);

    const persistConnectionsToAirtable = React.useCallback(async (records) => {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
        if (!baseId || !token || !table || !records?.length) return;

        // Batch PATCH
        await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records }),
        });
    }, []);

    useEffect(() => {
        if (!items.length) return;

        // Build: sourceId -> [targetCodes]
        const byId = new Map(items.map(it => [String(it.id), it]));
        const nextMap = new Map();

        (edges || []).forEach(e => {
            const srcId = String(e.source);
            const tgt = byId.get(String(e.target));
            const tgtCode = tgt?.Code || tgt?.['Item Code'] || '';
            if (!tgtCode) return;
            if (!nextMap.has(srcId)) nextMap.set(srcId, []);
            const arr = nextMap.get(srcId);
            if (!arr.includes(tgtCode)) arr.push(tgtCode);
        });

        // Compute changed records only
        const records = [];
        // updates / inserts
        nextMap.forEach((codes, srcId) => {
            const cur = byId.get(srcId);
            const curCodes = Array.isArray(cur?.Connections) ? cur.Connections : [];
            const same = curCodes.length === codes.length && curCodes.every(c => codes.includes(c));
            if (!same) records.push({ id: srcId, fields: { Connections: codes } });
        });
        // clears (had connections but now no outgoing edges)
        items.forEach(it => {
            const hasEdges = nextMap.has(String(it.id));
            const curCodes = Array.isArray(it.Connections) ? it.Connections : [];
            if (!hasEdges && curCodes.length) {
                records.push({ id: String(it.id), fields: { Connections: [] } });
            }
        });

        if (!records.length) return;

        // debounce to avoid hammering Airtable as you drag/connect
        if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = setTimeout(() => {
            persistConnectionsToAirtable(records).catch(console.error);
        }, 600);

        return () => clearTimeout(persistDebounceRef.current);
    }, [edges, items, persistConnectionsToAirtable]);

    // ---------- Connect ----------
    const onConnect = useCallback((params) => {
        const updatedEdges = addEdge(
            { ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } },
            edges
        );
        setEdges(updatedEdges);
        setItems((prev) => {
            const src = prev.find((it) => String(it.id) === String(params.source));
            const dst = prev.find((it) => String(it.id) === String(params.target));
            if (!src || !dst) return prev;
            const dstCode = dst.Code || dst['Item Code'] || '';
            if (!dstCode) return prev;
            return prev.map((it) => {
                if (String(it.id) !== String(src.id)) return it;
                const cur = Array.isArray(it.Connections) ? it.Connections : [];
                if (cur.includes(dstCode)) return it;
                return { ...it, Connections: [...cur, dstCode] };
            });
        });
    }, [edges]);

    // ---------- Group drag (shift children live) ----------
    const onNodeDrag = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;

        setNodes((nds) =>
            nds.map((n) => {
                if (!n?.data) return n;
                const isChild =
                    (Array.isArray(draggedNode.data?.children) && draggedNode.data.children.includes(n.id)) ||
                    n.data.groupId === draggedNode.id ||
                    n.data.parentId === draggedNode.id;
                if (!isChild) return n;

                const dx = draggedNode.position.x - (draggedNode.data.prevX ?? draggedNode.position.x);
                const dy = draggedNode.position.y - (draggedNode.data.prevY ?? draggedNode.position.y);
                return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
            })
        );

        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: draggedNode.position.x, prevY: draggedNode.position.y } }
                    : n
            )
        );
    }, [setNodes]);

    // ---------- Drag stop: clear markers for group; persist x/y for normal nodes ----------
    const onNodeDragStop = useCallback((event, draggedNode) => {
        if (!draggedNode) return;

        if (draggedNode.type === 'groupLabel') {
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === draggedNode.id ? { ...n, data: { ...n.data, prevX: undefined, prevY: undefined } } : n
                )
            );
            return;
        }

        if (!draggedNode?.data?.item) return;
        const { x, y } = draggedNode.position || {};
        if (Number.isFinite(x) && Number.isFinite(y)) {
            setItems((prev) =>
                prev.map((it) => (String(it.id) === String(draggedNode.id) ? { ...it, x, y } : it))
            );
            setSelectedItem((cur) =>
                cur && String(cur.id) === String(draggedNode.id) ? { ...cur, x, y } : cur
            );
        }
    }, [setNodes, setItems, setSelectedItem]);

    // ---------- Edge helpers ----------
    const handleUpdateEdge = useCallback((edgeId, patch) => {
        setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)));
        setSelectedItem((cur) => (cur?.edgeId === edgeId ? { ...cur, _edge: { ...cur._edge, ...patch } } : cur));
    }, []);

    const handleCreateInlineValve = useCallback((edgeId) => {
        const edge = edges.find((e) => e.id === edgeId);
        if (!edge) return;

        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        const uid = `valve-${Date.now()}`;
        const code = `VAL-${Date.now()}`;

        const newItem = {
            id: uid,
            Code: code,
            "Item Code": code,
            Name: "Inline Valve",
            Category: "Inline Valve",
            "Category Item Type": "Inline Valve",
            Type: [],
            Unit: sourceNode?.data?.item?.Unit || "No Unit",
            SubUnit: sourceNode?.data?.item?.SubUnit || "Default SubUnit",
            x: midX, y: midY,
            edgeId: edge.id,
        };

        const newNode = {
            id: uid,
            position: { x: midX, y: midY },
            data: {
                label: `${newItem["Item Code"]} - ${newItem.Name}`,
                item: newItem,
                icon: getItemIcon ? getItemIcon(newItem) : undefined,
            },
            type: "scalableIcon",
            sourcePosition: "right",
            targetPosition: "left",
            style: { background: "transparent" },
        };

        // Add the valve node
        setNodes((nds) => [...nds, newNode]);

        // Replace direct edges (both directions) and PRUNE
        setEdges((eds) => {
            const baseStyle = edge.style || {};
            const filtered = (eds || []).filter(
                (e) =>
                    e.id !== edge.id &&
                    !((e.source === edge.source && e.target === edge.target) ||
                        (e.source === edge.target && e.target === edge.source))
            );

            const e1 = {
                id: `edge-${edge.source}-${uid}-${Date.now()}`,
                source: edge.source,
                target: uid,
                type: edge.type || "smoothstep",
                animated: edge.animated ?? true,
                style: { ...baseStyle },
            };
            const e2 = {
                id: `edge-${uid}-${edge.target}-${Date.now()}`,
                source: uid,
                target: edge.target,
                type: edge.type || "smoothstep",
                animated: edge.animated ?? true,
                style: { ...baseStyle },
            };

            const next = [...filtered, e1, e2];
            const allNodes = [...nodes, newNode];
            return pruneDirectEdgesIfValvePresent(next, allNodes);
        });

        // Persist connections: src->valve, valve->dst; remove src->dst and dst->src (if present)
        setItems((prev) => {
            const arr = Array.isArray(prev) ? [...prev] : [];
            const srcIdx = arr.findIndex((it) => String(it.id) === String(edge.source));
            const dstIdx = arr.findIndex((it) => String(it.id) === String(edge.target));

            const srcCode = arr[srcIdx]?.Code || arr[srcIdx]?.['Item Code'] || '';
            const srcName = arr[srcIdx]?.Name || '';
            const dstCode = arr[dstIdx]?.Code || arr[dstIdx]?.['Item Code'] || '';
            const dstName = arr[dstIdx]?.Name || '';

            const norm = (s) => String(s || '').trim().toLowerCase();
            const removeRefTo = (list = [], targetId, targetCode, targetName) =>
                list.filter((c) => {
                    if (typeof c === 'string') {
                        const v = norm(c);
                        return v !== norm(targetCode) && (targetName ? v !== norm(targetName) : true);
                    }
                    if (c && typeof c === 'object') {
                        if (c.to && (norm(c.to) === norm(targetName) || norm(c.to) === norm(targetCode))) return false;
                        if (c.toId && String(c.toId) === String(targetId)) return false;
                    }
                    return true;
                });

            // add valve item (valve -> dst)
            if (!arr.some((it) => String(it.id) === String(uid))) {
                arr.push({ ...newItem, Connections: dstCode ? [dstCode] : [] });
            }

            // replace src->dst with src->valve
            if (srcIdx !== -1) {
                const cur = Array.isArray(arr[srcIdx].Connections) ? arr[srcIdx].Connections : [];
                const cleaned = removeRefTo(cur, edge.target, dstCode, dstName);
                if (!cleaned.includes(code)) cleaned.push(code);
                arr[srcIdx] = { ...arr[srcIdx], Connections: cleaned };
            }

            // remove dst->src reverse link (if your data ever has it)
            if (dstIdx !== -1) {
                const cur = Array.isArray(arr[dstIdx].Connections) ? arr[dstIdx].Connections : [];
                const cleaned = removeRefTo(cur, edge.source, srcCode, srcName);
                arr[dstIdx] = { ...arr[dstIdx], Connections: cleaned };
            }

            return arr;
        });

        setSelectedItem(newItem);
    }, [edges, nodes, setNodes, setEdges, setItems, setSelectedItem]);

    // ---------- AI generator ----------
    const handleGeneratePNID = useCallback(async () => {
        if (!aiDescription?.trim()) return;

        try {
            const { nodes: aiNodes, edges: aiEdges, normalizedItems } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            // 1) Normalize: AI items → array of item objects
            const aiItems =
                normalizedItems ||
                (Array.isArray(aiNodes) ? aiNodes.map(n => n?.data?.item).filter(Boolean) : []);

            // 2) Merge items (avoid duplicates by id)
            const nextItems = [...items];
            const seen = new Set(nextItems.map(i => String(i.id)));
            aiItems.forEach(it => { if (it?.id && !seen.has(String(it.id))) nextItems.push(it); });

            // 3) Make sure the layout includes any new Units
            const ensureUnits = (layout, units) => {
                const out = Array.isArray(layout) && layout.length ? layout.map(r => [...r]) : [[]];
                const flat = new Set(out.flat());
                units.forEach(u => { if (!flat.has(u)) out[0].push(u); });
                return out;
            };
            const unitsInData = [...new Set(nextItems.map(i => i.Unit))];
            const patchedLayout = ensureUnits(unitLayoutOrder, unitsInData);
            if (patchedLayout !== unitLayoutOrder) setUnitLayoutOrder(patchedLayout);

            // 4) Build nodes/edges via your builder (keeps unit frames + positions)
            const built = buildDiagram(nextItems, patchedLayout, { prevNodes: nodes });
            setNodes(built.nodes);

            // 5) Merge edges safely THEN prune
            const validIds = new Set(built.nodes.map(n => n.id));
            setEdges(prev =>
                pruneDirectEdgesIfValvePresent(
                    mergeEdges(prev, built.edges, validIds),
                    built.nodes
                )
            );

            // 6) Commit items and auto-select a new node if any
            setItems(nextItems);
            const newNodes = built.nodes.filter(n => !items.some(old => String(old.id) === String(n.id)));
            if (newNodes[0]) {
                setSelectedNodes([newNodes[0]]);
                setSelectedItem(newNodes[0].data?.item ?? null);
            }
        } catch (err) {
            console.error("AI PNID generation failed:", err);
            alert("AI generation failed. Check your VITE_GOOGLE_API_KEY and /api/parse-item logs.");
        }
    }, [aiDescription, items, nodes, edges, unitLayoutOrder, setChatMessages, setSelectedItem, setSelectedNodes]);

    // ---------- Initial load ----------
    useEffect(() => {
        const loadItems = async () => {
            try {
                const itemsRaw = await fetchData();

                // 1) Normalize what comes from Airtable
                const normalizedItems = itemsRaw.map((item) => {
                    const rawCat = item['Category Item Type'] ?? item.Category ?? '';
                    const cat = Array.isArray(rawCat) ? (rawCat[0] ?? '') : String(rawCat || '');
                    const rawType = Array.isArray(item.Type) ? (item.Type[0] ?? '') : String(item.Type || '');
                    return {
                        id: item.id || `${item.Name}-${Date.now()}`,
                        Name: item.Name || '',
                        Code: item['Item Code'] || item.Code || '',
                        'Item Code': item['Item Code'] || item.Code || '',
                        Unit: item.Unit || 'Default Unit',
                        SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
                        Category: cat,
                        'Category Item Type': cat,
                        Type: rawType,
                        TypeKey: normalizeTypeKey(rawType),
                        Sequence: item.Sequence || 0,
                        Connections: Array.isArray(item.Connections)
                            ? item.Connections
                            : (typeof item.Connections === 'string'
                                ? item.Connections.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
                                : []),

                    };
                });

                // 2) NEW: resolve recXXXX Type ids -> readable names (Tank, Pump, …)
                const resolvedItems = await resolveTypesInItems(normalizedItems);

                // 3) Units/layout
                const uniqueUnits = [...new Set(resolvedItems.map((i) => i.Unit))];
                const unitLayout2D = [uniqueUnits];
                setUnitLayoutOrder(unitLayout2D);

                // 4) Build nodes/edges using the resolved items
                const { nodes: builtNodes, edges: builtEdges } = buildDiagram(resolvedItems, unitLayout2D);
                setNodes(builtNodes);

                const validIdsInit = new Set((builtNodes || []).map((n) => n.id));
                setEdges((prev) =>
                    pruneDirectEdgesIfValvePresent(
                        mergeEdges(prev, builtEdges, validIdsInit),
                        builtNodes
                    )
                );

                // 5) Mirror positions back to items
                const posById = Object.fromEntries((builtNodes || []).map((n) => [String(n.id), n.position || {}]));
                const itemsWithPos = resolvedItems.map((it) => {
                    const p = posById[String(it.id)];
                    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { ...it, x: p.x, y: p.y } : it;
                });

                setItems(itemsWithPos);
                prevItemsRef.current = itemsWithPos;

                const uniqueUnitsObjects = uniqueUnits.map((u) => ({ id: u, Name: u }));
                setAvailableUnitsForConfig(uniqueUnitsObjects);
            } catch (err) {
                console.error('Error loading items:', err);
            }
        };


        loadItems();
    }, []);

    // ---------- Rebuild on unit layout change; mirror positions back to items ----------
    useEffect(() => {
        if (!items.length || !unitLayoutOrder.length) return;

        const prevItems = prevItemsRef.current || [];
        const prevMap = Object.fromEntries(prevItems.map((i) => [String(i.id), i]));
        const unitChangedIds = new Set(
            items.filter((i) => {
                const p = prevMap[String(i.id)];
                return p && p.Unit !== i.Unit;
            }).map((i) => String(i.id))
        );

        const { nodes: rebuiltNodes, edges: rebuiltEdges } =
            buildDiagram(items, unitLayoutOrder, { prevNodes: nodes, unitChangedIds });

        setNodes(rebuiltNodes);
        const validIds = new Set((rebuiltNodes || []).map((n) => n.id));

        setEdges((prev) => {
            const merged = mergeEdges(prev, rebuiltEdges, validIds);
            return pruneDirectEdgesIfValvePresent(merged, rebuiltNodes);
        });

        // Mirror positions → items[] (only if changed)
        setItems((prev) => {
            const posById = Object.fromEntries((rebuiltNodes || []).map((n) => [String(n.id), n.position || {}]));
            let changed = false;
            const next = prev.map((it) => {
                const p = posById[String(it.id)];
                if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && (it.x !== p.x || it.y !== p.y)) {
                    changed = true;
                    return { ...it, x: p.x, y: p.y };
                }
                return it;
            });
            return changed ? next : prev;
        });

        prevItemsRef.current = items;
    }, [items, unitLayoutOrder]); // eslint-disable-line react-hooks/exhaustive-deps

    const itemsMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

    const selectedGroupNode =
        selectedNodes.length === 1 && selectedNodes[0]?.type === 'groupLabel' ? selectedNodes[0] : null;

    const childrenNodesForGroup = selectedGroupNode
        ? nodes.filter((n) => {
            if (!n) return false;
            if (Array.isArray(selectedGroupNode.data?.children) && selectedGroupNode.data.children.includes(n.id)) return true;
            if (n.data?.groupId === selectedGroupNode.id) return true;
            if (n.data?.parentId === selectedGroupNode.id) return true;
            return false;
        })
        : [];

    const handleAddItem = (rawItem) => {
        setItems((prevItems) => {
            const firstKnownUnit =
                Array.isArray(unitLayoutOrder) && unitLayoutOrder.length && unitLayoutOrder[0].length
                    ? unitLayoutOrder[0][0]
                    : (prevItems[0]?.Unit || 'Unit 1');

            const normalizedItem = {
                id: rawItem.id || `item-${Date.now()}`,
                Name: rawItem.Name || 'New Item',
                Code: rawItem.Code ?? rawItem['Item Code'] ?? `CODE-${Date.now()}`,
                'Item Code': rawItem['Item Code'] ?? rawItem.Code ?? '',
                Unit: rawItem.Unit || selectedItem?.Unit || firstKnownUnit || 'Unit 1',
                SubUnit: rawItem.SubUnit ?? rawItem['Sub Unit'] ?? 'Default SubUnit',
                Category: Array.isArray(rawItem['Category Item Type'])
                    ? rawItem['Category Item Type'][0]
                    : (rawItem['Category Item Type'] ?? rawItem.Category ?? 'Equipment'),
                'Category Item Type': Array.isArray(rawItem['Category Item Type'])
                    ? rawItem['Category Item Type'][0]
                    : (rawItem['Category Item Type'] ?? rawItem.Category ?? 'Equipment'),
                Type: Array.isArray(rawItem.Type) ? rawItem.Type[0] : (rawItem.Type || ''),
                Sequence: rawItem.Sequence ?? 0,
                Connections: Array.isArray(rawItem.Connections) ? rawItem.Connections : [],
            };

            const nextItems = [...prevItems, normalizedItem];
            const ensureUnitInLayout = (layout, unit) => {
                if (!Array.isArray(layout) || !layout.length) return [[unit]];
                const flat = new Set(layout.flat());
                if (!flat.has(unit)) {
                    const copy = layout.map((row) => [...row]);
                    copy[0].push(unit);
                    return copy;
                }
                return layout;
            };

            const currentLayout = (Array.isArray(unitLayoutOrder) && unitLayoutOrder.length) ? unitLayoutOrder : [[]];
            const patchedLayout = ensureUnitInLayout(currentLayout, normalizedItem.Unit);
            if (patchedLayout !== unitLayoutOrder) setUnitLayoutOrder(patchedLayout);

            const { nodes: rebuiltNodes, edges: rebuiltEdges } = buildDiagram(nextItems, patchedLayout);
            setNodes(rebuiltNodes);
            setEdges(rebuiltEdges);

            const addedNode = rebuiltNodes.find((n) => n.id === normalizedItem.id);
            if (addedNode) {
                const { x, y } = addedNode.position || {};
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    nextItems[nextItems.length - 1] = { ...normalizedItem, x, y };
                }
            }
            setSelectedItem(nextItems[nextItems.length - 1]);
            return nextItems;
        });
    };

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
            {/* LEFT: Diagram */}
            <div style={{ flex: 3, position: "relative", background: "transparent" }}>
                <DiagramCanvas
                    nodes={nodes}
                    edges={edges}
                    setNodes={setNodes}
                    setEdges={setEdges}
                    /* DO NOT pass setSelectedItem to avoid it being cleared inside DiagramCanvas */
                    setItems={setItems}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypes}
                    /* we’re not using DiagramCanvas’s internal edge inspector here */
                    showInlineEdgeInspector={false}
                    AddItemButton={AddItemButton}
                    addItem={handleAddItem}
                    aiDescription={aiDescription}
                    setAiDescription={setAiDescription}
                    handleGeneratePNID={handleGeneratePNID}
                    chatMessages={chatMessages}
                    setChatMessages={setChatMessages}
                    selectedNodes={selectedNodes}
                    updateNode={updateNode}
                    deleteNode={deleteNode}
                    ChatBox={ChatBox}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                    availableUnits={availableUnitsForConfig}
                    onUnitLayoutChange={setUnitLayoutOrder}
                    onCreateInlineValve={handleCreateInlineValve}
                />
            </div>

            {/* RIGHT: Sidebar */}
            <div style={{ flex: 1, overflowY: "auto" }}>
                {selectedGroupNode ? (
                    <GroupDetailCard
                        node={selectedGroupNode}
                        childrenNodes={childrenNodesForGroup}
                        childrenLabels={selectedGroupNode?.data?.children}
                        allItems={itemsMap}
                        startAddItemToGroup={() => { }}
                        onAddItem={() => { }}
                        onRemoveItem={() => { }}
                        onDelete={() => { }}
                    />
                ) : selectedItem ? (
                    <ItemDetailCard
                        item={selectedItem}
                        items={items}
                        edges={edges}
                        onChange={(updatedItem) =>
                            handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)
                        }
                        onDeleteEdge={(id) => {
                            if (!id) return;
                            setEdges((eds) => eds.filter((e) => e.id !== id));
                            setNodes((nds) => nds.filter((n) => !(n?.data?.item?.edgeId && n.data.item.edgeId === id)));
                            setSelectedItem((cur) => (cur?.edgeId === id ? null : cur));
                        }}
                        onUpdateEdge={handleUpdateEdge}
                        onCreateInlineValve={(edgeId) => handleCreateInlineValve(edgeId)}
                    />
                ) : (
                    <div style={{ padding: 20, color: "#888" }}>Select an item or group to see details</div>
                )}
            </div>
        </div>
    );
}
