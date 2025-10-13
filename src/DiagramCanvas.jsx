import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';


import MainToolbar from './MainToolbar';
import 'reactflow/dist/style.css';
import { ChatBox } from './AIPNIDGenerator';
import { getItemIcon, categoryTypeMap } from "./IconManager";
import ScalableIconNode from './ScalableIconNode';
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import ThreeDView from './ThreeDView';
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
    onCreateInlineValve,
    showInlineEdgeInspector = true,
    availableUnits = [],
    onUnitLayoutChange = () => { },
}) {
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [valveTypeOptions, setValveTypeOptions] = useState([]);
    const panelRef = useRef(null);
    const [view, setView] = useState('2d');

    // expose globals so your MainToolbar "3D" tab can toggle
    useEffect(() => {
        window.setCanvasView = (v) => {
             const next = v === '3d' ? '3d' : '2d';
              setView(next);
              window.dispatchEvent(new CustomEvent("canvas:view", { detail: { view: next } }));
        };
        window.open3DView = () => setView('3d');
        window.open2DView = () => setView('2d');
        return () => {
            delete window.setCanvasView;
            delete window.open3DView;
            delete window.open2DView;
        };
    }, []);

    useEffect(() => {
        console.log('DiagramCanvas prop onEdgeClick:', onEdgeClick);
    }, [onEdgeClick]);

    // Fetch Inline Valve types from Airtable (same envs you use in ItemDetailCard)
    useEffect(() => {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const valveTypesTableId = import.meta.env.VITE_AIRTABLE_VALVE_TYPES_TABLE_ID;
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

    // --- Insert inline valve on the selected edge, replace the direct edge, and persist to items ---
    // --- Insert inline valve on the selected edge, replace the direct edge(s), and persist to items ---
    const createInlineValveNode = () => {
        if (!selectedEdge) return;

        const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
        const targetNode = nodes.find((n) => n.id === selectedEdge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;
        const inlineType = selectedEdge?.data?.inlineValveType || '';

        const uid = `valve-${Date.now()}`;
        const code = `VAL-${Date.now()}`;

        const newItem = {
            id: uid,
            Code: code,
            "Item Code": code,
            Name: "Inline Valve",
            Category: "Inline Valve",
            "Category Item Type": "Inline Valve",
            Type: inlineType || '',
            Unit: sourceNode?.data?.item?.Unit || 'No Unit',
            SubUnit: sourceNode?.data?.item?.SubUnit || 'Default SubUnit',
            x: midX,
            y: midY,
            edgeId: selectedEdge.id,
        };

        const newNode = {
            id: uid,
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

        // 1) Visual: add valve node and remove BOTH directions of the direct edge
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => {
            const stroke = selectedEdge?.style?.stroke || "#000";
            const filtered = (eds || []).filter(
                (e) =>
                    // remove this selected edge
                    e.id !== selectedEdge.id &&
                    // remove any other edge source->target or target->source
                    !((e.source === selectedEdge.source && e.target === selectedEdge.target) ||
                        (e.source === selectedEdge.target && e.target === selectedEdge.source))
            );
            return [
                ...filtered,
                { id: `${selectedEdge.source}-${uid}`, source: selectedEdge.source, target: uid, type: 'step', style: { stroke } },
                { id: `${uid}-${selectedEdge.target}`, source: uid, target: selectedEdge.target, type: 'step', style: { stroke } },
            ];
        });

        // 2) Persist: update items so buildDiagram() cannot recreate a direct gray edge
        setItems?.((prev) => {
            const arr = Array.isArray(prev) ? [...prev] : [];

            const srcIdx = arr.findIndex((it) => String(it.id) === String(selectedEdge.source));
            const dstIdx = arr.findIndex((it) => String(it.id) === String(selectedEdge.target));

            const srcCode = arr[srcIdx]?.Code || arr[srcIdx]?.['Item Code'] || '';
            const srcName = arr[srcIdx]?.Name || '';
            const dstCode = arr[dstIdx]?.Code || arr[dstIdx]?.['Item Code'] || '';
            const dstName = arr[dstIdx]?.Name || '';

            // Insert valve (valve -> dst)
            if (!arr.some((it) => String(it.id) === String(uid))) {
                arr.push({ ...newItem, Connections: dstCode ? [dstCode] : [] });
            }

            // Helper: robust, case-insensitive removal of direct refs to a target (by code, name, {to}, {toId})
            const norm = (s) => String(s || '').trim().toLowerCase();
            const removeRefTo = (list = [], targetId, targetCode, targetName) =>
                list.filter((c) => {
                    if (typeof c === 'string') {
                        const v = norm(c);
                        return v !== norm(targetCode) && (targetName ? v !== norm(targetName) : true);
                    }
                    if (c && typeof c === 'object') {
                        if (c.to && (norm(c.to) === norm(targetName) || norm(c.to) === norm(targetCode))) return false;
                        if (c.toId && String(c.toId) === String(targetId)) return false;
                    }
                    return true;
                });

            // Replace src -> dst with src -> valve
            if (srcIdx !== -1) {
                const cur = Array.isArray(arr[srcIdx].Connections) ? arr[srcIdx].Connections : [];
                const cleaned = removeRefTo(cur, selectedEdge.target, dstCode, dstName);
                if (!cleaned.includes(code)) cleaned.push(code);
                arr[srcIdx] = { ...arr[srcIdx], Connections: cleaned };
            }

            // ALSO remove reverse link dst -> src (prevents a sneaky back edge)
            if (dstIdx !== -1) {
                const cur = Array.isArray(arr[dstIdx].Connections) ? arr[dstIdx].Connections : [];
                const cleaned = removeRefTo(cur, selectedEdge.source, srcCode, srcName);
                arr[dstIdx] = { ...arr[dstIdx], Connections: cleaned };
            }

            return arr;
        });

        // 3) Close the inspector (original edge removed)
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
    const rfInstanceRef = useRef(null);
    const firstFitDone = useRef(false);

    useEffect(() => {
        if (
            !firstFitDone.current &&
            Array.isArray(nodes) &&
            nodes.length > 0 &&
            rfInstanceRef.current
        ) {
            requestAnimationFrame(() => {
                try {
                    rfInstanceRef.current.fitView({ padding: 0.2, includeHiddenNodes: true });
                } catch { }
                firstFitDone.current = true;
            });
        }
    }, [nodes?.length]);
    // Pick edges for the 3D view (prefer enhancedEdges if present)
    const __edgesFor3D = React.useMemo(() => {
        if (typeof enhancedEdges !== "undefined" && Array.isArray(enhancedEdges)) return enhancedEdges;
        return Array.isArray(edges) ? edges : [];
    }, [enhancedEdges, edges]);


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
                {/* Full-size layer for either 2D or 3D */}
                <div style={{ position: 'absolute', inset: 0 }}>
                    {/* Canvas area: 2D (ReactFlow) or 3D */}
                    {view === '3d' ? (
                        <ThreeDView
                            nodes={Array.isArray(nodes) ? nodes : []}
                            edges={__edgesFor3D}
                            onSelectNode={(nodeId) => {
                                const n = (Array.isArray(nodes) ? nodes : []).find(
                                    (nn) => String(nn.id) === String(nodeId)
                                );
                                onMoveNode = {(id, pos2D) => {
                        // pos2D is { x, y } in your React-Flow coordinate system
                        setNodes((prev) =>
                            prev.map((n) => (String(n.id) === String(id) ? { ...n, position: pos2D } : n))
                        );
                                // bubble selection up just like RF does:
                                onSelectionChange?.({ nodes: n ? [n] : [], edges: [] });
                            }}
                        />
                    ) : (
                        <ReactFlow
                            onInit={(inst) => { rfInstanceRef.current = inst; }}
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
                            style={{ width: '100%', height: '100%', background: 'transparent' }}
                        >
                            <Background />
                            <Controls />
                        </ReactFlow>
                    )}
                </div>

                {/* Edge inspector (overlay on the right, available in both views) */}
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
                                        onChange={(e) => setEdgeInlineValveType(e.target.value)}
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

                                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                        <button onClick={toggleEdgeAnimated}>
                                            {selectedEdge.animated ? 'Disable animation' : 'Enable animation'}
                                        </button>
                                        <button
                                            onClick={() =>
                                                onCreateInlineValve ? onCreateInlineValve(selectedEdge.id) : createInlineValveNode()
                                            }>
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
