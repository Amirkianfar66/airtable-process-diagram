// ------------------------------
// Updated: DiagramCanvas.jsx (accepts onNodeDrag + onNodeDragStop and forwards to ReactFlow)
// Place this content into src/components/DiagramCanvas.jsx (replace existing)

import React, { useMemo } from 'react';
import ReactFlow, { Controls } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';
import GroupDetailCard from './GroupDetailCard';
import { getItemIcon, handleItemChangeNode, categoryTypeMap } from './IconManager';
import DiagramCanvas from './DiagramCanvas';
import AddItemButton from './AddItemButton';

// NOTE: keep this component presentational only — all state handlers are provided by the parent
export default function DiagramCanvas({
    items = [],
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    nodeTypes,
    AddItemButton,
    aiDescription,
    setAiDescription,
    handleGeneratePNID,
    chatMessages,
    setChatMessages,
    selectedNodes,
    updateNode,
    deleteNode,
    onNodeDrag, // <- new prop
    onNodeDragStop, // <- new prop
}) {
    // Generate nodes/edges from items
    const { nodes: memoizedNodes, edges: memoizedEdges } = useMemo(() => {
        if (!items || items.length === 0) return { nodes: [], edges: [] };

        const grouped = {};
        items.forEach((item) => {
            const { Unit, SubUnit, Category, Sequence, Name, Code, id } = item;
            if (!Unit || !SubUnit) return;
            if (!grouped[Unit]) grouped[Unit] = {};
            if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
            grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id, item });
        });

        const newNodes = [];
        const newEdges = [];
        let unitX = 0;
        const unitWidth = 5000;
        const unitHeight = 6000;
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
                itemsArr.forEach(({ item }) => {
                    newNodes.push({
                        id: item.id,
                        position: { x: itemX, y: yOffset + 20 },
                        data: { label: `${item.Code || ''} - ${item.Name || ''}`, item },
                        // type, icon, etc. can be added as needed
                        style: { background: 'transparent', boxShadow: 'none' },
                    });
                    itemX += itemWidth + itemGap;
                });
            });

            unitX += unitWidth + 100;
        });

        return { nodes: newNodes, edges: newEdges };
    }, [items]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Main toolbar */}
            <MainToolbar
                selectedNodes={selectedNodes}
                nodes={nodes}
                edges={edges}
                setNodes={setNodes}
                setEdges={setEdges}
                updateNode={updateNode}
                deleteNode={deleteNode}
            />
            <div style={{ padding: 10 }}>
                {/* Add item button is passed from parent so it has access to setNodes/setItems there if needed */}
                {AddItemButton ? <AddItemButton setNodes={setNodes} setEdges={setEdges} /> : null}
            </div>

            <div style={{ padding: 10, display: 'flex', gap: 6, flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" placeholder="Describe PNID for AI" value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} style={{ flex: 1, padding: 4 }} />
                    <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>Generate PNID</button>
                </div>
                <div style={{ marginTop: 6 }}>
                    <ChatBox messages={chatMessages} />
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <ReactFlow
                    nodes={memoizedNodes}
                    edges={memoizedEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
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
    );
}
