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
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import DiagramCanvas from './DiagramCanvas';
import MainToolbar from './MainToolbar';
import AddItemButton from './AddItemButton';
import { buildDiagram } from './diagramBuilder';
import UnitLayoutConfig from "./UnitLayoutConfig";

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
    const [unitLayoutOrder, setUnitLayoutOrder] = useState([]);
    const [availableUnitsForConfig, setAvailableUnitsForConfig] = useState([]);

    const updateNode = (id, newData) => {
        setNodes((nds) => nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node)));
    };

    const deleteNode = (id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const onSelectionChange = useCallback(
        ({ nodes: selNodes, edges: selEdges }) => {
            setSelectedNodes(selNodes);

            if (selNodes.length === 1) {
                const nodeData = items.find((item) => item.id === selNodes[0].id);
                setSelectedItem(nodeData || null);
            } else if (selEdges.length === 1) {
                // ✅ find valve(s) attached to this edge
                const edgeValves = items.filter((item) => item.edgeId === selEdges[0].id);
                if (edgeValves.length === 1) {
                    setSelectedItem(edgeValves[0]);
                } else if (edgeValves.length > 1) {
                    // you could later allow multiple selection, but for now pick the first
                    setSelectedItem(edgeValves[0]);
                } else {
                    setSelectedItem(null);
                }
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

            // Extract AI items
            const aiItems = normalizedItems || (aiNodes || []).map(n => n.data?.item).filter(Boolean);
            console.log("AI Items:", aiItems);
            aiItems.forEach(i => console.log(i.Name, i.Code, i.Connections));

            // Merge into items
            const updatedItems = [...items];
            const existingIds = new Set(updatedItems.map(i => i.id));
            aiItems.forEach(item => {
                if (item.id && !existingIds.has(item.id)) {
                    updatedItems.push(item);
                }
            });
            setItems(updatedItems);

            // Merge nodes + edges directly (instead of discarding AI edges)
            setNodes(aiNodes);
            setEdges(aiEdges);

            // Auto-select first new node
            if (aiNodes?.length) {
                const newNodesList = aiNodes.filter(n => !nodes.some(old => old.id === n.id));
                if (newNodesList.length > 0) {
                    setSelectedNodes([newNodesList[0]]);
                    setSelectedItem(newNodesList[0].data?.item || null);
                }
            }
        } catch (err) {
            console.error("AI PNID generation failed:", err);
        }
    };


    useEffect(() => {
        const loadItems = async () => {
            try {
                const itemsRaw = await fetchData();

                // Normalize fields including Connections
                const normalizedItems = itemsRaw.map(item => ({
                    id: item.id || `${item.Name}-${Date.now()}`,
                    Name: item.Name || '',
                    Code: item['Item Code'] || item.Code || '',
                    Unit: item.Unit || 'Default Unit',
                    SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
                    Category: Array.isArray(item['Category Item Type'])
                        ? item['Category Item Type'][0]
                        : item['Category Item Type'] || '',
                    Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
                    Sequence: item.Sequence || 0,
                    Connections: Array.isArray(item.Connections) ? item.Connections : [], // ✅ include connections
                }));

                // Build unique units array
                const uniqueUnits = [...new Set(normalizedItems.map(i => i.Unit))];

                // Wrap in array for buildDiagram
                const unitLayout2D = [uniqueUnits];
                setUnitLayoutOrder(unitLayout2D);

                // Build diagram nodes and edges
                const { nodes: builtNodes, edges: builtEdges } = buildDiagram(normalizedItems, unitLayout2D);

                setNodes(builtNodes);
                setEdges(builtEdges);
                setItems(normalizedItems);

                // Pass units to UnitLayoutConfig
                const uniqueUnitsObjects = uniqueUnits.map(u => ({ id: u, Name: u }));
                setAvailableUnitsForConfig(uniqueUnitsObjects);

            } catch (err) {
                console.error('Error loading items:', err);
            }
        };

        loadItems();
    }, []);

    // rebuild diagram whenever user updates unitLayoutOrder
    useEffect(() => {
        if (items.length && unitLayoutOrder.length) {
            const { nodes: rebuiltNodes, edges: rebuiltEdges } = buildDiagram(items, unitLayoutOrder);
            setNodes(rebuiltNodes);
            setEdges(rebuiltEdges);
        }
    }, [unitLayoutOrder, items]);

    const itemsMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
    const selectedGroupNode =
        selectedNodes.length === 1 && selectedNodes[0]?.type === 'groupLabel' ? selectedNodes[0] : null;
    const childrenNodesForGroup = selectedGroupNode
        ? nodes.filter(n => {
            if (!n) return false;
            if (Array.isArray(selectedGroupNode.data?.children) && selectedGroupNode.data.children.includes(n.id)) return true;
            if (n.data?.groupId === selectedGroupNode.id) return true;
            if (n.data?.parentId === selectedGroupNode.id) return true;
            return false;
        })
        : [];



    // --- Group detail wiring ---
    const [addingToGroup, setAddingToGroup] = useState(null);


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
            Category: Array.isArray(rawItem['Category Item Type'])
                ? rawItem['Category Item Type'][0]
                : (rawItem['Category Item Type'] ?? rawItem.Category ?? ''),
            'Category Item Type': Array.isArray(rawItem['Category Item Type'])
                ? rawItem['Category Item Type'][0]
                : (rawItem['Category Item Type'] ?? rawItem.Category ?? ''),
            Type: Array.isArray(rawItem.Type) ? rawItem.Type[0] : (rawItem.Type || ''),
            Sequence: rawItem.Sequence ?? 0,
            Connections: Array.isArray(rawItem.Connections) ? rawItem.Connections : [], // ✅ include connections
        };

        const newNode = {
            id: normalizedItem.id,
            position: getUnitSubunitPosition(normalizedItem.Unit, normalizedItem.SubUnit, nodes),
            data: {
                label: `${normalizedItem.Code || ''} - ${normalizedItem.Name || ''}`,
                item: normalizedItem,
                icon: getItemIcon(normalizedItem),
            },
            type: categoryTypeMap[normalizedItem.Category] || 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent', boxShadow: 'none' },
        };

        setNodes(nds => [...nds, newNode]);
        setItems(prev => [...prev, normalizedItem]);

        // --- ✅ generate edges from Connections immediately ---
        if (normalizedItem.Connections.length) {
            const newEdges = normalizedItem.Connections.map(conn => {
                const fromNode = normalizedItem.id; // this node
                // Find target node by name or id
                const targetNode = nodes.find(n => n.data?.item?.Name === conn.to);
                if (!targetNode) return null; // skip if target not found
                return {
                    id: `edge-${fromNode}-${targetNode.id}`,
                    source: fromNode,
                    target: targetNode.id,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#888', strokeWidth: 2 },
                };
            }).filter(e => e != null);

            setEdges(eds => [...eds, ...newEdges]);
        }

        // Auto-select new node so ItemDetailCard opens
        setSelectedNodes([newNode]);
        setSelectedItem(normalizedItem);
    };

    function getUnitSubunitPosition(unit, subUnit, nodes) {
        const unitNode = nodes.find(n => n.id === `unit-${unit}`);
        const subUnitNode = nodes.find(n => n.id === `sub-${unit}-${subUnit}`);

        if (!subUnitNode) {
            // fallback if SubUnit not found
            return { x: 100, y: 100 };
        }

        // Get all items already in this subUnit
        const siblings = nodes.filter(n =>
            n.data?.item?.Unit === unit && n.data?.item?.SubUnit === subUnit
        );

        const itemWidth = 160;
        const itemGap = 30;

        let x = subUnitNode.position.x + 40 + siblings.length * (itemWidth + itemGap);
        let y = subUnitNode.position.y + 40;

        return { x, y };
    }

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
            {/* LEFT: Diagram */}
            <div style={{ flex: 3, position: "relative", background: "transparent" }}>
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
                    AddItemButton={(props) => (
                        <AddItemButton {...props} addItem={handleAddItem} />
                    )}
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
                    borderLeft: "1px solid #ccc",
                    display: "flex",
                    flexDirection: "column",
                    background: "transparent",
                }}
            >

                <div>
                    <UnitLayoutConfig
                        availableUnits={availableUnitsForConfig}
                        onChange={setUnitLayoutOrder}
                    />
                </div>
                {/* detail panel */}
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