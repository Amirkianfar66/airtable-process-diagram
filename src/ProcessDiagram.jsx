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
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [aiDescription, setAiDescription] = useState('');
    const [chatMessages, setChatMessages] = useState([]);

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
            const updatedEdges = addEdge({ ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } }, edges);
            setEdges(updatedEdges);
        },
        [edges]
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
                if (filteredNew.length > 0) setSelectedItem(filteredNew[0]);
                return [...prev, ...filteredNew];
            });

            setNodes(aiNodes);
            setEdges(aiEdges);
        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            <div style={{ flex: 1, position: 'relative', background: 'transparent' }}>
                <div style={{ padding: 10 }}>
                    <AddItemButton setNodes={setNodes} setItems={setItems} setSelectedItem={setSelectedItem} />
                </div>

                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input
                            type="text"
                            placeholder="Describe PNID for AI..."
                            value={aiDescription}
                            onChange={(e) => setAiDescription(e.target.value)}
                            style={{ flex: 1, padding: 4 }}
                        />
                        <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>Generate PNID</button>
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
                        <ItemDetailCard
                            item={selectedItem}
                            onChange={(updatedItem) => handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)}
                        />
                    ) : (
                        <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                    )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <ChatBox messages={chatMessages} />
                </div>
            </div>
        </div>
    );
}
