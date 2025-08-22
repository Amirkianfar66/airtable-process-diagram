// ===================== DiagramCanvas.jsx =====================
// Place this file at: src/components/DiagramCanvas.jsx

import React from 'react';
import ReactFlow, { Controls } from 'reactflow';
import MainToolbar from './MainToolbar';
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
    selectedNodes,
    updateNode,
    deleteNode,
    setSelectedItem,
    setSelectedNodes,
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
                {/* Add button wired to handleAddItem */}
                {AddItemButton ? (
                    <AddItemButton addItem={handleAddItem} />
                ) : null}
            </div>



            <div style={{ padding: 10, display: 'flex', gap: 6, flexDirection: 'column' }}>
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
                <div style={{
                    marginTop: 6,
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid #2196F3',
                    borderRadius: 4,
                    padding: 6
                }}>
                    {/* Simple chatbox-like display */}
                    {chatMessages && chatMessages.length > 0 ? (
                        chatMessages.map((msg, idx) => (
                            <div key={idx} style={{ marginBottom: 4 }}>
                                <strong>{msg.role}:</strong> {msg.content}
                            </div>
                        ))
                    ) : (
                        <div style={{ color: '#777' }}>No AI messages yet...</div>
                    )}
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
