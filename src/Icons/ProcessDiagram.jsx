// Updated: ProcessDiagram.jsx (adds onNodeDrag to move child nodes live while dragging)
// ------------------------------
// Place this content into src/components/ProcessDiagram.jsx (replace existing)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, { useNodesState, useEdgesState, addEdge, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';
import GroupDetailCard from './GroupDetailCard';
import { getItemIcon, handleItemChangeNode, categoryTypeMap } from './IconManager';
import DiagramCanvas from './DiagramCanvas';
import MainToolbar from './MainToolbar';
import AddItemButton from './AddItemButton';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';

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
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Airtable API error: ${res.status} ${res.statusText} - ${errorText}`);
        }
        const data = await res.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset;
    } while (offset);

    return allRecords.map((rec) => ({ id: rec.id, ...rec.fields }));
};

export default function ProcessDiagram() {
    const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [aiDescription, setAiDescription] = useState('');
    const [chatMessages, setChatMessages] = useState([]);

    const updateNode = (id, newData) => {
        setNodes((nds) => nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node)));
    };

    const deleteNode = (id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const onSelectionChange = useCallback(
        ({ nodes: selNodes }) => {
            setSelectedNodes(selNodes);
            if (selNodes.length === 1) {
                const nodeData = items.find((item) => item.id === selNodes[0].id);
                setSelectedItem(nodeData || null);
            } else {
                setSelectedItem(null);
            }
        },
        [items]
    );

    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                {
                    ...params,
                    type: 'step',
                    animated: true,
                    style: { stroke: 'blue', strokeWidth: 2 },
                },
                edges
            );
            setEdges(updatedEdges);
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updatedEdges }));
        },
        [edges, nodes]
    );

    // --- NEW: when a group node is moved, shift its children by the same delta (live while dragging) ---
    const onNodeDrag = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;

        setNodes((nds) =>
            nds.map((n) => {
                if (!n?.data) return n;

                // group membership check
                const isChild =
                    (Array.isArray(draggedNode.data?.children) && draggedNode.data.children.includes(n.id)) ||
                    n.data.groupId === draggedNode.id ||
                    n.data.parentId === draggedNode.id;

                if (!isChild) return n;

                // shift children by the same delta as the group’s drag
                const deltaX = draggedNode.position.x - (draggedNode.data.prevX ?? draggedNode.position.x);
                const deltaY = draggedNode.position.y - (draggedNode.data.prevY ?? draggedNode.position.y);

                return {
                    ...n,
                    position: {
                        x: n.position.x + deltaX,
                        y: n.position.y + deltaY,
                    },
                };
            })
        );

        // update prev position for next drag tick
        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: draggedNode.position.x, prevY: draggedNode.position.y } }
                    : n
            )
        );
    }, []);

    // --- Reset prevX/prevY once drag stops ---
    const onNodeDragStop = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;
        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: undefined, prevY: undefined } }
                    : n
            )
        );
    }, []);

    // Replace your existing handleGeneratePNID with this.
    const handleGeneratePNID = async () => {
        if (!aiDescription) return;

        try {
            // 1) call the generator (same signature)
            const result = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            // Defensive: unpack everything that generator returned
            const aiNodes = result?.nodes ?? [];
            const aiEdges = result?.edges ?? [];
            const normalizedItems = result?.normalizedItems ?? [];
            const aiMessages = result?.messages ?? [];

            // 2) log raw AI result for inspection
            console.group('%cAI PNID Result', 'color: #0b5cff; font-weight: bold');
            console.log('aiNodes:', aiNodes);
            console.log('aiEdges:', aiEdges);
            console.log('normalizedItems:', normalizedItems);
            console.log('aiMessages:', aiMessages);
            console.groupEnd();

            // 3) Build code -> nodeId map from existing nodes (current React Flow state)
            const codeToNodeId = new Map();
            nodes.forEach((n) => {
                const code = (n?.data?.item?.Code ?? n?.data?.item?.['Item Code'] ?? '').toString().trim();
                if (code) codeToNodeId.set(code, n.id);
            });

            // 4) Determine which aiNodes are truly new (by Code). If incoming node has same Code as existing, keep existing nodeId.
            const nodesToAdd = [];
            aiNodes.forEach((n) => {
                const code = (n?.data?.item?.Code ?? n?.data?.item?.['Item Code'] ?? '').toString().trim();
                if (!code) {
                    // no code -> always add (or decide otherwise)
                    nodesToAdd.push(n);
                } else if (codeToNodeId.has(code)) {
                    // incoming corresponds to existing code: do NOT add a duplicate node.
                    // Optionally you may update the existing node's data/position here.
                    console.debug(`AI node with code ${code} already exists as nodeId=${codeToNodeId.get(code)} — skipping add.`);
                } else {
                    // brand new code -> add the node and register its nodeId
                    nodesToAdd.push(n);
                    codeToNodeId.set(code, n.id);
                }
            });

            // 5) Merge nodes: keep existing nodes, append nodesToAdd
            const mergedNodes = [...nodes, ...nodesToAdd];

            // 6) Prepare a set of node ids for quick existence checks
            const nodeIdSet = new Set(mergedNodes.map((n) => n.id));

            // 7) Validate/resolve aiEdges -> finalEdges (ensure source/target are node ids)
            const finalEdges = [];
            const unresolvedEdges = [];

            // Toggle this to true only for temporary debugging: will try stripping trailing 2-digit groups from numeric codes (disabled by default)
            const ALLOW_STRIP_INSTANCE_SUFFIX = false;

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

            aiEdges.forEach((e) => {
                let src = e.source;
                let tgt = e.target;

                // if they are already node ids, accept
                const srcIsNode = nodeIdSet.has(src);
                const tgtIsNode = nodeIdSet.has(tgt);

                let resolvedSrc = srcIsNode ? src : null;
                let resolvedTgt = tgtIsNode ? tgt : null;

                // If source/target look like Codes (not node ids), try mapping via codeToNodeId
                if (!resolvedSrc) {
                    const maybeCode = String(src ?? '').trim();
                    if (codeToNodeId.has(maybeCode)) resolvedSrc = codeToNodeId.get(maybeCode);
                    else if (ALLOW_STRIP_INSTANCE_SUFFIX && /^\d+$/.test(maybeCode)) {
                        // optional attempt: strip trailing groups
                        const cands = stripTrailingTwoDigitsCandidates(maybeCode);
                        for (const c of cands) {
                            if (codeToNodeId.has(c)) {
                                resolvedSrc = codeToNodeId.get(c);
                                console.debug(`Resolved src ${maybeCode} -> base ${c}`);
                                break;
                            }
                        }
                    }
                }

                if (!resolvedTgt) {
                    const maybeCode = String(tgt ?? '').trim();
                    if (codeToNodeId.has(maybeCode)) resolvedTgt = codeToNodeId.get(maybeCode);
                    else if (ALLOW_STRIP_INSTANCE_SUFFIX && /^\d+$/.test(maybeCode)) {
                        const cands = stripTrailingTwoDigitsCandidates(maybeCode);
                        for (const c of cands) {
                            if (codeToNodeId.has(c)) {
                                resolvedTgt = codeToNodeId.get(c);
                                console.debug(`Resolved tgt ${maybeCode} -> base ${c}`);
                                break;
                            }
                        }
                    }
                }

                if (resolvedSrc && resolvedTgt) {
                    // create normalized edge (keep original style/animated if present)
                    finalEdges.push({
                        id: e.id ?? `edge-${resolvedSrc}-${resolvedTgt}`,
                        source: resolvedSrc,
                        target: resolvedTgt,
                        type: e.type ?? 'smoothstep',
                        animated: e.animated ?? true,
                        style: e.style ?? { stroke: '#888', strokeWidth: 2 },
                    });
                } else {
                    unresolvedEdges.push({ original: e, resolvedSrc, resolvedTgt });
                }
            });

            // 8) Debug output: show unresolved edges (if any)
            if (unresolvedEdges.length > 0) {
                console.group('%cUnresolved edges (could not map source/target to node ids)', 'color: #d44; font-weight: bold');
                unresolvedEdges.forEach((ue, idx) => {
                    console.warn(`#${idx}`, ue);
                });
                console.groupEnd();

                // push user-visible chat messages for each unresolved connection
                if (typeof setChatMessages === 'function') {
                    const unresolvedMsgs = unresolvedEdges.map((ue) => {
                        const s = ue.original?.source ?? '?';
                        const t = ue.original?.target ?? '?';
                        return { sender: 'AI', message: `⚠️ Could not resolve connection: ${s} → ${t}` };
                    });
                    setChatMessages((prev) => [...prev, ...unresolvedMsgs]);
                }
            }

            // 9) If there are no finalEdges but existingEdges exist, you may want to merge them - but here we'll prefer AI edges when present
            //    Merge unique edges (avoid duplicates)
            const mergedEdgeKey = (edge) => `${edge.source}>>${edge.target}`;
            const existingEdgeMap = new Map();
            edges.forEach((ed) => existingEdgeMap.set(mergedEdgeKey(ed), ed));

            finalEdges.forEach((ed) => existingEdgeMap.set(mergedEdgeKey(ed), ed));

            const mergedEdges = [...existingEdgeMap.values()];

            // 10) Update items list (dedupe by Code)
            setItems((prevItems) => {
                const map = new Map();
                // existing items keyed by Code (fallback to id if no code)
                prevItems.forEach((it) => {
                    const code = String(it.Code ?? it['Item Code'] ?? it.id ?? '').trim() || `no_code:${it.id ?? Math.random()}`;
                    map.set(code, it);
                });

                // incoming items from aiNodes
                const incoming = aiNodes.map((n) => n.data?.item).filter(Boolean);
                incoming.forEach((it) => {
                    const code = String(it.Code ?? it['Item Code'] ?? '').trim() || `no_code:${it.id ?? Math.random()}`;
                    if (!map.has(code)) {
                        map.set(code, it);
                    } else {
                        // merge: preserve existing but update missing fields from incoming
                        const existing = map.get(code);
                        map.set(code, { ...existing, ...it });
                    }
                });

                const merged = [...map.values()];
                // select first incoming item if any were added
                if (incoming.length > 0 && typeof setSelectedItem === 'function') {
                    setSelectedItem(incoming[0]);
                }
                return merged;
            });

            // 11) Set nodes and edges into state
            setNodes(mergedNodes);
            setEdges(mergedEdges);

            // 12) Final debug prints for verification
            console.group('%cPost-merge verification', 'color: #0a8; font-weight: bold');
            console.table(mergedNodes.map((n) => ({ id: n.id, code: n.data?.item?.Code, name: n.data?.item?.Name })));
            console.table(mergedEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
            console.groupEnd();
        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };


    useEffect(() => {
        fetchData()
            .then((itemsRaw) => {
                const normalizedItems = itemsRaw.map((item) => ({
                    ...item,
                    Unit: item.Unit || 'Default Unit',
                    SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
                    Category: Array.isArray(item['Category Item Type']) ? item['Category Item Type'][0] : item['Category Item Type'] || '',
                    Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
                    Code: item['Item Code'] || item.Code || '',
                    Name: item.Name || '',
                    Sequence: item.Sequence || 0,
                }));

                setItems(normalizedItems);

                const grouped = {};
                normalizedItems.forEach((item) => {
                    const { Unit, SubUnit, Category, Sequence, Name, Code, id } = item;
                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                    grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id });
                });

                const newNodes = [];
                const newEdges = [];
                let unitX = 0;
                const unitWidth = 5000;
                const unitHeight = 3000;
                const subUnitHeight = unitHeight / 9;
                const itemWidth = 160;
                const itemGap = 30;

                Object.entries(grouped).forEach(([unit, subUnits]) => {
                    newNodes.push({
                        id: `unit-${unit}`,
                        position: { x: unitX, y: 0 },
                        data: { label: unit },
                        style: { width: unitWidth, height: unitHeight, border: '4px solid #444', background: 'transparent', boxShadow: 'none' },
                        draggable: false,
                        selectable: false,
                    });

                    Object.entries(subUnits).forEach(([subUnit, itemsArr], index) => {
                        const yOffset = index * subUnitHeight;

                        newNodes.push({
                            id: `sub-${unit}-${subUnit}`,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: { label: subUnit },
                            style: { width: unitWidth - 20, height: subUnitHeight - 20, border: '2px dashed #aaa', background: 'transparent', boxShadow: 'none' },
                            draggable: false,
                            selectable: false,
                        });

                        let itemX = unitX + 40;
                        itemsArr.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        itemsArr.forEach((item) => {
                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: yOffset + 20 },
                                data: { label: `${item.Code || ''} - ${item.Name || ''}`, item, icon: getItemIcon(item) },
                                type: categoryTypeMap[item.Category] || 'scalableIcon',
                                sourcePosition: 'right',
                                targetPosition: 'left',
                                style: { background: 'transparent', boxShadow: 'none' },
                            });
                            itemX += itemWidth + itemGap;
                        });
                    });

                    unitX += unitWidth + 100;
                });

                setNodes(newNodes);
                setEdges(newEdges);
                setDefaultLayout({ nodes: newNodes, edges: newEdges });
            })
            .catch(console.error);
    }, []);

    // --- Group detail wiring ---
    const [addingToGroup, setAddingToGroup] = useState(null);

    const itemsMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);

    const selectedGroupNode = selectedNodes && selectedNodes.length === 1 && selectedNodes[0]?.type === 'groupLabel' ? selectedNodes[0] : null;

    const childrenNodesForGroup = selectedGroupNode ? nodes.filter(n => {
        if (!n) return false;
        if (Array.isArray(selectedGroupNode.data?.children) && selectedGroupNode.data.children.includes(n.id)) return true;
        if (n.data?.groupId === selectedGroupNode.id) return true;
        if (n.data?.parentId === selectedGroupNode.id) return true;
        return false;
    }) : [];

    const startAddItemToGroup = (groupId) => { setAddingToGroup(groupId); };

    const onAddItem = (nodeIdToAdd) => {
        if (!nodeIdToAdd) return;
        setNodes(nds => {
            const existing = nds.find(n => n.id === nodeIdToAdd);
            if (existing) {
                return nds.map(n => n.id === nodeIdToAdd ? { ...n, data: { ...n.data, groupId: selectedGroupNode?.id } } : n);
            }
            const newNode = {
                id: nodeIdToAdd,
                position: { x: 100, y: 100 },
                data: { label: nodeIdToAdd, groupId: selectedGroupNode?.id }
            };
            return [...nds, newNode];
        });
    };

    const onRemoveItem = (childId) => {
        setNodes(nds => nds.map(n => n.id === childId ? { ...n, data: { ...n.data, groupId: undefined } } : n));
    };

    const onDeleteGroup = (groupId) => {
        setNodes(nds => nds.filter(n => n.id !== groupId));
    };

    // --- ✅ FIX: Add Item wiring (normalize fields + auto-select) ---
    const handleAddItem = (rawItem) => {
        const normalizedItem = {
            id: rawItem.id || `item-${Date.now()}`,
            Name: rawItem.Name || '',
            Code: rawItem.Code ?? rawItem['Item Code'] ?? '',
            'Item Code': rawItem['Item Code'] ?? rawItem.Code ?? '',
            Unit: rawItem.Unit || '',
            SubUnit: rawItem.SubUnit ?? rawItem['Sub Unit'] ?? '',
            Category: Array.isArray(rawItem['Category Item Type']) ? rawItem['Category Item Type'][0] : (rawItem['Category Item Type'] ?? rawItem.Category ?? ''),
            'Category Item Type': Array.isArray(rawItem['Category Item Type']) ? rawItem['Category Item Type'][0] : (rawItem['Category Item Type'] ?? rawItem.Category ?? ''),
            Type: Array.isArray(rawItem.Type) ? rawItem.Type[0] : (rawItem.Type || ''),
            Sequence: rawItem.Sequence ?? 0,
        };

        const newNode = {
            id: normalizedItem.id,
            position: { x: 100, y: 100 },
            data: { label: `${normalizedItem.Code || ''} - ${normalizedItem.Name || ''}`, item: normalizedItem, icon: getItemIcon(normalizedItem) },
            type: categoryTypeMap[normalizedItem.Category] || 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent', boxShadow: 'none' },
        };

        setNodes(nds => [...nds, newNode]);
        setItems(prev => [...prev, normalizedItem]);

        // Auto-select new node so ItemDetailCard opens
        setSelectedNodes([newNode]);
        setSelectedItem(normalizedItem);
    };


    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
            {/* Left: main diagram */}
            <div style={{ flex: 1, position: "relative", background: "transparent" }}>
                <DiagramCanvas
                    nodes={nodes}
                    edges={edges}
                    setNodes={setNodes}
                    setEdges={setEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypes}
                    AddItemButton={(props) => (
                        <AddItemButton {...props} addItem={handleAddItem} />
                    )}
                    selectedNodes={selectedNodes}
                    updateNode={updateNode}
                    deleteNode={deleteNode}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                />
            </div>

            {/* Right sidebar */}
            <div
                style={{
                    width: 350,
                    borderLeft: "1px solid #ccc",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Details panel */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {selectedGroupNode ? (
                        <GroupDetailCard
                            node={selectedGroupNode}
                            childrenNodes={childrenNodesForGroup}
                            childrenLabels={selectedGroupNode?.data?.children}
                            allItems={itemsMap}
                            startAddItemToGroup={startAddItemToGroup}
                            onAddItem={onAddItem}
                            onRemoveItem={onRemoveItem}
                            onDelete={onDeleteGroup}
                        />
                    ) : selectedItem ? (
                        <ItemDetailCard
                            item={selectedItem}
                            onChange={(updatedItem) =>
                                handleItemChangeNode(
                                    updatedItem,
                                    setItems,
                                    setNodes,
                                    setSelectedItem
                                )
                            }
                        />
                    ) : (
                        <div style={{ padding: 20, color: "#888" }}>
                            Select an item or group to see details
                        </div>
                    )}
                </div>
            </div>
        </div> 
);
}
