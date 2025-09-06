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
    availableUnits = [],
    onUnitLayoutChange = () => { },
}) {
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [valveTypeOptions, setValveTypeOptions] = useState([]);
    const panelRef = useRef(null);

    useEffect(() => {
        console.log('DiagramCanvas prop onEdgeClick:', onEdgeClick);
    }, [onEdgeClick]);

    // Fetch Inline Valve types from Airtable (same envs you use in ItemDetailCard)
    useEffect(() => {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const valveTypesTableId = import.meta.env.VITE_AIRTABLE_ValveTYPES_TABLE_ID;
        if (!baseId || !token || !valveTypesTableId) return;

        let alive = true;
        (async () => {
            try {
                const res = await fetch(`https://api.airtable.com/v0/${baseId}/${valveTypesTableId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                const opts = (data.records || [])
                    .map(r => r?.fields?.['Still Pipe'] || r?.fields?.['Name'] || '')
                    .filter(Boolean);
                if (alive) setValveTypeOptions(opts);
            } catch (err) {
                console.error('Failed to load valve types', err);
            }
        })();
        return () => { alive = false; };
    }, []);

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

    // Store category on the edge, and (optionally) clear inline valve type if switching to None
    const changeEdgeCategory = (category) => {
        if (!selectedEdge) return;
        const prevData = selectedEdge.data || {};
        const newData = { ...prevData };

        if (category === 'Inline Valve') {
            newData.category = 'Inline Valve';
        } else {
            delete newData.category;
            delete newData.inlineValveType;
        }
        updateSelectedEdge({ data: newData });

        // NOTE: We are NOT auto-splitting the edge anymore so you can first set the type.
        // If you want to keep your original auto-split behavior, call createInlineValveNode() here.
    };

    // Your original auto-split logic factored into a helper, callable by a button:
    const createInlineValveNode = () => {
        if (!selectedEdge) return;
        const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
        const targetNode = nodes.find((n) => n.id === selectedEdge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;
        const inlineType = selectedEdge?.data?.inlineValveType || '';
        const newItem = {
            id: `valve-${Date.now()}`,
            "Item Code": "VALVE001",
            Name: "Inline Valve",
            Category: "Inline Valve",
            "Category Item Type": "Inline Valve",
            Type: inlineType || '',
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

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [
            ...eds.filter((e) => e.id !== selectedEdge.id),
            {
                id: `${selectedEdge.source}-${newNode.id}`,
                source: selectedEdge.source,
                target: newNode.id,
                type: 'step',
                style: { stroke: selectedEdge?.style?.stroke || "#000" },
            },
            {
                id: `${newNode.id}-${selectedEdge.target}`,
                source: newNode.id,
                target: targetNode.id,
                type: 'step',
                style: { stroke: selectedEdge?.style?.stroke || "#000" },
            },
        ]);
        // After splitting, close inspector (the original edge is gone).
        handleCloseInspector();
    };

    const handleCloseInspector = () => {
        setSelectedEdge(null);
        if (typeof onEdgeSelect === 'function') onEdgeSelect(null);
    };

    // Keep only ESC handling here; Delete is handled by the global keyboard handler below.
    useEffect(() => {
        if (!selectedEdge) return;
        const onKey = (e) => {
            if (e.key === 'Escape') handleCloseInspector();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedEdge]);

    // GLOBAL keyboard handler: Delete/Backspace removes selected nodes (and edges)
    useEffect(() => {
        const isTyping = (el) => {
            const tag = el?.tagName?.toLowerCase();
            return tag === 'input' || tag === 'textarea' || el?.isContentEditable;
        };

        const onKey = (e) => {
            if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Escape') return;

            if (e.key === 'Escape') {
                handleCloseInspector();
                return;
            }

            // DELETE/BACKSPACE:
            if (isTyping(e.target)) return; // ignore when typing
            e.preventDefault();
            e.stopPropagation();

            // If an edge inspector is open, Delete removes the edge
            if (selectedEdge) {
                deleteSelectedEdge();
                return;
            }

            // Otherwise, delete selected node(s)
            let sel = Array.isArray(selectedNodes) ? selectedNodes : [];
            if (!sel.length) {
                // fallback: infer from nodes with .selected = true
                sel = (Array.isArray(nodes) ? nodes : []).filter(n => n?.selected);
            }
            if (!sel.length) return;

            const names = sel.map(n => n?.data?.item?.Name || n?.id).join(', ');
            if (!window.confirm(`Delete selected item(s): ${names}? This also removes connected edges.`)) return;

            const ids = new Set(sel.map(n => n.id));
            setNodes(prev => prev.filter(n => !ids.has(n.id)));
            setEdges(prev => prev.filter(ed => !ids.has(ed.source) && !ids.has(ed.target)));
            setItems?.(prev => Array.isArray(prev) ? prev.filter(it => !ids.has(it.id)) : prev);
            setSelectedItem?.(null);
            onSelectionChange?.({ nodes: [], edges: [] });
        };

        window.addEventListener('keydown', onKey, { capture: true });
        return () => window.removeEventListener('keydown', onKey, { capture: true });
    }, [selectedEdge, selectedNodes, nodes, setNodes, setEdges, setItems, setSelectedItem, onSelectionChange]);

    const edgeCategories = ['None', 'Inline Valve'];

    // Keep the valve node's item.Type in sync with the edge dropdown
    const setEdgeInlineValveType = (typeValue) => {
        if (!selectedEdge) return;

        // 1) Update the edge data
        updateSelectedEdge({
            data: { ...(selectedEdge.data || {}), inlineValveType: typeValue }
        });

        // 2) If a valve node is connected to this edge, update its item.Type
        const candidateIds = [selectedEdge.source, selectedEdge.target];
        const valveNode = (Array.isArray(nodes) ? nodes : []).find(n => {
            if (!candidateIds.includes(n.id)) return false;
            const cat = n?.data?.item?.['Category Item Type'] || n?.data?.item?.Category;
            return cat === 'Inline Valve';
        });

        if (valveNode) {
            // update ReactFlow node
            setNodes(prev =>
                prev.map(n =>
                    n.id === valveNode.id
                        ? { ...n, data: { ...n.data, item: { ...n.data.item, Type: typeValue } } }
                        : n
                )
            );

            // update your items[] store if you mirror nodes there
            setItems?.(prev =>
                Array.isArray(prev)
                    ? prev.map(it => (it.id === valveNode.id ? { ...it, Type: typeValue } : it))
                    : prev
            );
        }
    };

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
                availableUnits={availableUnits}
                onUnitLayoutChange={onUnitLayoutChange}
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

                            {/* CATEGORY */}
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

                            {/* Inline Valve Type (visible only when category == Inline Valve) */}
                            {selectedEdge?.data?.category === 'Inline Valve' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Inline Valve Type</label>
                                    <select
                                        value={selectedEdge?.data?.inlineValveType || ''}
                                        onChange={(e) => setEdgeInlineValveType(e.target.value)}   // ⬅️ changed
                                        style={{ padding: 8, width: '100%' }}
                                    >
                                        <option value="">Select type...</option>
                                        {valveTypeOptions.length > 0 ? (
                                            valveTypeOptions.map((t) => (
                                                <option key={t} value={t}>{t}</option>
                                            ))
                                        ) : (
                                            <option disabled value="">No types available</option>
                                        )}
                                    </select>

                                    {/* Optional: let user insert the inline valve node after picking the type */}
                                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                        <button onClick={toggleEdgeAnimated}>
                                            {selectedEdge.animated ? 'Disable animation' : 'Enable animation'}
                                        </button>
                                        <button onClick={createInlineValveNode}>
                                            Insert Inline Valve Node
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* When category is not Inline Valve, still show animate toggle */}
                            {selectedEdge?.data?.category !== 'Inline Valve' && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={toggleEdgeAnimated}>
                                        {selectedEdge.animated ? 'Disable animation' : 'Enable animation'}
                                    </button>
                                </div>
                            )}

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
