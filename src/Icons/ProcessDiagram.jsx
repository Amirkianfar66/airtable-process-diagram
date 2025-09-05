// src/components/ProcessDiagram.jsx
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
import { getItemIcon } from './IconManager';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import DiagramCanvas from './DiagramCanvas';
import AddItemButton from './AddItemButton';
import { buildDiagram } from './diagramBuilder';
import UnitLayoutConfig from './UnitLayoutConfig';
import AirtableGrid from './Airtable/AirtableGrid';

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

// convert UI fields to Airtable-safe fields (Type must be an array of IDs)
// Toggle persistence (off for now)
const PERSIST_TO_AIRTABLE = false;


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
    const positionsRef = useRef(new Map()); // id -> {x,y}

    const capturePositions = (nodesArray) => {
        const m = positionsRef.current;
        nodesArray.forEach((n) => {
            if (n?.id && n?.position) m.set(String(n.id), { x: n.position.x, y: n.position.y });
        });
    };

    const applyPositions = (nodesArray) => {
        const m = positionsRef.current;
        return nodesArray.map((n) => {
            const cached = m.get(String(n.id));
            if (cached) return { ...n, position: { x: cached.x, y: cached.y } };
            const altId = n?.data?.item?.id;
            if (altId) {
                const cached2 = m.get(String(altId));
                if (cached2) return { ...n, position: { x: cached2.x, y: cached2.y } };
            }
            return n;
        });
    };

    const updateNode = (id, newData) => {
        setNodes((nds) =>
            nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node))
        );
    };

    const deleteNode = (id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    // helper for builder (previous nodes reference)
    const getPrevNodesForBuilder = useCallback(() => nodes, [nodes]);

    // ---------- ITEM CHANGES: never touch node.position ----------
   // Local-only: update items + node.data, never call network
    // Local-only: update items + node.data, never call network
    const handleItemDetailChange = useCallback((updatedItem) => {
        if (!updatedItem || !updatedItem.id) return;
        const idStr = String(updatedItem.id);

        // 1) Update items[] locally
        setItems(prev =>
            prev.map(it => (String(it.id) === idStr ? { ...it, ...updatedItem } : it))
        );

        // 2) Update the node's data only (never touch position)
        setNodes(prevNodes =>
            prevNodes.map(node =>
                String(node.id) === idStr
                    ? { ...node, data: { ...node.data, ...updatedItem } }
                    : node
            )
        );

        // 3) Keep the right panel in sync
        setSelectedItem(cur =>
            cur && String(cur.id) === idStr ? { ...cur, ...updatedItem } : cur
        );

        // 4) Explicitly do nothing else (no PATCH, no alerts)
        // console.debug('[Airtable disabled] Local update only for', idStr);
    }, [setItems, setNodes, setSelectedItem]);


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

    // ---------- DRAG: write position to state cache + items (for rebuild resilience) ----------
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

                const deltaX = draggedNode.position.x - (draggedNode.data?.prevX ?? draggedNode.position.x);
                const deltaY = draggedNode.position.y - (draggedNode.data?.prevY ?? draggedNode.position.y);

                return {
                    ...n,
                    position: {
                        x: n.position.x + deltaX,
                        y: n.position.y + deltaY,
                    },
                };
            })
        );

        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: draggedNode.position.x, prevY: draggedNode.position.y } }
                    : n
            )
        );
    }, []);

    const onNodeDragStop = useCallback(
        (event, draggedNode) => {
            if (!draggedNode) return;

            // 1) keep node position in ReactFlow state + cache
            setNodes((nds) => {
                const next = nds.map((n) => (n.id === draggedNode.id ? { ...n, position: { ...draggedNode.position } } : n));
                capturePositions(next);
                return next;
            });

            // 2) persist position into items[] so diagramBuilder can reuse it on rebuilds
            setItems((prev) =>
                Array.isArray(prev)
                    ? prev.map((it) =>
                        String(it.id) === String(draggedNode.id) ? { ...it, x: draggedNode.position.x, y: draggedNode.position.y } : it
                    )
                    : prev
            );

            // 3) reset prevX/prevY only for groupLabel nodes
            if (draggedNode.type !== 'groupLabel') return;
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === draggedNode.id ? { ...n, data: { ...n.data, prevX: undefined, prevY: undefined } } : n
                )
            );
        },
        [setNodes, setItems]
    );

    const handleEdgeSelect = useCallback(
        (edge) => {
            if (!edge) {
                setSelectedItem(null);
                return;
            }

            const fromItem = items.find((it) => String(it.id) === String(edge.source)) || null;
            const toItem = items.find((it) => String(it.id) === String(edge.target)) || null;

            const edgeAsItem = {
                id: edge.id,
                Name: 'Edge inspector',
                'Item Code': edge.id,
                edgeId: edge.id,
                from: fromItem?.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
                to: toItem?.Name ? `${toItem.Name} (${edge.target})` : edge.target,
                x: fromItem?.x && toItem?.x ? (fromItem.x + toItem.x) / 2 : undefined,
                y: fromItem?.y && toItem?.y ? (fromItem.y + toItem.y) / 2 : undefined,
                _edge: edge,
            };

            setSelectedItem(edgeAsItem);
        },
        [items, setSelectedItem]
    );

    const handleDeleteEdge = useCallback(
        (edgeId) => {
            if (!edgeId) return;
            if (!window.confirm('Delete this edge?')) return;

            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
            setNodes((nds) => nds.filter((n) => !(n?.data?.item?.edgeId && n.data.item.edgeId === edgeId)));
            setSelectedItem((cur) => (cur?.edgeId === edgeId ? null : cur));
        },
        [setEdges, setNodes, setSelectedItem]
    );

    const handleUpdateEdge = useCallback(
        (edgeId, patch) => {
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)));
            setSelectedItem((cur) => {
                if (!cur || cur.edgeId !== edgeId) return cur;
                return { ...cur, _edge: { ...cur._edge, ...patch } };
            });
        },
        [setEdges, setSelectedItem]
    );

    const handleDeleteItem = useCallback((id) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setItems((its) => its.filter((it) => it.id !== id));
        setSelectedItem(null);
    }, []);

    const handleCreateInlineValve = useCallback(
        (edgeId) => {
            const edge = edges.find((e) => e.id === edgeId);
            if (!edge) return;

            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return;

            const midX = (sourceNode.position.x + targetNode.position.x) / 2;
            const midY = (sourceNode.position.y + targetNode.position.y) / 2;

            const newValveId = `valve-${Date.now()}`;

            const newItem = {
                id: newValveId,
                'Item Code': `VALVE-${Date.now()}`,
                Name: 'Inline Valve',
                Category: 'Inline Valve',
                'Category Item Type': 'Inline Valve',
                Type: [],
                Unit: sourceNode?.data?.item?.Unit || '',
                SubUnit: sourceNode?.data?.item?.SubUnit || '',
                x: midX,
                y: midY,
                edgeId: edge.id,
            };

            const newNode = {
                id: newItem.id,
                position: { x: midX, y: midY },
                data: {
                    label: `${newItem['Item Code']} - ${newItem.Name}`,
                    item: newItem,
                    icon: getItemIcon ? getItemIcon(newItem) : undefined,
                },
                type: 'scalableIcon',
                sourcePosition: 'right',
                targetPosition: 'left',
                style: { background: 'transparent' },
            };

            setNodes((nds) => [...nds, newNode]);

            const baseStyle = edge.style || {};
            setEdges((eds) => {
                const filtered = eds.filter((e) => e.id !== edge.id);
                const e1 = {
                    id: `edge-${edge.source}-${newNode.id}-${Date.now()}`,
                    source: edge.source,
                    target: newNode.id,
                    type: edge.type || 'smoothstep',
                    animated: edge.animated ?? true,
                    style: { ...baseStyle },
                };
                const e2 = {
                    id: `edge-${newNode.id}-${edge.target}-${Date.now()}`,
                    source: newNode.id,
                    target: edge.target,
                    type: edge.type || 'smoothstep',
                    animated: edge.animated ?? true,
                    style: { ...baseStyle },
                };
                return [...filtered, e1, e2];
            });

            setItems((prev) => [...prev, newItem]);
            setSelectedItem(newItem);
        },
        [edges, nodes, setNodes, setEdges, setItems, setSelectedItem]
    );

    const handleGeneratePNID = async () => {
        if (!aiDescription) return;

        try {
            const { nodes: aiNodes, edges: aiEdges, normalizedItems } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            const aiItems = normalizedItems || (aiNodes || []).map((n) => n.data?.item).filter(Boolean);

            const updatedItems = [...items];
            const existingIds = new Set(updatedItems.map((i) => i.id));
            aiItems.forEach((item) => {
                if (item.id && !existingIds.has(item.id)) {
                    updatedItems.push(item);
                }
            });
            setItems(updatedItems);

            // keep existing node objects/positions
            setNodes((prevNodes) => {
                const prevById = new Map(prevNodes.map((n) => [String(n.id), n]));
                const next = (aiNodes || []).map((fresh) => {
                    const prev = prevById.get(String(fresh.id));
                    if (!prev) return fresh;
                    return {
                        ...prev,
                        type: fresh.type ?? prev.type,
                        style: { ...(prev.style || {}), ...(fresh.style || {}) },
                        data: { ...(prev.data || {}), ...(fresh.data || {}) },
                    };
                });
                prevNodes.forEach((p) => {
                    if (!next.some((m) => String(m.id) === String(p.id))) next.push(p);
                });
                const rePos = applyPositions(next);
                capturePositions(rePos);
                return rePos;
            });

            setEdges(aiEdges);
        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };

    // ---------- INITIAL LOAD ----------
    useEffect(() => {
        const loadItems = async () => {
            try {
                const itemsRaw = await fetchData();

                const normalizedItems = itemsRaw.map((item) => ({
                    id: item.id || `${item.Name}-${Date.now()}`,
                    Name: item.Name || '',
                    Code: item['Item Code'] || item.Code || '',
                    Unit: item.Unit || 'Default Unit',
                    SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
                    Category: Array.isArray(item['Category Item Type'])
                        ? item['Category Item Type'][0]
                        : item['Category Item Type'] || '',
                    // keep only first Type ID for UI; we save it back as array
                    Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
                    Sequence: item.Sequence || 0,
                    Connections: Array.isArray(item.Connections) ? item.Connections : [],
                    x: typeof item.x === 'number' ? item.x : undefined,
                    y: typeof item.y === 'number' ? item.y : undefined,
                }));

                const uniqueUnits = [...new Set(normalizedItems.map((i) => i.Unit))];
                const unitLayout2D = [uniqueUnits];
                setUnitLayoutOrder(unitLayout2D);

                const { nodes: builtNodes, edges: builtEdges } =
                    buildDiagram(normalizedItems, unitLayout2D, { prevNodes: getPrevNodesForBuilder() });

                setNodes((prevNodes) => {
                    const next = (builtNodes || []).map((fresh) => {
                        const prev = prevNodes.find((p) => String(p.id) === String(fresh.id));
                        return prev
                            ? {
                                ...prev,
                                type: fresh.type ?? prev.type,
                                style: { ...(prev.style || {}), ...(fresh.style || {}) },
                                data: { ...(prev.data || {}), ...(fresh.data || {}) },
                            }
                            : fresh;
                    });

                    const rePos = applyPositions(next);
                    capturePositions(rePos);
                    return rePos;
                });

                setEdges(builtEdges);
                setItems(normalizedItems);

                const uniqueUnitsObjects = uniqueUnits.map((u) => ({ id: u, Name: u }));
                setAvailableUnitsForConfig(uniqueUnitsObjects);

                prevItemsRef.current = normalizedItems;
            } catch (err) {
                console.error('Error loading items:', err);
            }
        };

        loadItems();
    }, [getPrevNodesForBuilder]);

    // ---------- REBUILD / INCREMENTAL UPDATE ----------
    useEffect(() => {
        if (!items.length || !unitLayoutOrder.length) return;

        const prevItems = prevItemsRef.current || [];
        const prevMap = Object.fromEntries(prevItems.map((i) => [String(i.id), i]));

        const needFullRebuild =
            items.length !== prevItems.length ||
            items.some((i) => {
                const p = prevMap[String(i.id)];
                if (!p) return true;
                return p.Unit !== i.Unit || p.SubUnit !== i.SubUnit;
            });

        if (needFullRebuild) {
            const { nodes: rebuiltNodes, edges: rebuiltEdges } =
                buildDiagram(items, unitLayoutOrder, { prevNodes: getPrevNodesForBuilder() });

            setNodes((prevNodes) => {
                const next = (rebuiltNodes || []).map((fresh) => {
                    const prev = prevNodes.find((p) => String(p.id) === String(fresh.id));
                    if (!prev) return fresh;
                    return {
                        ...prev,
                        type: fresh.type ?? prev.type,
                        style: { ...(prev.style || {}), ...(fresh.style || {}) },
                        data: { ...(prev.data || {}), ...(fresh.data || {}) },
                    };
                });

                const missingPrev = prevNodes.filter((p) => !next.some((m) => String(m.id) === String(p.id)));
                const merged = [...next, ...missingPrev];

                const rePos = applyPositions(merged);
                capturePositions(rePos);
                return rePos;
            });

            setEdges(rebuiltEdges);
        } else {
            setNodes((prevNodes) => {
                const next = prevNodes.map((n) => {
                    const item = items.find((it) => String(it.id) === String(n.id));
                    if (!item) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            ...item,
                            icon: getItemIcon(item, { width: 40, height: 40 }),
                        },
                    };
                });

                const rePos = applyPositions(next);
                capturePositions(rePos);
                return rePos;
            });
        }

        prevItemsRef.current = items;
    }, [unitLayoutOrder, items, getPrevNodesForBuilder]);

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

    const [addingToGroup, setAddingToGroup] = useState(null);
    const startAddItemToGroup = (groupId) => setAddingToGroup(groupId);

    const onAddItem = (nodeIdToAdd) => {
        if (!nodeIdToAdd) return;
        setNodes((nds) => {
            const existing = nds.find((n) => n.id === nodeIdToAdd);
            if (existing) {
                return nds.map((n) =>
                    n.id === nodeIdToAdd ? { ...n, data: { ...n.data, groupId: selectedGroupNode?.id } } : n
                );
            }
            const newNode = {
                id: nodeIdToAdd,
                position: { x: 100, y: 100 },
                data: { label: nodeIdToAdd, groupId: selectedGroupNode?.id },
            };
            return [...nds, newNode];
        });
    };

    const onRemoveItem = (childId) =>
        setNodes((nds) => nds.map((n) => (n.id === childId ? { ...n, data: { ...n.data, groupId: undefined } } : n)));

    const onDeleteGroup = (groupId) => setNodes((nds) => nds.filter((n) => n.id !== groupId));

    // Selection hook used by DiagramCanvas
    const onSelectionChange = useCallback(
        ({ nodes: selNodes, edges: selEdges }) => {
            setSelectedNodes(selNodes || []);

            if (Array.isArray(selNodes) && selNodes.length === 1) {
                const selNode = selNodes[0];
                const itemFromItems = items.find((it) => String(it.id) === String(selNode.id));
                if (itemFromItems) {
                    setSelectedItem(itemFromItems);
                    return;
                }
                if (selNode?.data?.item) {
                    setSelectedItem(selNode.data.item);
                    return;
                }
                setSelectedItem(null);
                return;
            }

            if (Array.isArray(selEdges) && selEdges.length === 1) {
                const edge = selEdges[0];
                handleEdgeSelect(edge);
                return;
            }

            setSelectedItem(null);
        },
        [items, handleEdgeSelect]
    );

    // Wrap React Flow nodes change to keep cache fresh
    const onNodesChangeWrapped = useCallback(
        (changes) => {
            onNodesChange(changes);
            setNodes((nds) => {
                capturePositions(nds);
                return nds;
            });
        },
        [onNodesChange, setNodes]
    );

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            {/* LEFT: Airtable table */}
            <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #ddd' }}>
                <AirtableGrid />
            </div>

            {/* RIGHT: Diagram + Sidebar */}
            <div style={{ flex: 3, display: 'flex', minWidth: 0 }}>
                {/* Diagram */}
                <div style={{ flex: 3, position: 'relative', background: 'transparent' }}>
                    <DiagramCanvas
                        nodes={nodes}
                        edges={edges}
                        setNodes={setNodes}
                        setEdges={setEdges}
                        setItems={setItems}
                        setSelectedItem={setSelectedItem}
                        onNodesChange={onNodesChangeWrapped}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onSelectionChange={onSelectionChange}
                        nodeTypes={nodeTypes}
                        onEdgeSelect={handleEdgeSelect}
                        showInlineEdgeInspector={false}
                        AddItemButton={AddItemButton}
                        addItem={handleAddItem}
                        selectedItem={selectedItem}
                        onItemChange={(updatedItem) => {
                            // never request reposition from the panel
                            handleItemDetailChange(updatedItem);
                        }}
                        onDeleteItem={handleDeleteItem}
                        onDeleteEdge={handleDeleteEdge}
                        onUpdateEdge={handleUpdateEdge}
                        onCreateInlineValve={handleCreateInlineValve}
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
                    />
                </div>

                {/* Sidebar */}
                <div
                    style={{
                        flex: 1,
                        borderLeft: '1px solid #ccc',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'transparent',
                        minWidth: 280,
                    }}
                >
                    <div>
                        <UnitLayoutConfig availableUnits={availableUnitsForConfig} onChange={setUnitLayoutOrder} />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
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
                                items={items}
                                edges={edges}
                                onChange={handleItemDetailChange}
                                onDeleteItem={handleDeleteItem}
                                onDeleteEdge={handleDeleteEdge}
                                onUpdateEdge={handleUpdateEdge}
                                onCreateInlineValve={handleCreateInlineValve}
                            />
                        ) : (
                            <div style={{ padding: 20, color: '#888' }}>Select an item or group to see details</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
