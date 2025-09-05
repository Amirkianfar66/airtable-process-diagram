// src/components/DiagramCanvas.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';
import { getItemIcon, categoryTypeMap } from "./IconManager";
import ScalableIconNode from './ScalableIconNode';
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';

export default function DiagramCanvas({
    nodes,
    edges,
    setNodes,
    setEdges,
    setItems,
    setSelectedItem,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onEdgeClick,
    onEdgeSelect,
    nodeTypes,
    AddItemButton,
    addItem,
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
    showInlineEdgeInspector = true,
}) {
    const [selectedEdge, setSelectedEdge] = useState(null);
    const panelRef = useRef(null);

    useEffect(() => {
        console.log('DiagramCanvas prop onEdgeClick:', onEdgeClick);
    }, [onEdgeClick]);

    const enhancedEdges = useMemo(() => {
        if (!Array.isArray(edges)) return [];
        return edges.map((e) => ({
            ...e,
            style: { ...(e.style || {}), pointerEvents: e.style?.pointerEvents ?? 'auto' },
            interactionWidth: e.interactionWidth ?? 20,
        }));
    }, [edges]);

    // <-- PUT THE DEBUG + MEMO HERE (right after enhancedEdges) -->
    useEffect(() => {
        console.log("categoryTypeMap['Inline Valve'] — raw:", categoryTypeMap?.['Inline Valve']);
    }, [categoryTypeMap]);

    const inlineValveTypes = useMemo(() => {
        const val = categoryTypeMap?.['Inline Valve'];
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.keys(val);
        return [String(val)];
    }, [categoryTypeMap]);
    // <-- END INSERT -->

    const deleteSelectedEdge = () => {
        if (!selectedEdge || typeof setEdges !== 'function') return;
        if (!window.confirm('Delete this edge?')) return;
        setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
        handleCloseInspector();
    };
    const handleEdgeClick = (event, edge) => {
        event?.stopPropagation?.();
        const liveEdge = edges?.find((e) => e.id === edge.id) || edge;
        setSelectedEdge(liveEdge);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(liveEdge);
        if (typeof onEdgeClick === 'function') onEdgeClick(event, liveEdge);
    };

    // safer update that merges nested data
    const updateSelectedEdge = (patch) => {
        if (typeof setEdges !== 'function') return;

        setEdges((prev) =>
            prev.map((e) => {
                if (e.id !== selectedEdge?.id) return e;
                // merge data deeply-ish: keep existing e.data and merge patch.data
                const mergedData = { ...(e.data || {}), ...(patch.data || {}) };
                // copy everything else shallowly
                return { ...e, ...patch, data: mergedData };
            })
        );

        // update the selectedEdge in local state too
        setSelectedEdge((s) => {
            if (!s) return s;
            const mergedData = { ...(s.data || {}), ...(patch.data || {}) };
            return { ...s, ...patch, data: mergedData };
        });
    };


    const changeEdgeCategory = (category) => {
        if (!selectedEdge) return;

        // non-inline: just patch the edge's data
        if (category !== "Inline Valve") {
            updateSelectedEdge({
                data: { ...(selectedEdge.data || {}), category },
            });
            return;
        }

        // Inline Valve -> create valve node and split edges
        const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
        const targetNode = nodes.find((n) => n.id === selectedEdge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        const newItem = {
            id: `valve-${Date.now()}`,
            "Item Code": "VALVE001",
            Name: "Inline Valve",
            Category: "Inline Valve",
            "Category Item Type": "Inline Valve",
            Type: "",
            Unit: sourceNode.data?.item?.Unit || "",
            SubUnit: sourceNode.data?.item?.SubUnit || "",
            x: midX,
            y: midY,
            edgeId: selectedEdge.id,
        };

        const newNode = {
            id: newItem.id,
            position: { x: midX, y: midY },
            data: {
                label: `${newItem["Item Code"]} - ${newItem.Name}`,
                item: newItem,
                icon: getItemIcon(newItem),
            },
            type: "scalableIcon",
            sourcePosition: "right",
            targetPosition: "left",
            style: { background: "transparent" },
        };

        const newEdgeA = {
            id: `${selectedEdge.source}-${newNode.id}`,
            source: selectedEdge.source,
            target: newNode.id,
            type: "step",
            style: { stroke: selectedEdge?.style?.stroke || "#000" },
            data: { category: "Inline Valve", Type: "" },
        };
        const newEdgeB = {
            id: `${newNode.id}-${selectedEdge.target}`,
            source: newNode.id,
            target: targetNode.id,
            type: "step",
            style: { stroke: selectedEdge?.style?.stroke || "#000" },
            data: { category: "Inline Valve", Type: "" },
        };

        // push new node and replace edges
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => {
            const next = [...eds.filter((e) => e.id !== selectedEdge.id), newEdgeA, newEdgeB];
            return next;
        });

        // IMPORTANT: set the inspector to the new edge (so the inspector shows data and Type dropdown)
        setSelectedEdge(newEdgeA);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(newEdgeA);
    };


    const handleCloseInspector = () => {
        setSelectedEdge(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
        // also clear any selected item in parent
        if (typeof setSelectedItem === 'function') setSelectedItem(null);
    };

    // --- NEW: keyboard shortcuts for Delete (delete item) and Escape (close)
    useEffect(() => {
        const onKey = (e) => {
            // ESC -> close any open inspector
            if (e.key === 'Escape') {
                handleCloseInspector();
                return;
            }

            // Delete / Backspace -> delete either selected edge (if open) or selected node (if exactly one selected)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // 1) If an edge inspector is open, delete that edge
                if (selectedEdge) {
                    // re-use your existing handler
                    deleteSelectedEdge();
                    return;
                }

                // 2) Otherwise, check selectedNodes prop from parent (if single node selected)
                if (Array.isArray(selectedNodes) && selectedNodes.length === 1) {
                    const nodeToDelete = selectedNodes[0];
                    const nodeId = nodeToDelete?.id ?? nodeToDelete; // support both node object or id string
                    if (!nodeId) return;

                    if (!window.confirm('Delete this item and its connected edges?')) return;

                    // remove node
                    if (typeof setNodes === 'function') {
                        setNodes((prev) => (Array.isArray(prev) ? prev.filter((n) => n.id !== nodeId) : prev));
                    }

                    // remove edges connected to it
                    if (typeof setEdges === 'function') {
                        setEdges((prev) => (Array.isArray(prev) ? prev.filter((ed) => ed.source !== nodeId && ed.target !== nodeId) : prev));
                    }

                    // remove from items if available
                    if (typeof setItems === 'function') {
                        setItems((prevItems) => (Array.isArray(prevItems) ? prevItems.filter((it) => it.id !== nodeId) : prevItems));
                    }

                    // notify parent selection change (clear selection)
                    if (typeof onSelectionChange === 'function') onSelectionChange({ nodes: [], edges: [] });

                    // clear parent selectedItem
                    if (typeof setSelectedItem === 'function') setSelectedItem(null);

                    return;
                }
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedEdge, selectedNodes, deleteSelectedEdge, setNodes, setEdges, setItems, setSelectedItem, onSelectionChange]);


    const edgeCategories = ['None', 'Inline Valve'];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                {AddItemButton && (
                    // Render the component and forward the handler + useful setters
                    <AddItemButton addItem={addItem} setNodes={setNodes} setEdges={setEdges} setItems={setItems} />
                )}
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

                <aside
                    ref={panelRef}
                    aria-hidden={!selectedEdge}
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        height: '100%',
                        width: selectedEdge ? 360 : 0,
                        transform: selectedEdge ? 'translateX(0)' : 'translateX(100%)',
                        transition: 'width 220ms ease, transform 220ms ease',
                        background: '#fff',
                        borderLeft: selectedEdge ? '1px solid #ddd' : 'none',
                        boxShadow: selectedEdge ? '-8px 0 24px rgba(0,0,0,0.08)' : 'none',
                        overflow: 'hidden',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {selectedEdge && (
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Edge inspector</strong>
                                <div>
                                    <button onClick={deleteSelectedEdge} style={{ marginRight: 8 }}>Delete</button>
                                    <button onClick={handleCloseInspector}>Close</button>
                                </div>
                            </div>

                            {/* Edge details */}
                            <div style={{ fontSize: 13 }}>
                                <div><strong>ID:</strong> {selectedEdge.id}</div>
                                <div><strong>Source:</strong> {selectedEdge.source}{selectedEdge.sourceHandle ? ` (${selectedEdge.sourceHandle})` : ''}</div>
                                <div><strong>Target:</strong> {selectedEdge.target}{selectedEdge.targetHandle ? ` (${selectedEdge.targetHandle})` : ''}</div>
                                <div style={{ marginTop: 8 }}><strong>Type:</strong> {selectedEdge.type || 'default'}</div>
                            </div>

                            {/* Category selector */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Category</label>
                                <select
                                    value={selectedEdge?.data?.category || 'None'}
                                    onChange={(e) => changeEdgeCategory(e.target.value)}
                                    style={{ padding: 8, width: '100%' }}
                                >
                                    {edgeCategories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ✅ Type selector (only shows for Inline Valve) */}
                            {selectedEdge?.data?.category === 'Inline Valve' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 12 }}>Type</label>
                                    <select
                                        value={selectedEdge?.data?.Type || ''}
                                        onChange={(e) =>
                                            updateSelectedEdge({
                                                data: { ...(selectedEdge.data || {}), Type: e.target.value },
                                            })
                                        }
                                        style={{ padding: 8, width: '100%' }}
                                    >
                                        <option value="">Select type...</option>

                                        {inlineValveTypes.length > 0 ? (
                                            inlineValveTypes.map((type) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))
                                        ) : (
                                            <option value="" disabled>No types defined</option>
                                        )}
                                    </select>

                                </div>
                            )}

                            {/* Footer hint */}
                            <div style={{ marginTop: 'auto', fontSize: 12, color: '#666' }}>
                                Keyboard: Esc to close · Delete to remove
                            </div>
                        </div>
                    )}
                </aside>



            </div>
        </div>
    );
}
