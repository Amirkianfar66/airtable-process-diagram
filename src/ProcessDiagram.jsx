import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';
import { getItemIcon, AddItemButton, handleItemChangeNode, categoryTypeMap } from './IconManager';

import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import MainToolbar from './MainToolbar';

// Keep top-level nodeTypes definition
const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode, // just the component, no inline function
};


const fetchData = async () => {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
    let allRecords = [];
    let offset = null;
    const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

    do {
        const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
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
        setNodes(nds =>
            nds.map(node => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node))
        );
    };

    const deleteNode = (id) => {
        setNodes(nds => nds.filter(node => node.id !== id));
        setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
    };
    

    const onSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes(nodes);
        if (nodes.length === 1) {
            const nodeData = items.find(item => item.id === nodes[0].id);
            setSelectedItem(nodeData || null);
        } else {
            setSelectedItem(null);
        }
    }, [items]);

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

    const handleGeneratePNID = async () => {
        if (!aiDescription) return;

        try {
            const { nodes: aiNodes, edges: aiEdges } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            const newItems = aiNodes.map(n => n.data?.item).filter(Boolean);

            setItems(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const filteredNew = newItems.filter(i => !existingIds.has(i.id));
                const updatedItems = [...prev, ...filteredNew];

                if (filteredNew.length > 0) setSelectedItem(filteredNew[0]);

                return updatedItems;
            });

            setNodes(aiNodes);
            setEdges(aiEdges);

        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };
    

    useEffect(() => {
        fetchData()
            .then((items) => {
                const normalizedItems = items.map((item) => ({
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

                    Object.entries(subUnits).forEach(([subUnit, items], index) => {
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
                        items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        items.forEach((item) => {
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div style={{ padding: 10, display: 'flex', gap: 6, flexDirection: 'column' }}>
                {/* Input field + button */}
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        placeholder="Describe PNID for AI..."
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        style={{ flex: 1, padding: 4 }}
                    />
                    <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>
                        Generate PNID
                    </button>
                </div>

                {/* Chat messages below input */}
                <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto', padding: 10 }}>
                    <ChatBox messages={chatMessages} />
                </div>

                {/* 🔹 Main content (toolbar + canvas + side panel) */}
                <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                    {/* Left side (toolbar + canvas) */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <MainToolbar
                            selectedNodes={selectedNodes}
                            setNodes={setNodes}
                            updateNode={updateNode}
                            deleteNode={deleteNode}
                        />
                        <div style={{ flex: 1 }}>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onSelectionChange={onSelectionChange}
                                fitView
                                selectionOnDrag
                                minZoom={0.02}
                                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                                nodeTypes={nodeTypes}
                                style={{ background: 'transparent' }}
                            >
                                <Controls />
                            </ReactFlow>
                        </div>
                    </div>

                    {/* Right side (detail panel) */}
                    <div
                        style={{
                            width: 350,
                            borderLeft: '1px solid #ccc',
                            background: 'transparent',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {selectedItem ? (
                                <ItemDetailCard
                                    item={selectedItem}
                                    onChange={(updatedItem) =>
                                        handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)
                                    }
                                />
                            ) : (
                                <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );

}