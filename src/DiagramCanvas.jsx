// src/components/DiagramCanvas.jsx
import React, { useEffect, useMemo } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';

// Keep this component presentational — parent provides handlers
export default function DiagramCanvas({
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onEdgeClick,
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
    onNodeDrag,
    onNodeDragStop,
}) {
    // Debug: confirm prop arrives
    useEffect(() => {
        console.log('DiagramCanvas prop onEdgeClick:', onEdgeClick);
    }, [onEdgeClick]);

    // Defensive handler - only call if function provided
    const handleEdgeClick = (event, edge) => {
        if (typeof onEdgeClick === 'function') {
            try {
                onEdgeClick(event, edge);
            } catch (err) {
                console.error('Error in parent onEdgeClick handler:', err);
            }
        } else {
            console.warn('Edge clicked but onEdgeClick prop is not a function', edge);
        }
    };

    // Ensure edges are clickable: add pointerEvents and interactionWidth if missing.
    // This does not mutate original edges.
    const enhancedEdges = useMemo(
        () =>
            (Array.isArray(edges) ? edges : []).map((e) => ({
                ...e,
                // make sure edge SVG can receive pointer events
                style: { ...(e.style || {}), pointerEvents: e.style?.pointerEvents ?? 'auto' },
                // widen clickable area if not explicitly set
                interactionWidth: e.interactionWidth ?? 20,
            })),
        [edges]
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top toolbar */}
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
                {AddItemButton ? <AddItemButton setNodes={setNodes} setEdges={setEdges} /> : null}
            </div>

            <div style={{ padding: 10, display: 'flex', gap: 6, flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        placeholder="Describe PNID for AI"
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        style={{ flex: 1, padding: 4 }}
                    />
                    <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>
                        Generate PNID
                    </button>
                </div>
                <div style={{ marginTop: 6 }}>
                    <ChatBox messages={chatMessages} />
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <ReactFlow
                    nodes={Array.isArray(nodes) ? nodes : []}
                    edges={enhancedEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    onEdgeClick={handleEdgeClick}        // forwarded safely
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                    fitView
                    selectionOnDrag
                    minZoom={0.02}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    nodeTypes={nodeTypes}
                    style={{ background: 'transparent' }}
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
}
