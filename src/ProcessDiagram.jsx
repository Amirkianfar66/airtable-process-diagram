// ProcessDiagram.jsx (fixed for AI-generated ItemDetailCard)

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Controls, useNodesState, useEdgesState, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';
import { getItemIcon, AddItemButton, handleItemChangeNode, categoryTypeMap } from './IconManager';
import AIPNIDGenerator from './AIPNIDGenerator';

const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
};

export default function ProcessDiagram() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [aiDescription, setAiDescription] = useState('');

    const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
        if (selectedNodes.length === 1) {
            const node = selectedNodes[0];
            const nodeItem = node.data?.item;
            setSelectedItem(nodeItem || null);
        } else {
            setSelectedItem(null);
        }
    }, []);

    const onConnect = useCallback(
        (params) => {
            setEdges((eds) => addEdge({ ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } }, eds));
        },
        []
    );

    const handleGeneratePNID = async () => {
        if (!aiDescription) return;
        try {
            const { nodes: aiNodes, edges: aiEdges } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem // pass setter so new item is selected
            );

            // Merge AI nodes and edges with existing ones
            setNodes(aiNodes);
            setEdges(aiEdges);

            // Extract new items from AI nodes
            const newItems = aiNodes.map(n => n.data?.item).filter(Boolean);
            setItems(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const filteredNew = newItems.filter(i => !existingIds.has(i.id));
                return [...prev, ...filteredNew];
            });

        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };

    useEffect(() => {
        // Fetch items from Airtable or any source and normalize them
        async function fetchData() {
            const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
            const token = import.meta.env.VITE_AIRTABLE_TOKEN;
            const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
            let allRecords = [];
            let offset = null;
            const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

            do {
                const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                allRecords = allRecords.concat(data.records);
                offset = data.offset;
            } while (offset);

            const normalizedItems = allRecords.map(rec => ({
                id: rec.id,
                Code: rec.fields['Item Code'] || rec.fields.Code || '',
                Name: rec.fields.Name || '',
                Category: Array.isArray(rec.fields['Category Item Type']) ? rec.fields['Category Item Type'][0] : rec.fields['Category Item Type'] || '',
                Type: Array.isArray(rec.fields.Type) ? rec.fields.Type[0] : rec.fields.Type || '',
                Unit: rec.fields.Unit || 'Default Unit',
                SubUnit: rec.fields.SubUnit || rec.fields['Sub Unit'] || 'Default SubUnit',
                Sequence: rec.fields.Sequence || 0,
            }));

            setItems(normalizedItems);

            // Optionally: populate initial nodes if needed
        }
        fetchData().catch(console.error);
    }, []);

    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
            <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ padding: 10 }}>
                    <AddItemButton setNodes={setNodes} setItems={setItems} setSelectedItem={setSelectedItem} />
                </div>

                <div style={{ padding: 10, display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        placeholder="Describe PNID for AI..."
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        style={{ flex: 1, padding: 4 }}
                    />
                    <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>Generate PNID</button>
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
                    nodeTypes={nodeTypes}
                    style={{ background: 'transparent' }}
                >
                    <Controls />
                </ReactFlow>
            </div>

            <div style={{ width: 350, borderLeft: '1px solid #ccc', overflowY: 'auto' }}>
                {selectedItem ? (
                    <ItemDetailCard
                        item={selectedItem}
                        onChange={(updatedItem) => handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)}
                    />
                ) : (
                    <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                )}
            </div>
        </div>
    );
}