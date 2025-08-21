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

                // Group items by Unit and SubUnit
                const grouped = {};
                normalizedItems.forEach((item) => {
                    const { Unit, SubUnit } = item;
                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                    grouped[Unit][SubUnit].push(item);
                });

                const newNodes = [];
                let unitX = 0;
                const unitWidth = 5000;
                const unitHeight = 3000;

                // Create one GroupLabelNode per Unit
                Object.entries(grouped).forEach(([unit, subUnits]) => {
                    newNodes.push({
                        id: `unit-${unit}`,
                        position: { x: unitX, y: 0 },
                        type: 'groupLabel', // uses GroupLabelNode
                        data: {
                            groupName: unit,
                            items: Object.entries(subUnits).flatMap(([subUnitName, items]) =>
                                items.map((item, idx) => ({
                                    ...item,
                                    position: {
                                        x: 40 + idx * 190, // item width + gap
                                        y: 30, // inside group offset
                                    },
                                    width: 160,
                                    height: 60,
                                }))
                            ),
                        },
                        style: {
                            width: unitWidth,
                            height: unitHeight,
                            border: '4px solid #444',
                            background: 'transparent',
                        },
                        draggable: false,
                        selectable: true,
                    });

                    unitX += unitWidth + 100;
                });

                setNodes(newNodes);
                setEdges([]);
                setDefaultLayout({ nodes: newNodes, edges: [] });
            })
            .catch(console.error);
    }, []);


    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            <div style={{ flex: 1, position: 'relative', background: 'transparent' }}>
                <div style={{ padding: 10 }}>
                    <AddItemButton setNodes={setNodes} setItems={setItems} setSelectedItem={setSelectedItem} />
                </div>

                <div style={{ padding: 10, display: 'flex', gap: 6, flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input type="text" placeholder="Describe PNID for AI..." value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} style={{ flex: 1, padding: 4 }} />
                        <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>Generate PNID</button>
                    </div>
                    <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                        <ChatBox messages={chatMessages} />
                    </div>
                </div>

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

            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {selectedItem ? (
                        <ItemDetailCard item={selectedItem} onChange={(updatedItem) => handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)} />
                    ) : (
                        <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                    )}
                </div>
            </div>
        </div>
    );
}