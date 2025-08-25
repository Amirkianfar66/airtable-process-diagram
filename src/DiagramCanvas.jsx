// ------------------------------
// Updated: DiagramCanvas.jsx (uses AIChatPanel instead of ChatBox)
// Place this content into src/components/DiagramCanvas.jsx
// ------------------------------

import React from "react";
import PropTypes from "prop-types";
import ReactFlow, { Controls } from "reactflow";
import MainToolbar from "./MainToolbar";
import AIChatPanel from "./AIChatPanel"; // ✅ now using your chat panel
import "reactflow/dist/style.css";

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
    handleGeneratePNID, // <- will be passed into AIChatPanel as onGenerate
    selectedNodes,
    updateNode,
    deleteNode,
    onNodeDrag,
    onNodeDragStop,
}) {
    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* 🔹 Toolbar */}
            <MainToolbar
                selectedNodes={selectedNodes}
                nodes={nodes}
                edges={edges}
                setNodes={setNodes}
                setEdges={setEdges}
                updateNode={updateNode}
                deleteNode={deleteNode}
            />

            {/* 🔹 Add Item Button */}
            <div style={{ padding: 10 }}>
                {AddItemButton ? (
                    <AddItemButton setNodes={setNodes} setEdges={setEdges} />
                ) : null}
            </div>

            {/* 🔹 AI Chat Panel */}
            <div style={{ padding: 10 }}>
                <AIChatPanel onGenerate={handleGeneratePNID} />
            </div>

            {/* 🔹 Main Diagram */}
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

// 🔹 Prop validation
DiagramCanvas.propTypes = {
    nodes: PropTypes.array.isRequired,
    edges: PropTypes.array.isRequired,
    setNodes: PropTypes.func.isRequired,
    setEdges: PropTypes.func.isRequired,
    onNodesChange: PropTypes.func.isRequired,
    onEdgesChange: PropTypes.func.isRequired,
    onConnect: PropTypes.func.isRequired,
    onSelectionChange: PropTypes.func,
    nodeTypes: PropTypes.object,
    AddItemButton: PropTypes.elementType,
    handleGeneratePNID: PropTypes.func.isRequired,
    selectedNodes: PropTypes.array,
    updateNode: PropTypes.func,
    deleteNode: PropTypes.func,
    onNodeDrag: PropTypes.func,
    onNodeDragStop: PropTypes.func,
};
