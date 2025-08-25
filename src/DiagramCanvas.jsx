// ------------------------------
// Updated: DiagramCanvas.jsx (accepts onNodeDrag + onNodeDragStop and forwards to ReactFlow)
// Place this content into src/components/DiagramCanvas.jsx (replace existing)

import React from 'react';
import ReactFlow, { Controls } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';

// NOTE: keep this component presentational only — all state handlers are provided by the parent
export default function DiagramCanvas({
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
                    nodes={nodes}
                    edges={edges}
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
