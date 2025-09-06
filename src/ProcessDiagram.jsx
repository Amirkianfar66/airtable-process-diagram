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
import { getItemIcon, handleItemChangeNode } from './IconManager';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import DiagramCanvas from './DiagramCanvas';
import MainToolbar from './MainToolbar';
import AddItemButton from './AddItemButton';

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

    // selection handling
    const onSelectionChange = useCallback(
        ({ nodes: selNodes, edges: selEdges }) => {
            setSelectedNodes(selNodes || []);

            // Single node
            if (Array.isArray(selNodes) && selNodes.length === 1) {
                const selNode = selNodes[0];
                const itemFromItems = items.find((it) => it.id === selNode.id);
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

            // Single edge → try inline valve on that edge
            if (Array.isArray(selEdges) && selEdges.length === 1) {
                const edge = selEdges[0];
                const edgeValves = items.filter((it) => it.edgeId === edge.id);
                if (edgeValves.length > 0) {
                    setSelectedItem(edgeValves[0]);
                    return;
                }
                const valveNode = nodes.find((n) => n?.data?.item?.edgeId === edge.id);
                if (valveNode?.data?.item) {
                    setSelectedItem(valveNode.data.item);
                    return;
                }
                setSelectedItem(null);
                return;
            }

            setSelectedItem(null);
        },
        [items, nodes]
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

    // group drag helpers
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

        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: draggedNode.position.x, prevY: draggedNode.position.y } }
                    : n
            )
        );
    }, []);

    const onNodeDragStop = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;
        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id ? { ...n, data: { ...n.data, prevX: undefined, prevY: undefined } } : n
            )
        );
    }, []);

    // edge inspection helpers
    const handleEdgeSelect = useCallback(
        (edge) => {
            if (!edge) {
                setSelectedItem(null);
                return;
            }
            const fromItem = items.find((it) => it.id === edge.source) || null;
            const toItem = items.find((it) => it.id === edge.target) || null;

            const edgeAsItem = {
                id: edge.id,
                Name: 'Edge inspector',
                'Item Code': edge.id,
                edgeId: edge.id,
                from: fromItem?.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
                to: toItem?.Name ? `${toItem.Name} (${edge.target})` : edge.target,
                x: (fromItem?.x && toItem?.x) ? (fromItem.x + toItem.x) / 2 : undefined,
                y: (fromItem?.y && toItem?.y) ? (fromItem.y + toItem.y) / 2 : undefined,
                _edge: edge,
            };
            setSelectedItem(edgeAsItem);
        },
        [items]
    );

    const handleDeleteEdge = useCallback(
        (edgeId) => {
            if (!edgeId) return;
            if (!window.confirm('Delete this edge?')) return;

            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
            setNodes((nds) => nds.filter((n) => !(n?.data?.item?.edgeId && n.data.item.edgeId === edgeId)));
            setSelectedItem((cur) => (cur?.edgeId === edgeId ? null : cur));
        },
        []
    );

    const handleUpdateEdge = useCallback(
        (edgeId, patch) => {
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)));
            setSelectedItem((cur) => {
                if (!cur || cur.edgeId !== edgeId) return cur;
                return { ...cur, _edge: { ...cur._edge, ...patch } };
            });
        },
        []
    );

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
        [edges, nodes]
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

            setNodes(aiNodes);
            setEdges(aiEdges);

            if (aiNodes?.length) {
                const newNodesList = aiNodes.filter((n) => !nodes.some((old) => old.id === n.id));
                if (newNodesList.length > 0) {
                    setSelectedNodes([newNodesList[0]]);
                    setSelectedItem(newNodesList[0].data?.item || null);
                }
            }
        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };

    // --- helpers (no diagramBuilder) ---
    const makeNodeFromItem = (item, index = 0) => {
        // use provided x,y if present; else place on a simple grid
        const gap = 200;
        const x = typeof item.x === 'number' ? item.x : 100 + (index % 5) * gap;
        const y = typeof item.y === 'number' ? item.y : 100 + Math.floor(index / 5) * gap;

        return {
            id: item.id,
            position: { x, y },
            data: {
                label: `${item.Code || ''} - ${item.Name || ''}`,
                item,
                icon: getItemIcon(item),
            },
            type: 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent', boxShadow: 'none' },
        };
    };

    const rebuildNodesFromItems = (list) => {
        const nextNodes = list.map((it, i) => makeNodeFromItem(it, i));
        setNodes(nextNodes);
    };

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
                        : item['Category Item Type'] || 'Equipment',
                    Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
                    Sequence: item.Sequence || 0,
                    Connections: Array.isArray(item.Connections) ? item.Connections : [],
                    x: typeof item.x === 'number' ? item.x : undefined,
                    y: typeof item.y === 'number' ? item.y : undefined,
                }));

                setItems(normalizedItems);
                rebuildNodesFromItems(normalizedItems);
                setEdges([]); // no auto-edges without builder; keep empty unless user connects
            } catch (err) {
                console.error('Error loading items:', err);
            }
        };

        loadItems();
    }, []);

    // Group detail helpers (kept)
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
    const startAddItemToGroup = (groupId) => {
        setAddingToGroup(groupId);
    };

    const onAddItem = (nodeIdToAdd) => {
        if (!nodeIdToAdd) return;
        setNodes((nds) => {
            const existing = nds.find((n) => n.id === nodeIdToAdd);
            if (existing) {
                return nds.map((n) => (n.id === nodeIdToAdd ? { ...n, data: { ...n.data, groupId: selectedGroupNode?.id } } : n));
            }
            const newNode = {
                id: nodeIdToAdd,
                position: { x: 100, y: 100 },
                data: { label: nodeIdToAdd, groupId: selectedGroupNode?.id },
            };
            return [...nds, newNode];
        });
    };

    const onRemoveItem = (childId) => {
        setNodes((nds) => nds.map((n) => (n.id === childId ? { ...n, data: { ...n.data, groupId: undefined } } : n)));
    };

    const onDeleteGroup = (groupId) => {
        setNodes((nds) => nds.filter((n) => n.id !== groupId));
    };

    // Add Item (no diagramBuilder): append to items and place on grid
    const handleAddItem = (rawItem) => {
        setItems((prevItems) => {
            const normalizedItem = {
                id: rawItem.id || `item-${Date.now()}`,
                Name: rawItem.Name || 'New Item',
                Code: rawItem.Code ?? rawItem['Item Code'] ?? `CODE-${Date.now()}`,
                'Item Code': rawItem['Item Code'] ?? rawItem.Code ?? '',
                Unit: rawItem.Unit || 'Unit 1',
                SubUnit: rawItem.SubUnit ?? rawItem['Sub Unit'] ?? 'Default SubUnit',
                Category: Array.isArray(rawItem['Category Item Type'])
                    ? rawItem['Category Item Type'][0]
                    : rawItem['Category Item Type'] ?? rawItem.Category ?? 'Equipment',
                'Category Item Type': Array.isArray(rawItem['Category Item Type'])
                    ? rawItem['Category Item Type'][0]
                    : rawItem['Category Item Type'] ?? rawItem.Category ?? 'Equipment',
                Type: Array.isArray(rawItem.Type) ? rawItem.Type[0] : rawItem.Type || '',
                Sequence: rawItem.Sequence ?? 0,
                Connections: Array.isArray(rawItem.Connections) ? rawItem.Connections : [],
                x: typeof rawItem.x === 'number' ? rawItem.x : undefined,
                y: typeof rawItem.y === 'number' ? rawItem.y : undefined,
            };

            const nextItems = [...prevItems, normalizedItem];

            // create a node for it (simple placement)
            const node = makeNodeFromItem(normalizedItem, nextItems.length - 1);
            setNodes((nds) => [...nds, node]);

            setSelectedNodes([node]);
            setSelectedItem(normalizedItem);

            console.log('handleAddItem added:', normalizedItem);
            return nextItems;
        });
    };

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            {/* LEFT: Diagram */}
            <div style={{ flex: 3, position: 'relative', background: 'transparent' }}>
                <DiagramCanvas
                    nodes={nodes}
                    edges={edges}
                    setNodes={setNodes}
                    setEdges={setEdges}
                    setItems={setItems}
                    setSelectedItem={setSelectedItem}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypes}
                    onEdgeSelect={handleEdgeSelect}
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
                />
            </div>

            {/* RIGHT: Sidebar */}
            <div
                style={{
                    flex: 1,
                    borderLeft: '1px solid #ccc',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'transparent',
                }}
            >
                {/* detail panel */}
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
                            onChange={(updatedItem) => handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)}
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
    );
}
