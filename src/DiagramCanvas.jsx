// DiagramCanvas.jsx (patched)
import React, { useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';
import { getItemIcon, categoryTypeMap } from "./IconManager";
import ScalableIconNode from './ScalableIconNode';
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import ItemDetailCard from './ItemDetailCard';

export default function DiagramCanvas({
    nodes,
    edges,
    setNodes,
    setEdges,
    setItems,
    setSelectedItem,
    selectedItem,         // NEW - current selected item (object)
    onItemChange,         // NEW - handler when ItemDetailCard calls onChange
    onDeleteItem,         // NEW - delete handler for items
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onEdgeClick,
    onEdgeSelect,
    onDeleteEdge,         // forward parent's edge delete
    onUpdateEdge,
    onCreateInlineValve,
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

    const deleteSelectedEdge = () => {
        if (!selectedEdge || typeof setEdges !== 'function') return;
        if (!window.confirm('Delete this edge?')) return;
        // call parent's handler if present
        if (typeof onDeleteEdge === 'function') onDeleteEdge(selectedEdge.id);
        else setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
        handleCloseInspector();
    };

    const handleEdgeClickLocal = (event, edge) => {
        event?.stopPropagation?.();
        const liveEdge = edges?.find((e) => e.id === edge.id) || edge;
        setSelectedEdge(liveEdge);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(liveEdge);
        if (typeof onEdgeClick === 'function') onEdgeClick(event, liveEdge);
    };

    const updateSelectedEdge = (patch) => {
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
    };

    const changeEdgeCategory = (category) => {
        if (!selectedEdge) return;

        if (category !== "Inline Valve") {
            updateSelectedEdge({
                data: { ...(selectedEdge.data || {}), category },
            });
            return;
        }

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

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => {
            const next = [...eds.filter((e) => e.id !== selectedEdge.id), newEdgeA, newEdgeB];
            return next;
        });

        setSelectedEdge(newEdgeA);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(newEdgeA);
    };

    const handleCloseInspector = () => {
        setSelectedEdge(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
    };

    const handleCloseItemInspector = () => {
        if (typeof setSelectedItem === 'function') setSelectedItem(null);
    };
    // add near the top of the component
    const handleNodeClickLocal = (event, node) => {
        console.log('handleNodeClickLocal:', { nodeId: node?.id, eventType: event?.type });
        // DO NOT stop propagation here — that can interfere with React Flow selection behavior
        const itemFromNode = node?.data?.item || { id: node.id, ...node.data };

        if (typeof setSelectedItem === 'function') {
            setSelectedItem(itemFromNode); // show item inspector
        }

        // close any edge inspector
        setSelectedEdge(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
    };

    useEffect(() => {
        if (!selectedEdge && !selectedItem) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (selectedEdge) handleCloseInspector();
                else handleCloseItemInspector();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedEdge) deleteSelectedEdge();
                else if (selectedItem) {
                    if (!window.confirm(`Delete item "${selectedItem?.Name || selectedItem?.id}"?`)) return;
                    if (typeof onDeleteItem === 'function') onDeleteItem(selectedItem.id);
                    // fallback local deletes if parent didn't provide handler:
                    else {
                        setNodes((nds) => nds.filter(n => n.id !== selectedItem.id));
                        setEdges((eds) => eds.filter(e => e.source !== selectedItem.id && e.target !== selectedItem.id));
                        setItems((its) => (Array.isArray(its) ? its.filter(it => it.id !== selectedItem.id) : its));
                        if (typeof setSelectedItem === 'function') setSelectedItem(null);
                    }
                    handleCloseItemInspector();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedEdge, selectedItem, onDeleteItem, setSelectedItem, setNodes, setEdges, setItems]);

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

                {/* Inspector aside: shows edge inspector if selectedEdge, otherwise item inspector when selectedItem */}
                <aside
                    ref={panelRef}
                    aria-hidden={!selectedEdge && !selectedItem}
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        height: '100%',
                        width: (selectedEdge || selectedItem) ? 360 : 0,
                        transform: (selectedEdge || selectedItem) ? 'translateX(0)' : 'translateX(100%)',
                        transition: 'width 220ms ease, transform 220ms ease',
                        background: '#fff',
                        borderLeft: (selectedEdge || selectedItem) ? '1px solid #ddd' : 'none',
                        boxShadow: (selectedEdge || selectedItem) ? '-8px 0 24px rgba(0,0,0,0.08)' : 'none',
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

                            <div style={{ marginTop: 'auto', fontSize: 12, color: '#666' }}>
                                Keyboard: Esc to close · Delete to remove
                            </div>
                        </div>
                    )}

                    {/* Item inspector (shows when no selectedEdge and selectedItem present) */}
                    {!selectedEdge && selectedItem && (
                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Item inspector</strong>
                                <div>
                                    <button
                                        onClick={() => {
                                            if (!window.confirm(`Delete item "${selectedItem?.Name || selectedItem?.id}"?`)) return;
                                            if (typeof onDeleteItem === 'function') onDeleteItem(selectedItem.id);
                                            else {
                                                // fallback local delete
                                                setNodes((nds) => nds.filter(n => n.id !== selectedItem.id));
                                                setEdges((eds) => eds.filter(e => e.source !== selectedItem.id && e.target !== selectedItem.id));
                                                setItems((its) => (Array.isArray(its) ? its.filter(it => it.id !== selectedItem.id) : its));
                                            }
                                            handleCloseItemInspector();
                                        }}
                                        style={{ marginRight: 8 }}
                                    >
                                        Delete
                                    </button>
                                    <button onClick={handleCloseItemInspector}>Close</button>
                                </div>
                            </div>

                            <div style={{ overflowY: 'auto' }}>
                                <ItemDetailCard
                                    item={selectedItem}
                                    items={nodes?.map(n => n.data?.item).filter(Boolean) || []}
                                    edges={edges}
                                    onChange={(updatedItem, options) => {
                                        if (typeof onItemChange === 'function') onItemChange(updatedItem, options);
                                    }}
                                    onDeleteItem={(id) => {
                                        if (typeof onDeleteItem === 'function') onDeleteItem(id);
                                        else {
                                            setNodes((nds) => nds.filter(n => n.id !== id));
                                            setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
                                            setItems((its) => (Array.isArray(its) ? its.filter(it => it.id !== id) : its));
                                        }
                                        handleCloseItemInspector();
                                    }}
                                    onDeleteEdge={onDeleteEdge}
                                    onUpdateEdge={onUpdateEdge}
                                    onCreateInlineValve={onCreateInlineValve}
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
