// src/components/DiagramCanvas.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';
import { getItemIcon, categoryTypeMap } from './IconManager';
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
    // local inspector state
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const panelRef = useRef(null);

    // debug
    useEffect(() => {
        console.log('DiagramCanvas prop onEdgeClick:', onEdgeClick);
    }, [onEdgeClick]);

    // normalized edges for pointer events and interaction width
    const enhancedEdges = useMemo(() => {
        if (!Array.isArray(edges)) return [];
        return edges.map((e) => ({
            ...e,
            style: { ...(e.style || {}), pointerEvents: e.style?.pointerEvents ?? 'auto' },
            interactionWidth: e.interactionWidth ?? 20,
        }));
    }, [edges]);

    // Inline valve types helper (for the Type dropdown)
    const inlineValveTypes = useMemo(() => {
        const val = categoryTypeMap?.['Inline Valve'];
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.keys(val);
        return [String(val)];
    }, [categoryTypeMap]);

    // --------------------
    // Edge handlers
    // --------------------
    const handleEdgeClick = useCallback(
        (event, edge) => {
            event?.stopPropagation?.();
            const liveEdge = edges?.find((e) => e.id === edge.id) || edge;
            setSelectedEdge(liveEdge);
            setSelectedNode(null);
            if (typeof onEdgeSelect === 'function') onEdgeSelect(liveEdge);
            if (typeof onEdgeClick === 'function') onEdgeClick(event, liveEdge);
        },
        [edges, onEdgeSelect, onEdgeClick]
    );

    const deleteSelectedEdge = useCallback(() => {
        if (!selectedEdge || typeof setEdges !== 'function') return;
        if (!window.confirm('Delete this edge?')) return;
        setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
        handleCloseInspector();
    }, [selectedEdge, setEdges]);

    const updateSelectedEdge = useCallback(
        (patch) => {
            if (typeof setEdges !== 'function') return;
            setEdges((prev) =>
                prev.map((e) => {
                    if (e.id !== selectedEdge?.id) return e;
                    const mergedData = { ...(e.data || {}), ...(patch.data || {}) };
                    return { ...e, ...patch, data: mergedData };
                })
            );
            setSelectedEdge((s) => {
                if (!s) return s;
                const mergedData = { ...(s.data || {}), ...(patch.data || {}) };
                return { ...s, ...patch, data: mergedData };
            });
        },
        [selectedEdge, setEdges]
    );

    // If category changes to Inline Valve, create valve node and split edge
    const changeEdgeCategory = useCallback(
        (category) => {
            if (!selectedEdge) return;

            if (category !== 'Inline Valve') {
                // simple category patch
                updateSelectedEdge({
                    data: { ...(selectedEdge.data || {}), category },
                });
                return;
            }

            // Inline Valve: split into two edges and insert valve node in middle
            const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
            const targetNode = nodes.find((n) => n.id === selectedEdge.target);
            if (!sourceNode || !targetNode) return;

            const midX = (sourceNode.position.x + targetNode.position.x) / 2;
            const midY = (sourceNode.position.y + targetNode.position.y) / 2;

            const newItem = {
                id: `valve-${Date.now()}`,
                'Item Code': `VALVE-${Date.now()}`,
                Name: 'Inline Valve',
                Category: 'Inline Valve',
                'Category Item Type': 'Inline Valve',
                Type: '',
                Unit: sourceNode.data?.item?.Unit || '',
                SubUnit: sourceNode.data?.item?.SubUnit || '',
                x: midX,
                y: midY,
                edgeId: selectedEdge.id,
            };

            const newNode = {
                id: newItem.id,
                position: { x: midX, y: midY },
                data: {
                    label: `${newItem['Item Code']} - ${newItem.Name}`,
                    item: newItem,
                    icon: getItemIcon(newItem),
                },
                type: 'scalableIcon',
                sourcePosition: 'right',
                targetPosition: 'left',
                style: { background: 'transparent' },
            };

            // Compose the two new edges as 'step' (as requested)
            const newEdgeA = {
                id: `edge-${selectedEdge.source}-${newNode.id}-${Date.now()}`,
                source: selectedEdge.source,
                target: newNode.id,
                type: 'step',
                animated: selectedEdge.animated ?? true,
                style: { stroke: selectedEdge?.style?.stroke || '#000' },
                data: { category: 'Inline Valve', Type: '' },
            };
            const newEdgeB = {
                id: `edge-${newNode.id}-${selectedEdge.target}-${Date.now()}`,
                source: newNode.id,
                target: targetNode.id,
                type: 'step',
                animated: selectedEdge.animated ?? true,
                style: { stroke: selectedEdge?.style?.stroke || '#000' },
                data: { category: 'Inline Valve', Type: '' },
            };

            // Add node and replace edge
            setNodes((nds) => [...nds, newNode]);
            setEdges((eds) => {
                const next = [...eds.filter((e) => e.id !== selectedEdge.id), newEdgeA, newEdgeB];
                return next;
            });

            // focus inspector on the newly-created first edge
            setSelectedEdge(newEdgeA);
            if (typeof onEdgeSelect === 'function') onEdgeSelect(newEdgeA);
        },
        [selectedEdge, nodes, setNodes, setEdges, updateSelectedEdge, onEdgeSelect]
    );

    // --------------------
    // Node handlers
    // --------------------
    const handleNodeClick = useCallback(
        (event, node) => {
            event?.stopPropagation?.();
            const liveNode = nodes?.find((n) => n.id === node.id) || node;
            setSelectedNode(liveNode);
            setSelectedEdge(null);
            // surface the authoritative item if available
            if (typeof setSelectedItem === 'function') setSelectedItem(liveNode?.data?.item ?? null);
        },
        [nodes, setSelectedItem]
    );

    const deleteSelectedNode = useCallback(() => {
        if (!selectedNode || typeof setNodes !== 'function') return;
        if (!window.confirm('Delete this item?')) return;

        // remove node and all connected edges
        setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
        setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));

        // also remove from items (if that setter exists)
        if (typeof setItems === 'function') {
            setItems((prevItems) => Array.isArray(prevItems) ? prevItems.filter((it) => it.id !== selectedNode.id) : prevItems);
        }

        // clear inspector & selectedItem
        setSelectedNode(null);
        if (typeof setSelectedItem === 'function') setSelectedItem(null);
    }, [selectedNode, setNodes, setEdges, setItems, setSelectedItem]);

    const updateSelectedNode = useCallback(
        (patch) => {
            if (typeof setNodes !== 'function') return;
            setNodes((prev) =>
                prev.map((n) => {
                    if (n.id !== selectedNode?.id) return n;
                    const mergedData = { ...(n.data || {}), ...(patch.data || {}) };
                    return { ...n, ...patch, data: mergedData };
                })
            );

            setSelectedNode((s) => {
                if (!s) return s;
                const mergedData = { ...(s.data || {}), ...(patch.data || {}) };
                return { ...s, ...patch, data: mergedData };
            });

            // Also update canonical items list if present
            if (typeof setItems === 'function') {
                setItems((prevItems) => {
                    if (!Array.isArray(prevItems)) return prevItems;
                    return prevItems.map((it) =>
                        it.id === selectedNode?.id ? { ...it, ...(patch.data?.item || {}) } : it
                    );
                });
            }
        },
        [selectedNode, setNodes, setItems]
    );

    // single close handler
    const handleCloseInspector = useCallback(() => {
        setSelectedEdge(null);
        setSelectedNode(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
        if (typeof setSelectedItem === 'function') setSelectedItem(null);
    }, [onEdgeSelect, setSelectedItem]);

    // Keyboard shortcuts for both inspectors
    useEffect(() => {
        if (!selectedEdge && !selectedNode) return;

        const onKey = (e) => {
            if (e.key === 'Escape') {
                handleCloseInspector();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedEdge) deleteSelectedEdge();
                else if (selectedNode) deleteSelectedNode();
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedEdge, selectedNode, handleCloseInspector, deleteSelectedEdge, deleteSelectedNode]);

    const edgeCategories = ['None', 'Inline Valve'];

    // --------------------
    // Render
    // --------------------
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
                {/* Render AddItemButton component and forward handlers */}
                {AddItemButton && <AddItemButton addItem={addItem} setNodes={setNodes} setEdges={setEdges} setItems={setItems} />}
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
                    onNodeClick={handleNodeClick}
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
                    aria-hidden={!selectedEdge && !selectedNode}
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        height: '100%',
                        width: selectedEdge || selectedNode ? 360 : 0,
                        transform: selectedEdge || selectedNode ? 'translateX(0)' : 'translateX(100%)',
                        transition: 'width 220ms ease, transform 220ms ease',
                        background: '#fff',
                        borderLeft: selectedEdge || selectedNode ? '1px solid #ddd' : 'none',
                        boxShadow: selectedEdge || selectedNode ? '-8px 0 24px rgba(0,0,0,0.08)' : 'none',
                        overflow: 'hidden',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* EDGE INSPECTOR */}
                    {selectedEdge && (
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Edge inspector</strong>
                                <div>
                                    <button onClick={deleteSelectedEdge} style={{ marginRight: 8 }}>
                                        Delete
                                    </button>
                                    <button onClick={handleCloseInspector}>Close</button>
                                </div>
                            </div>

                            <div style={{ fontSize: 13 }}>
                                <div>
                                    <strong>ID:</strong> {selectedEdge.id}
                                </div>
                                <div>
                                    <strong>Source:</strong> {selectedEdge.source}
                                    {selectedEdge.sourceHandle ? ` (${selectedEdge.sourceHandle})` : ''}
                                </div>
                                <div>
                                    <strong>Target:</strong> {selectedEdge.target}
                                    {selectedEdge.targetHandle ? ` (${selectedEdge.targetHandle})` : ''}
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <strong>Type:</strong> {selectedEdge.type || 'default'}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Category</label>
                                <select
                                    value={selectedEdge?.data?.category || 'None'}
                                    onChange={(e) => changeEdgeCategory(e.target.value)}
                                    style={{ padding: 8, width: '100%' }}
                                >
                                    {edgeCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Type selection for Inline Valve */}
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
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="" disabled>
                                                No types defined
                                            </option>
                                        )}
                                    </select>
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', fontSize: 12, color: '#666' }}>
                                Keyboard: Esc to close · Delete to remove
                            </div>
                        </div>
                    )}

                    {/* NODE / ITEM INSPECTOR */}
                    {selectedNode && (
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Item inspector</strong>
                                <div>
                                    <button onClick={deleteSelectedNode} style={{ marginRight: 8 }}>
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedNode(null);
                                            if (typeof setSelectedItem === 'function') setSelectedItem(null);
                                        }}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            {/* Basic item info */}
                            <div style={{ fontSize: 13 }}>
                                <div>
                                    <strong>ID:</strong> {selectedNode.id}
                                </div>
                                <div>
                                    <strong>Label:</strong> {selectedNode.data?.label}
                                </div>
                                <div>
                                    <strong>Category:</strong> {selectedNode.data?.item?.Category}
                                </div>
                            </div>

                            {/* Editable Name field */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Name</label>
                                <input
                                    type="text"
                                    value={selectedNode.data?.item?.Name || ''}
                                    onChange={(e) => {
                                        const newName = e.target.value;
                                        // patch node data
                                        updateSelectedNode({
                                            data: { ...(selectedNode.data || {}), item: { ...(selectedNode.data?.item || {}), Name: newName } },
                                        });
                                    }}
                                    style={{ padding: 6, width: '100%' }}
                                />
                            </div>

                            {/* Editable Code field */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Item Code</label>
                                <input
                                    type="text"
                                    value={selectedNode.data?.item?.['Item Code'] || selectedNode.data?.item?.Code || ''}
                                    onChange={(e) => {
                                        const newCode = e.target.value;
                                        updateSelectedNode({
                                            data: { ...(selectedNode.data || {}), item: { ...(selectedNode.data?.item || {}), 'Item Code': newCode, Code: newCode } },
                                        });
                                    }}
                                    style={{ padding: 6, width: '100%' }}
                                />
                            </div>

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
