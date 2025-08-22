// ===================== DiagramCanvas.jsx =====================
// Place this file at: src/components/DiagramCanvas.jsx

import React from 'react';
import ReactFlow, { Controls } from 'reactflow';
import 'reactflow/dist/style.css';

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
}) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 10 }}>
                {/* Add item button is passed from parent so it has access to setNodes/setItems there if needed */}
                {AddItemButton ? <AddItemButton setNodes={setNodes} setEdges={setEdges} /> : null}
            </div>

            <div style={{ padding: 10, display: 'flex', gap: 6, flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" placeholder="Describe PNID for AI..." value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} style={{ flex: 1, padding: 4 }} />
                    <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>Generate PNID</button>
                </div>
                <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {/* ChatBox lives in AIPNIDGenerator; parent keeps chatMessages state */}
                    <div>
                        {/* If ChatBox is exported as named export it can be used here by importing in parent and passing down. */}
                    </div>
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
