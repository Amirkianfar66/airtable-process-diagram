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
    currentView = 'canvas', 
    onSwitchView = () => { },
    onUnitLayoutChange = () => { },
}) {
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [valveTypeOptions, setValveTypeOptions] = useState([]);
    const panelRef = useRef(null);
    const [view, setView] = useState('2d');
    // --- Canvas annotate state ---
    const [annoActive, setAnnoActive] = useState(false);
    const [annoTool, setAnnoTool] = useState('note'); // 'move' | 'line' | 'rect' | 'circle' | 'note'
    const [annoColor, setAnnoColor] = useState('#222');
    const [annoWidth, setAnnoWidth] = useState(2);

    const [annotations, setAnnotations] = useState([]); // [{type, ...}]
    const [annoDraft, setAnnoDraft] = useState(null);   // live drawing object
    const [annoSelected, setAnnoSelected] = useState(null); // selected index (for Move/Note edit)
    const annoMoveRef = useRef(null);  // { index, start:{x,y}, original:<shape> }
    const svgAnnoRef = useRef(null);

    // disable right-mouse panning while annotating
    useEffect(() => {
        window.rfDisableRightPan?.(annoActive);
        return () => window.rfDisableRightPan?.(false);
    }, [annoActive]);

    // prevent nodes from being dragged while annotating (optional but nice)
    useEffect(() => {
        if (!setNodes) return;
        setNodes(nds => nds.map(n => ({ ...n, draggable: !annoActive })));
    }, [annoActive, setNodes]);

    // convert pointer to local SVG coords
    function svgPointFromEvent(evt, svgEl) {
        const pt = svgEl.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const ctm = svgEl.getScreenCTM();
        return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    }

    // --- hit-test helpers for Move tool ---
    function pointToSegmentDist(px, py, x1, y1, x2, y2) {
        const vx = x2 - x1, vy = y2 - y1;
        const wx = px - x1, wy = py - y1;
        const c1 = wx * vx + wy * vy;
        if (c1 <= 0) return Math.hypot(px - x1, py - y1);
        const c2 = vx * vx + vy * vy;
        if (c2 <= c1) return Math.hypot(px - x2, py - y2);
        const b = c1 / c2;
        const bx = x1 + b * vx, by = y1 + b * vy;
        return Math.hypot(px - bx, py - by);
    }

    function hitTestIndex(p, list, tol = 6) {
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            if (o.type === 'rect') {
                if (p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h) return i;
            } else if (o.type === 'circle') {
                const dx = p.x - o.cx, dy = p.y - o.cy;
                if (dx * dx + dy * dy <= (o.r + tol) * (o.r + tol)) return i;
            } else if (o.type === 'line') {
                if (pointToSegmentDist(p.x, p.y, o.x1, o.y1, o.x2, o.y2) <= tol) return i;
            } else if (o.type === 'note') {
                // treat note as a rect for hit-test
                const w = o.w ?? 120, h = o.h ?? 60;
                if (p.x >= o.x && p.x <= o.x + w && p.y >= o.y && p.y <= o.y + h) return i;
            }
        }
        return -1;
    }

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
    // 🚫 disable right-mouse panning when true
    const [disableRightPan, setDisableRightPan] = useState(false);

    useEffect(() => {
        // global setter any node can call
        window.rfDisableRightPan = (v) => setDisableRightPan(!!v);

        // optional custom event bus
        const onEvt = (e) => setDisableRightPan(!!e.detail?.disabled);
        window.addEventListener('rf:disableRightPan', onEvt);

        return () => {
            delete window.rfDisableRightPan;
            window.removeEventListener('rf:disableRightPan', onEvt);
        };
    }, []);

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

    const onAnnoDown = (e) => {
        if (!annoActive || !svgAnnoRef.current) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        try { svgAnnoRef.current.setPointerCapture(e.pointerId); } catch { }

        const p = svgPointFromEvent(e, svgAnnoRef.current);

        if (annoTool === 'move') {
            const idx = hitTestIndex(p, annotations, 6);
            setAnnoSelected(idx >= 0 ? idx : null);
            if (idx >= 0) {
                annoMoveRef.current = { index: idx, start: p, original: { ...annotations[idx] } };
            } else {
                annoMoveRef.current = null;
            }
            return;
        }

        if (annoTool === 'line') {
            setAnnoDraft({ type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: annoColor, strokeWidth: annoWidth });
        } else if (annoTool === 'rect') {
            setAnnoDraft({ type: 'rect', x: p.x, y: p.y, w: 0, h: 0, stroke: annoColor, strokeWidth: annoWidth, fill: 'none' });
        } else if (annoTool === 'circle') {
            setAnnoDraft({ type: 'circle', cx: p.x, cy: p.y, r: 0, stroke: annoColor, strokeWidth: annoWidth, fill: 'none' });
        } else if (annoTool === 'note') {
            // create a note immediately; allow moving afterward with Move tool or drag end
            const note = { type: 'note', x: p.x, y: p.y, w: 140, h: 70, text: 'Note', stroke: '#888', fill: '#fff8c6', strokeWidth: 1.5 };
            setAnnotations(prev => [...prev, note]);
            setAnnoSelected(prev => (prev != null ? prev : annotations.length)); // select it
        }
    };

    const onAnnoMove = (e) => {
        if (!annoActive || !svgAnnoRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const p = svgPointFromEvent(e, svgAnnoRef.current);

        // moving existing
        if (annoTool === 'move' && annoMoveRef.current) {
            const { index, start, original } = annoMoveRef.current;
            const dx = p.x - start.x, dy = p.y - start.y;
            const moved =
                original.type === 'rect' ? { ...original, x: original.x + dx, y: original.y + dy } :
                    original.type === 'circle' ? { ...original, cx: original.cx + dx, cy: original.cy + dy } :
                        original.type === 'line' ? { ...original, x1: original.x1 + dx, y1: original.y1 + dy, x2: original.x2 + dx, y2: original.y2 + dy } :
                            original.type === 'note' ? { ...original, x: original.x + dx, y: original.y + dy } :
                                original;

            setAnnotations(prev => prev.map((s, i) => (i === index ? moved : s)));
            return;
        }

        // live draft
        if (!annoDraft) return;
        setAnnoDraft(d => {
            if (!d) return d;
            if (d.type === 'line') return { ...d, x2: p.x, y2: p.y };
            if (d.type === 'rect') return { ...d, w: Math.max(0, p.x - d.x), h: Math.max(0, p.y - d.y) };
            if (d.type === 'circle') return { ...d, r: Math.hypot(p.x - d.cx, p.y - d.cy) };
            return d;
        });
    };

    const onAnnoUp = (e) => {
        if (!annoActive) return;
        e.preventDefault();
        e.stopPropagation();
        try { svgAnnoRef.current?.releasePointerCapture?.(e.pointerId); } catch { }

        if (annoTool === 'move' && annoMoveRef.current) {
            annoMoveRef.current = null;
            // persist whole list (no-op if you later add autosave)
            setAnnotations(prev => [...prev]);
            return;
        }

        if (!annoDraft) return;
        const fin = annoDraft;
        setAnnoDraft(null);
        setAnnotations(prev => [...prev, fin]);
    };

    // double-click to edit note text when selected + move tool
    const onAnnoDoubleClick = (e) => {
        if (!annoActive || annoTool !== 'move' || annoSelected == null) return;
        const cur = annotations[annoSelected];
        if (!cur || cur.type !== 'note') return;
        e.preventDefault(); e.stopPropagation();
        const nextText = prompt('Edit note text:', cur.text || 'Note');
        if (nextText != null) {
            setAnnotations(prev => prev.map((s, i) => (i === annoSelected ? { ...s, text: nextText } : s)));
        }
    };
    // Expose simple controls for external toolbars (AddItemButton)
    useEffect(() => {
        window.annoControls = {
            setActive: setAnnoActive,
            setTool: setAnnoTool,
            setWidth: setAnnoWidth,
            setColor: setAnnoColor,
            undo: () => setAnnotations(prev => prev.slice(0, -1)),
            clear: () => setAnnotations([]),
            deleteSelected: () => {
                if (annoSelected == null) return;
                setAnnotations(prev => prev.filter((_, i) => i !== annoSelected));
                setAnnoSelected(null);
            },
            // optional readback for initial sync
            getState: () => ({
                active: annoActive,
                tool: annoTool,
                color: annoColor,
                width: annoWidth,
                selected: annoSelected,
                count: annotations.length,
            }),
        };
        return () => { delete window.annoControls; };
    }, [annoActive, annoTool, annoColor, annoWidth, annoSelected, annotations.length]);


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
                currentView={currentView}      
                onSwitchView={onSwitchView}   
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
                                // mirror RF behavior: select in sidebar
                                onSelectionChange?.({ nodes: n ? [n] : [], edges: [] });
                            }}
                            onMoveNode={(id, pos2D) => {
                                // pos2D is { x, y } in React Flow coords
                                setNodes((prev) =>
                                    prev.map((n) =>
                                        String(n.id) === String(id)
                                            ? { ...n, position: { x: pos2D.x, y: pos2D.y } }
                                            : n
                                    )
                                );
                                // (optional) also update selection to the moved node
                                const moved = (Array.isArray(nodes) ? nodes : []).find(
                                    (nn) => String(nn.id) === String(id)
                                );
                                onSelectionChange?.({ nodes: moved ? [moved] : [], edges: [] });
                            }}
                            selectedNodeId={selectedNodes?.[0]?.id}         // show pivot panel for selected node
                            onSetNodePivot={(id, pivot) => {                // persist pivot on the node
                                setNodes((ns) =>
                                    ns.map((n) =>
                                        String(n.id) === String(id)
                                            ? { ...n, data: { ...n.data, pivot } }
                                            : n
                                    )
                                );
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
                            panOnDrag={disableRightPan ? [0, 1] : true}   // allow left+middle; block right when editing
                            zoomOnScroll={true}
                            zoomOnPinch={true}
                            style={{ width: '100%', height: '100%', background: 'transparent' }}

                        >
                            <Background />
                            <Controls />
                            {/* === Canvas annotation overlay === */}
                                <svg
                                    ref={svgAnnoRef}
                                    width="100%"
                                    height="100%"
                                    viewBox={`0 0 2000 1200`}             // generous virtual space; or compute from bounds
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        pointerEvents: annoActive ? 'all' : 'none',
                                        cursor: annoActive ? (annoTool === 'move' ? 'grab' : 'crosshair') : 'default'
                                    }}
                                    onPointerDown={onAnnoDown}
                                    onPointerMove={onAnnoMove}
                                    onPointerUp={onAnnoUp}
                                    onPointerCancel={onAnnoUp}
                                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDoubleClick={onAnnoDoubleClick}
                                >
                                    {/* highlight selected shape */}
                                    {annoSelected != null && annotations[annoSelected] && (() => {
                                        const s = annotations[annoSelected];
                                        const dash = { strokeDasharray: '4 3', strokeWidth: (s.strokeWidth || 2) + 1.2, stroke: '#444', fill: 'none' };
                                        if (s.type === 'line') return <line   {...dash} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
                                        if (s.type === 'rect') return <rect   {...dash} x={s.x} y={s.y} width={s.w} height={s.h} />;
                                        if (s.type === 'circle') return <circle {...dash} cx={s.cx} cy={s.cy} r={s.r} />;
                                        if (s.type === 'note') return <rect   {...dash} x={s.x} y={s.y} width={s.w ?? 140} height={s.h ?? 70} />;
                                        return null;
                                    })()}

                                    {/* committed annotations */}
                                    {annotations.map((o, i) => {
                                        const stroke = o.stroke ?? '#222';
                                        const w = o.strokeWidth ?? 2;
                                        if (o.type === 'line') return <line key={i} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke={stroke} strokeWidth={w} />;
                                        if (o.type === 'rect') return <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} stroke={stroke} strokeWidth={w} fill={o.fill ?? 'none'} />;
                                        if (o.type === 'circle') return <circle key={i} cx={o.cx} cy={o.cy} r={o.r} stroke={stroke} strokeWidth={w} fill={o.fill ?? 'none'} />;
                                        if (o.type === 'note') {
                                            const bw = 1.5, pad = 6, noteW = o.w ?? 140, noteH = o.h ?? 70;
                                            return (
                                                <g key={i}>
                                                    <rect x={o.x} y={o.y} width={noteW} height={noteH} rx={6} ry={6} fill={o.fill ?? '#fff8c6'} stroke={o.stroke ?? '#888'} strokeWidth={o.strokeWidth ?? bw} />
                                                    <text x={o.x + pad} y={o.y + 20} style={{ fontSize: 12, fill: '#222' }}>{o.text || 'Note'}</text>
                                                </g>
                                            );
                                        }
                                        return null;
                                    })}

                                    {/* live draft preview */}
                                    {annoDraft?.type === 'line' && <line x1={annoDraft.x1} y1={annoDraft.y1} x2={annoDraft.x2} y2={annoDraft.y2} stroke={annoDraft.stroke || annoColor} strokeWidth={annoDraft.strokeWidth ?? annoWidth} />}
                                    {annoDraft?.type === 'rect' && <rect x={annoDraft.x} y={annoDraft.y} width={annoDraft.w} height={annoDraft.h} stroke={annoDraft.stroke || annoColor} strokeWidth={annoDraft.strokeWidth ?? annoWidth} fill="none" />}
                                    {annoDraft?.type === 'circle' && <circle cx={annoDraft.cx} cy={annoDraft.cy} r={annoDraft.r || 0} stroke={annoDraft.stroke || annoColor} strokeWidth={annoDraft.strokeWidth ?? annoWidth} fill="none" />}
                                </svg>

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
