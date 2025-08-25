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
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import DiagramCanvas from './DiagramCanvas';
import MainToolbar from './MainToolbar';
import AddItemButton from './AddItemButton';
import AIChatPanel from './AIChatPanel';
import { parseItemText } from './aiParser';
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


       


    // 🔹 This is where parseItemText is used
    const handleAIChat = async (userInput) => {
        // Add user message to chat in the correct format
        setChatMessages(prev => [...prev, { role: "user", content: userInput }]);

        // Call parser
        const reply = await parseItemText(userInput);

        // If it's a chat response, add the AI's explanation as a message
        if (reply?.mode === "chat" && reply.explanation) {
            setChatMessages(prev => [...prev, { sender: 'AI', message: reply.explanation }]);
        }
        // If it's a structured response, you can update the diagram here if you want
        else if (reply?.mode === "structured" && reply.parsed) {
            // Optionally, add an AI explanation to chat
            if (reply.explanation) {
                setChatMessages(prev => [...prev, { sender: 'AI', message: reply.explanation }]);
            }
            // Optionally, update nodes/edges/items here if you want to reflect PNID changes
            // Example (pseudo-code, adapt as needed):
            // const newNode = ... // build from reply.parsed
            // setNodes(prev => [...prev, newNode]);
            // setItems(prev => [...prev, reply.parsed]);
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
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            <div style={{ flex: 1, position: 'relative', background: 'transparent' }}>
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
                    // Use the local AddItemButton, wired to our fixed handler
                    AddItemButton={(props) => <AddItemButton {...props} addItem={handleAddItem} />}
                    aiDescription={aiDescription}
                    setAiDescription={setAiDescription}
                    handleAIChat={handleAIChat}
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

            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
                {/* AI Chat input panel */}
                <AIChatPanel onGenerate={handleAIChat} />

                {/* Details panel */}
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
                        <ItemDetailCard item={selectedItem} onChange={(updatedItem) => handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)} />
                    ) : (
                        <div style={{ padding: 20, color: '#888' }}>Select an item or group to see details</div>
                    )}
                </div>
            </div>
        </div>  
    );
}