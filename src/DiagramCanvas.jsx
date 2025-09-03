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
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onEdgeClick,
    onEdgeSelect,
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

    const handleEdgeClick = (event, edge) => {
        event?.stopPropagation?.();
        const liveEdge = edges?.find((e) => e.id === edge.id) || edge;
        setSelectedEdge(liveEdge);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(liveEdge);
        if (typeof onEdgeClick === 'function') onEdgeClick(event, liveEdge);
    };

    const updateSelectedEdge = (patch) => {
        if (!selectedEdge || typeof setEdges !== 'function') return;
        setEdges((prev) =>
            prev.map((e) => (e.id === selectedEdge.id ? { ...e, ...patch } : e))
        );
        setSelectedEdge((s) => (s ? { ...s, ...patch } : s));
    };

    const deleteSelectedEdge = () => {
        if (!selectedEdge || typeof setEdges !== 'function') return;
        if (!window.confirm('Delete this edge?')) return;
        setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
        handleCloseInspector();
    };

    const toggleEdgeAnimated = () => updateSelectedEdge({ animated: !selectedEdge?.animated });
    const changeEdgeLabel = (label) => updateSelectedEdge({ label });

    const changeEdgeColor = (color) => {
        const newStyle = { ...(selectedEdge?.style || {}), stroke: color };
        updateSelectedEdge({ style: newStyle });
    };

    const changeEdgeCategory = (category) => {
        if (!selectedEdge || category !== "Inline Valve") return;

        const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
        const targetNode = nodes.find((n) => n.id === selectedEdge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        // Must match ItemDetailCard schema
        const newItem = {
            id: `valve-${Date.now()}`,
            "Item Code": "VALVE001",
            Name: "Inline Valve",
            Category: "Inline Valve",
            "Category Item Type": "Inline Valve",
            Type: [],         // keep as array, not string
            Unit: sourceNode.data?.item?.Unit || "",
            SubUnit: sourceNode.data?.item?.SubUnit || "",
            x: midX,
            y: midY,
        };

        const newNode = {
            id: newItem.id,
            position: { x: midX, y: midY },
            data: {
                label: `${newItem["Item Code"]} - ${newItem.Name}`,
                item: newItem,
                icon: getItemIcon(newItem), // important for SVG rendering
            },
            type: "scalableIcon",
            sourcePosition: "right",
            targetPosition: "left",
            style: { background: "transparent" },
        };

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [
            ...eds.filter((e) => e.id !== selectedEdge.id),
            {
                id: `${selectedEdge.source}-${newNode.id}`,
                source: selectedEdge.source,
                target: newNode.id,
                style: { stroke: selectedEdge?.style?.stroke || "#000" },
            },
            {
                id: `${newNode.id}-${selectedEdge.target}`,
                source: newNode.id,
                target: selectedEdge.target,
                style: { stroke: selectedEdge?.style?.stroke || "#000" },
            },
        ]);
    };


    const handleCloseInspector = () => {
        setSelectedEdge(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
    };

    useEffect(() => {
        if (!selectedEdge) return;
        const onKey = (e) => {
            if (e.key === 'Escape') handleCloseInspector();
            else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelectedEdge();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedEdge]);

    const colorPresets = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
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
                {AddItemButton && <AddItemButton setNodes={setNodes} setEdges={setEdges} />}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Edge inspector</strong>
                                <div>
                                    <button onClick={deleteSelectedEdge} style={{ marginRight: 8 }}>Delete</button>
                                    <button onClick={handleCloseInspector}>Close</button>
                                </div>
                            </div>

                            <div style={{ fontSize: 13 }}>
                                <div><strong>ID:</strong> {selectedEdge.id}</div>
                                <div><strong>Source:</strong> {selectedEdge.source}{selectedEdge.sourceHandle ? ` (${selectedEdge.sourceHandle})` : ''}</div>
                                <div><strong>Target:</strong> {selectedEdge.target}{selectedEdge.targetHandle ? ` (${selectedEdge.targetHandle})` : ''}</div>
                                <div style={{ marginTop: 8 }}><strong>Type:</strong> {selectedEdge.type || 'default'}</div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Label</label>
                                <input
                                    value={selectedEdge.label || ''}
                                    onChange={(e) => changeEdgeLabel(e.target.value)}
                                    style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
                                />
                            </div>

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

                            <div>
                                <label style={{ display: 'block', fontSize: 12 }}>Color</label>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={selectedEdge?.style?.stroke || '#000000'}
                                        onChange={(e) => changeEdgeColor(e.target.value)}
                                        style={{ width: 40, height: 32, padding: 0, border: 'none', background: 'transparent' }}
                                    />
                                    <input
                                        type="text"
                                        value={selectedEdge?.style?.stroke || ''}
                                        onChange={(e) => changeEdgeColor(e.target.value)}
                                        style={{ padding: 8, width: 110 }}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                                        {colorPresets.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => changeEdgeColor(c)}
                                                title={c}
                                                style={{ width: 28, height: 28, background: c, border: '1px solid #ddd', borderRadius: 4 }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={toggleEdgeAnimated}>
                                    {selectedEdge.animated ? 'Disable animation' : 'Enable animation'}
                                </button>
                                <button onClick={() => updateSelectedEdge({ style: { ...(selectedEdge.style || {}), strokeWidth: (selectedEdge.style?.strokeWidth || 2) + 2 } })}>
                                    Thicken
                                </button>
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
