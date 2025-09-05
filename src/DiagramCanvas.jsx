// src/components/DiagramCanvas.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';
import { getItemIcon, categoryTypeMap } from './IconManager';

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
    onEdgeClick, // optional parent callback
    onEdgeSelect, // optional parent selection callback
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
    const [selectedNode, setSelectedNode] = useState(null);
    const panelRef = useRef(null);

    useEffect(() => {
        console.log('DiagramCanvas mounted / props onEdgeClick:', !!onEdgeClick);
    }, [onEdgeClick]);

    // make sure edges are clickable and wide enough to click easily
    const enhancedEdges = useMemo(() => {
        if (!Array.isArray(edges)) return [];
        return edges.map((e) => ({
            ...e,
            style: { ...(e.style || {}), pointerEvents: e.style?.pointerEvents ?? 'auto' },
            interactionWidth: e.interactionWidth ?? 20,
        }));
    }, [edges]);

    const inlineValveTypes = useMemo(() => {
        const val = categoryTypeMap?.['Inline Valve'];
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.keys(val);
        return [String(val)];
    }, [categoryTypeMap]);

    // ---------- Edge handlers ----------
    function handleEdgeClickLocal(event, edge) {
        event?.stopPropagation?.();
        console.log('edge clicked:', edge?.id);
        const liveEdge = (edges || []).find((e) => e.id === edge.id) || edge;
        setSelectedEdge(liveEdge);
        setSelectedNode(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(liveEdge);
        if (typeof onEdgeClick === 'function') onEdgeClick(event, liveEdge);
    }

    function deleteSelectedEdge() {
        if (!selectedEdge) return;
        if (!window.confirm('Delete this edge?')) return;
        setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
        setSelectedEdge(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
    }

    function updateSelectedEdge(patch) {
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
    }

    function changeEdgeCategory(category) {
        if (!selectedEdge) return;
        if (category !== 'Inline Valve') {
            updateSelectedEdge({ data: { ...(selectedEdge.data || {}), category } });
            return;
        }

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
            data: { label: `${newItem['Item Code']} - ${newItem.Name}`, item: newItem, icon: getItemIcon(newItem) },
            type: 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent' },
        };

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

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => {
            const next = [...eds.filter((e) => e.id !== selectedEdge.id), newEdgeA, newEdgeB];
            return next;
        });

        setSelectedEdge(newEdgeA);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(newEdgeA);
    }

    // ---------- Node handlers ----------
    function handleNodeClickLocal(event, node) {
        event?.stopPropagation?.();
        console.log('node clicked:', node?.id);
        const liveNode = (nodes || []).find((n) => n.id === node.id) || node;
        setSelectedNode(liveNode);
        setSelectedEdge(null);
        if (typeof setSelectedItem === 'function') setSelectedItem(liveNode?.data?.item ?? null);
    }

    function deleteSelectedNode() {
        if (!selectedNode) return;
        if (!window.confirm('Delete this item?')) return;
        setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
        setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        if (typeof setItems === 'function') {
            setItems((prev) => (Array.isArray(prev) ? prev.filter((it) => it.id !== selectedNode.id) : prev));
        }
        setSelectedNode(null);
        if (typeof setSelectedItem === 'function') setSelectedItem(null);
    }

    function updateSelectedNode(patch) {
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
        if (typeof setItems === 'function') {
            setItems((prev) => {
                if (!Array.isArray(prev)) return prev;
                return prev.map((it) => (it.id === selectedNode?.id ? { ...it, ...(patch.data?.item || {}) } : it));
            });
        }
    }

    // ----------------------
    // Selection glue (CAREFUL: do NOT aggressively clear local inspector on empty selection)
    // ----------------------
    function handleSelectionChangeLocal(selection) {
        const selNodes = Array.isArray(selection?.nodes) ? selection.nodes : [];
        const selEdges = Array.isArray(selection?.edges) ? selection.edges : [];

        // If exactly one edge selected => show edge inspector
        if (selEdges.length === 1 && selNodes.length === 0) {
            const e = selEdges[0];
            const liveEdge = (edges || []).find((ed) => ed.id === e.id) || e;
            setSelectedEdge(liveEdge);
            setSelectedNode(null);
            if (typeof onEdgeSelect === 'function') onEdgeSelect(liveEdge);
            if (typeof onSelectionChange === 'function') onSelectionChange(selection);
            return;
        }

        // If exactly one node selected => show node inspector
        if (selNodes.length === 1 && selEdges.length === 0) {
            const n = selNodes[0];
            const liveNode = (nodes || []).find((nd) => nd.id === n.id) || n;
            setSelectedNode(liveNode);
            setSelectedEdge(null);
            if (typeof setSelectedItem === 'function') setSelectedItem(liveNode?.data?.item ?? null);
            if (typeof onSelectionChange === 'function') onSelectionChange(selection);
            return;
        }

        // IMPORTANT: if selection is empty or multi-select, DO NOT clear the local inspectors.
        // Clearing here caused race conditions where selection-change blanked state before edge click.
        // We *only* forward the selection to the parent so it can react.
        if (typeof onSelectionChange === 'function') onSelectionChange(selection);
    }

    function handleCloseInspector() {
        setSelectedEdge(null);
        setSelectedNode(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
        if (typeof setSelectedItem === 'function') setSelectedItem(null);
    }

    // keyboard shortcuts (Delete, Esc)
    useEffect(() => {
        if (!selectedEdge && !selectedNode) return;
        const onKey = (e) => {
            if (e.key === 'Escape') handleCloseInspector();
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedEdge) deleteSelectedEdge();
                else if (selectedNode) deleteSelectedNode();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedEdge, selectedNode]); // small deps on purpose

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
                    onSelectionChange={handleSelectionChangeLocal}
                    onEdgeClick={handleEdgeClickLocal}
                    onNodeClick={handleNodeClickLocal}
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

                            {selectedEdge?.data?.category === 'Inline Valve' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 12 }}>Type</label>
                                    <select
                                        value={selectedEdge?.data?.Type || ''}
                                        onChange={(e) => updateSelectedEdge({ data: { ...(selectedEdge.data || {}), Type: e.target.value } })}
                                        style={{ padding: 8, width: '100%' }}
                                    >
                                        <option value=''>Select type...</option>
                                        {inlineValveTypes.length > 0 ? inlineValveTypes.map((t) => <option key={t} value={t}>{t}</option>) : <option disabled>No types</option>}
                                    </select>
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', fontSize: 12, color: '#666' }}>Keyboard: Esc to close · Delete to remove</div>
                        </div>
                    )}

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

                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Name</label>
                                <input
                                    type='text'
                                    value={selectedNode.data?.item?.Name || ''}
                                    onChange={(e) => updateSelectedNode({ data: { ...(selectedNode.data || {}), item: { ...(selectedNode.data?.item || {}), Name: e.target.value } } })}
                                    style={{ padding: 6, width: '100%' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Item Code</label>
                                <input
                                    type='text'
                                    value={selectedNode.data?.item?.['Item Code'] || selectedNode.data?.item?.Code || ''}
                                    onChange={(e) => updateSelectedNode({ data: { ...(selectedNode.data || {}), item: { ...(selectedNode.data?.item || {}), 'Item Code': e.target.value, Code: e.target.value } } })}
                                    style={{ padding: 6, width: '100%' }}
                                />
                            </div>

                            <div style={{ marginTop: 'auto', fontSize: 12, color: '#666' }}>Keyboard: Esc to close · Delete to remove</div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
