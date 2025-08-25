// ------------------------------
// Updated: DiagramCanvas.jsx (uses AIChatPanel with handleAIChat)
// Place this content into src/components/DiagramCanvas.jsx (replace existing)

import React from "react";
import ReactFlow, { Controls } from "reactflow";
import MainToolbar from "./MainToolbar";
import "reactflow/dist/style.css";
import AIChatPanel from "./AIChatPanel"; // ✅ now we import your new chat panel

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
    handleAIChat, // ✅ use this instead of handleGeneratePNID
    selectedNodes,
    updateNode,
    deleteNode,
    onNodeDrag,
    onNodeDragStop,
}) {
    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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

            {/* ✅ Chat panel for AI */}
            <div style={{ padding: 10, display: "flex", flexDirection: "column" }}>
                <AIChatPanel onGenerate={handleAIChat} />
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
                    style={{ background: "transparent" }}
                >
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
}
