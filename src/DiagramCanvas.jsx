import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';

// DiagramCanvas: presentational, but now owns full onEdgeClick behavior
// - shows a local Edge inspector panel when an edge is clicked
// - allows deleting/toggling animation/editing label for the clicked edge
// - still calls parent onEdgeClick if provided (for backwards compatibility)
export default function DiagramCanvas({
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onEdgeClick, // optional parent handler (kept for compatibility)
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
    // Local state to manage the currently-selected edge (inspector)
    const [selectedEdge, setSelectedEdge] = useState(null);

    useEffect(() => {
        console.log('DiagramCanvas prop onEdgeClick:', onEdgeClick);
    }, [onEdgeClick]);

    // Make edges clickable and increase their clickable area
    const enhancedEdges = useMemo(() => {
        if (!Array.isArray(edges)) return [];
        return edges.map((e) => ({
            ...e,
            style: { ...(e.style || {}), pointerEvents: e.style?.pointerEvents ?? 'auto' },
            interactionWidth: e.interactionWidth ?? 20,
        }));
    }, [edges]);

    // Primary edge click handler now lives entirely in this component.
    // It will open the Edge inspector and also call parent's onEdgeClick if provided.
    const handleEdgeClick = (event, edge) => {
        event?.stopPropagation?.();
        console.log('DiagramCanvas local edge click:', edge);

        // Open local inspector
        setSelectedEdge(edge);

        // forward to parent if they want to listen too
        if (typeof onEdgeClick === 'function') {
            try {
                onEdgeClick(event, edge);
            } catch (err) {
                console.error('Parent onEdgeClick threw an error:', err);
            }
        }
    };

    // Edge inspector helpers --- they update edges via setEdges provided by parent
    const updateSelectedEdge = (patch) => {
        if (!selectedEdge) return;
        setEdges((prev) =>
            prev.map((e) => (e.id === selectedEdge.id ? { ...e, ...patch } : e))
        );
        setSelectedEdge((s) => (s ? { ...s, ...patch } : s));
    };

    const deleteSelectedEdge = () => {
        if (!selectedEdge) return;
        setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
        setSelectedEdge(null);
    };

    const toggleEdgeAnimated = () => {
        if (!selectedEdge) return;
        updateSelectedEdge({ animated: !selectedEdge.animated });
    };

    const changeEdgeLabel = (label) => {
        updateSelectedEdge({ label });
    };

    // Defensive: if no parent setEdges was provided, log a helpful error
    useEffect(() => {
        if (typeof setEdges !== 'function') {
            console.warn('DiagramCanvas: expected setEdges function from parent but got', setEdges);
        }
    }, [setEdges]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
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

            <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlow
                    nodes={Array.isArray(nodes) ? nodes : []}
                    edges={enhancedEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    onEdgeClick={handleEdgeClick}
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

                {/* Edge inspector panel (floating on the right) */}
                {selectedEdge ? (
                    <div
                        style={{
                            position: 'absolute',
                            right: 12,
                            top: 12,
                            width: 320,
                            maxHeight: '60vh',
                            overflowY: 'auto',
                            background: 'white',
                            border: '1px solid #ddd',
                            borderRadius: 8,
                            padding: 12,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            zIndex: 9999,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>Edge inspector</strong>
                            <button onClick={() => setSelectedEdge(null)} style={{ marginLeft: 8 }}>Close</button>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 13, color: '#333' }}>
                            <div><strong>ID:</strong> {selectedEdge.id}</div>
                            <div><strong>Source:</strong> {selectedEdge.source}{selectedEdge.sourceHandle ? ` (${selectedEdge.sourceHandle})` : ''}</div>
                            <div><strong>Target:</strong> {selectedEdge.target}{selectedEdge.targetHandle ? ` (${selectedEdge.targetHandle})` : ''}</div>
                            <div style={{ marginTop: 8 }}><strong>Type:</strong> {selectedEdge.type || 'default'}</div>

                            <div style={{ marginTop: 12 }}>
                                <label style={{ display: 'block', fontSize: 12 }}>Label</label>
                                <input
                                    value={selectedEdge.label || ''}
                                    onChange={(e) => changeEdgeLabel(e.target.value)}
                                    style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                                <button onClick={toggleEdgeAnimated}>
                                    {selectedEdge.animated ? 'Disable animation' : 'Enable animation'}
                                </button>

                                <button onClick={deleteSelectedEdge} style={{ background: '#ffecec' }}>
                                    Delete edge
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
