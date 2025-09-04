import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, { useNodesState, useEdgesState, addEdge, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';
import GroupDetailCard from './GroupDetailCard';
import { getItemIcon, handleItemChangeNode, categoryTypeMap } from './IconManager';
import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import DiagramCanvas from './DiagramCanvas';
import MainToolbar from './MainToolbar';
import AddItemButton from './AddItemButton';
import { buildDiagram } from './diagramBuilder';
import UnitLayoutConfig from "./UnitLayoutConfig";

export const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
};

export const fetchData = async () => {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
    let allRecords = [];
    let offset = null;
    const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

    do {
        const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Airtable API error: ${res.status} ${res.statusText} - ${errorText}`);
        }
        const data = await res.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset;
    } while (offset);

    return allRecords.map((rec) => ({ id: rec.id, ...rec.fields }));
};

export default function ProcessDiagram() {
    const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [aiDescription, setAiDescription] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [unitLayoutOrder, setUnitLayoutOrder] = useState([]);
    const [availableUnitsForConfig, setAvailableUnitsForConfig] = useState([]);

    // keep previous items snapshot to avoid unnecessary full rebuilds
    const prevItemsRef = useRef([]);

    const updateNode = (id, newData) => {
        setNodes((nds) => nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node)));
    };

    const deleteNode = (id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    // wrap ItemDetailCard onChange so we can preserve positions unless reposition requested
    const handleItemDetailChange = useCallback((updatedItem, options = {}) => {
        // update items array first
        setItems((prev) => prev.map((it) => (String(it.id) === String(updatedItem.id) ? { ...it, ...updatedItem } : it)));

        // update nodes: preserve position unless reposition requested
        setNodes((prevNodes) =>
            prevNodes.map((node) => {
                if (String(node.id) !== String(updatedItem.id)) return node;

                const currentPos = node.position || { x: node.data?.x ?? updatedItem.x ?? 0, y: node.data?.y ?? updatedItem.y ?? 0 };

                if (options && options.reposition === true) {
                    // compute new position using your helper (fallback to currentPos)
                    try {
                        const newPos = getUnitSubunitPosition(updatedItem.Unit, updatedItem.SubUnit, prevNodes) || currentPos;
                        return { ...node, position: { x: newPos.x, y: newPos.y }, data: { ...node.data, ...updatedItem } };
                    } catch (err) {
                        return { ...node, position: currentPos, data: { ...node.data, ...updatedItem } };
                    }
                }

                // otherwise preserve position and only update data so icon/type changes without moving
                return { ...node, position: currentPos, data: { ...node.data, ...updatedItem } };
            })
        );

        // also keep selectedItem in sync if the details panel is showing this item
        setSelectedItem((cur) => (cur && String(cur.id) === String(updatedItem.id) ? { ...cur, ...updatedItem } : cur));
    }, []);

    // Replace your existing onSelectionChange with this
    const onSelectionChange = useCallback(
        ({ nodes: selNodes, edges: selEdges }) => {
            setSelectedNodes(selNodes || []);

            // --- Single node selected ---
            if (Array.isArray(selNodes) && selNodes.length === 1) {
                const selNode = selNodes[0];

                // Prefer authoritative item stored in items[] (keeps data consistent)
                const itemFromItems = items.find((it) => it.id === selNode.id);
                if (itemFromItems) {
                    setSelectedItem(itemFromItems);
                    return;
                }

                // Fallback to node.data.item (useful for newly created valve nodes)
                if (selNode?.data?.item) {
                    setSelectedItem(selNode.data.item);
                    return;
                }

                // Nothing found for this node
                setSelectedItem(null);
                return;
            }

            // --- Single edge selected: try to surface an inline valve attached to that edge ---
            if (Array.isArray(selEdges) && selEdges.length === 1) {
                const edge = selEdges[0];

                // 1) Look for valve items in items[] that reference edgeId
                const edgeValves = items.filter((it) => it.edgeId === edge.id);
                if (edgeValves.length > 0) {
                    // If multiple valves found, pick the first for now
                    setSelectedItem(edgeValves[0]);
                    return;
                }

                // 2) Fallback: maybe there's a valve node present whose data.item.edgeId === edge.id
                const valveNode = nodes.find((n) => n?.data?.item?.edgeId === edge.id);
                if (valveNode?.data?.item) {
                    setSelectedItem(valveNode.data.item);
                    return;
                }

                // nothing connected to this edge
                setSelectedItem(null);
                return;
            }

            // --- Multiple selection or nothing selected ---
            setSelectedItem(null);
        },
        [items, nodes]
    );



    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                {
                    ...params,
                    type: 'step',
                    animated: true,
                    style: { stroke: 'blue', strokeWidth: 2 },
                },
                edges
            );
            setEdges(updatedEdges);
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updatedEdges }));
        },
        [edges, nodes]
    );

    // --- NEW: when a group node is moved, shift its children by the same delta (live while dragging) ---
    const onNodeDrag = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;

        setNodes((nds) =>
            nds.map((n) => {
                if (!n?.data) return n;

                // group membership check
                const isChild =
                    (Array.isArray(draggedNode.data?.children) && draggedNode.data.children.includes(n.id)) ||
                    n.data.groupId === draggedNode.id ||
                    n.data.parentId === draggedNode.id;

                if (!isChild) return n;

                // shift children by the same delta as the group’s drag
                const deltaX = draggedNode.position.x - (draggedNode.data.prevX ?? draggedNode.position.x);
                const deltaY = draggedNode.position.y - (draggedNode.data.prevY ?? draggedNode.position.y);

                return {
                    ...n,
                    position: {
                        x: n.position.x + deltaX,
                        y: n.position.y + deltaY,
                    },
                };
            })
        );

        // update prev position for next drag tick
        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: draggedNode.position.x, prevY: draggedNode.position.y } }
                    : n
            )
        );
    }, []);

    // --- Reset prevX/prevY once drag stops ---
    const onNodeDragStop = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;
        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: undefined, prevY: undefined } }
                    : n
            )
        );
    }, []);
    // --- Add in ProcessDiagram.jsx near other callbacks ---
    const handleEdgeSelect = useCallback(
        (edge) => {
            if (!edge) {
                setSelectedItem(null);
                return;
            }

            // Try to find linked items in items[]
            const fromItem = items.find(it => it.id === edge.source) || null;
            const toItem = items.find(it => it.id === edge.target) || null;

            // Build a lightweight item-like object for ItemDetailCard
            const edgeAsItem = {
                id: edge.id,
                Name: 'Edge inspector',
                'Item Code': edge.id,
                edgeId: edge.id,
                from: fromItem?.Name ? `${fromItem.Name} (${edge.source})` : edge.source,
                to: toItem?.Name ? `${toItem.Name} (${edge.target})` : edge.target,
                // try to approximate mid position if source/target nodes have positions
                x: (fromItem?.x && toItem?.x) ? (fromItem.x + toItem.x) / 2 : undefined,
                y: (fromItem?.y && toItem?.y) ? (fromItem.y + toItem.y) / 2 : undefined,
                // keep original edge for reference (optional)
                _edge: edge,
            };

            setSelectedItem(edgeAsItem);
        },
        [items, setSelectedItem]
    );

    // Delete edge (used by ItemDetailCard delete button)
    const handleDeleteEdge = useCallback((edgeId) => {
        if (!edgeId) return;
        if (!window.confirm('Delete this edge?')) return;

        // remove edge
        setEdges((eds) => eds.filter(e => e.id !== edgeId));

        // remove any inline valve node that references this edge (if you create valve nodes with item.edgeId)
        setNodes((nds) => nds.filter(n => !(n?.data?.item?.edgeId && n.data.item.edgeId === edgeId)));

        // clear selected item if it was the edge
        setSelectedItem((cur) => (cur?.edgeId === edgeId ? null : cur));
    }, [setEdges, setNodes, setSelectedItem]);

    // update a live edge (label, style, animated, data, etc.)
    const handleUpdateEdge = useCallback((edgeId, patch) => {
        setEdges((eds) => eds.map(e => e.id === edgeId ? { ...e, ...patch } : e));

        // keep selectedItem in sync when we're inspecting an edge
        setSelectedItem((cur) => {
            if (!cur || cur.edgeId !== edgeId) return cur;
            return { ...cur, _edge: { ...cur._edge, ...patch } };
        });
    }, [setEdges, setSelectedItem]);

    // create an inline valve on an existing edge and split the edge into two
    const handleCreateInlineValve = useCallback((edgeId) => {
        const edge = edges.find(e => e.id === edgeId);
        if (!edge) return;

        // find the nodes for midpoint calculation
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        // small unique id using timestamp (no extra imports)
        const newValveId = `valve-${Date.now()}`;

        // new valve item (keeps shape similar to other items)
        const newItem = {
            id: newValveId,
            "Item Code": `VALVE-${Date.now()}`,
            Name: "Inline Valve",
            Category: "Inline Valve",
            "Category Item Type": "Inline Valve",
            Type: [],
            Unit: sourceNode?.data?.item?.Unit || "",
            SubUnit: sourceNode?.data?.item?.SubUnit || "",
            x: midX,
            y: midY,
            edgeId: edge.id, // track the parent edge
        };

        const newNode = {
            id: newItem.id,
            position: { x: midX, y: midY },
            data: {
                label: `${newItem["Item Code"]} - ${newItem.Name}`,
                item: newItem,
                icon: getItemIcon ? getItemIcon(newItem) : undefined,
            },
            type: "scalableIcon",
            sourcePosition: "right",
            targetPosition: "left",
            style: { background: "transparent" },
        };

        // insert node
        setNodes((nds) => [...nds, newNode]);

        // replace original edge with two edges going through the valve node
        const baseStyle = edge.style || {};
        setEdges((eds) => {
            const filtered = eds.filter(e => e.id !== edge.id);
            const e1 = {
                id: `edge-${edge.source}-${newNode.id}-${Date.now()}`,
                source: edge.source,
                target: newNode.id,
                type: edge.type || "smoothstep",
                animated: edge.animated ?? true,
                style: { ...baseStyle },
            };
            const e2 = {
                id: `edge-${newNode.id}-${edge.target}-${Date.now()}`,
                source: newNode.id,
                target: edge.target,
                type: edge.type || "smoothstep",
                animated: edge.animated ?? true,
                style: { ...baseStyle },
            };
            return [...filtered, e1, e2];
        });

        // add the valve to your items so ItemDetailCard and other code can find it
        setItems((prev) => [...prev, newItem]);

        // select the new valve item in the details panel
        setSelectedItem(newItem);
    }, [edges, nodes, setNodes, setEdges, setItems, setSelectedItem]);



    const handleGeneratePNID = async () => {
        if (!aiDescription) return;

        try {
            const { nodes: aiNodes, edges: aiEdges, normalizedItems } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            // Extract AI items
            const aiItems = normalizedItems || (aiNodes || []).map(n => n.data?.item).filter(Boolean);
            console.log("AI Items:", aiItems);
            aiItems.forEach(i => console.log(i.Name, i.Code, i.Connections));

            // Merge into items
            const updatedItems = [...items];
            const existingIds = new Set(updatedItems.map(i => i.id));
            aiItems.forEach(item => {
                if (item.id && !existingIds.has(item.id)) {
                    updatedItems.push(item);
                }
            });
            setItems(updatedItems);

            // Merge nodes + edges directly (instead of discarding AI edges)
            setNodes(aiNodes);
            setEdges(aiEdges);

            // Auto-select first new node
            if (aiNodes?.length) {
                const newNodesList = aiNodes.filter(n => !nodes.some(old => old.id === n.id));
                if (newNodesList.length > 0) {
                    setSelectedNodes([newNodesList[0]]);
                    setSelectedItem(newNodesList[0].data?.item || null);
                }
            }
        } catch (err) {
            console.error("AI PNID generation failed:", err);
        }
    };


    useEffect(() => {
        const loadItems = async () => {
            try {
                const itemsRaw = await fetchData();

                // Normalize fields including Connections
                const normalizedItems = itemsRaw.map(item => ({
                    id: item.id || `${item.Name}-${Date.now()}`,
                    Name: item.Name || '',
                    Code: item['Item Code'] || item.Code || '',
                    Unit: item.Unit || 'Default Unit',
                    SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
                    Category: Array.isArray(item['Category Item Type'])
                        ? item['Category Item Type'][0]
                        : item['Category Item Type'] || '',
                    Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
                    Sequence: item.Sequence || 0,
                    Connections: Array.isArray(item.Connections) ? item.Connections : [], // ✅ include connections
                }));

                // Build unique units array
                const uniqueUnits = [...new Set(normalizedItems.map(i => i.Unit))];

                // Wrap in array for buildDiagram
                const unitLayout2D = [uniqueUnits];
                setUnitLayoutOrder(unitLayout2D);

                // Build diagram nodes and edges
                const { nodes: builtNodes, edges: builtEdges } = buildDiagram(normalizedItems, unitLayout2D, { prevNodes: nodes });


                setNodes(builtNodes);
                setEdges(builtEdges);
                setItems(normalizedItems);

                // Pass units to UnitLayoutConfig
                const uniqueUnitsObjects = uniqueUnits.map(u => ({ id: u, Name: u }));
                setAvailableUnitsForConfig(uniqueUnitsObjects);

                // snapshot
                prevItemsRef.current = normalizedItems;

            } catch (err) {
                console.error('Error loading items:', err);
            }
        };

        loadItems();
    }, []);

    // rebuild diagram whenever user updates unitLayoutOrder or when items change in a layout-relevant way
    useEffect(() => {
        if (!items.length || !unitLayoutOrder.length) return;

        const prevItems = prevItemsRef.current || [];
        const prevMap = Object.fromEntries(prevItems.map(i => [String(i.id), i]));

        // decide whether we need a full rebuild: new item added, item removed, or Unit/SubUnit changed
        const needFullRebuild = items.length !== prevItems.length || items.some(i => {
            const p = prevMap[String(i.id)];
            if (!p) return true; // new item
            return p.Unit !== i.Unit || p.SubUnit !== i.SubUnit;
        });

        if (needFullRebuild) {
            const { nodes: rebuiltNodes, edges: rebuiltEdges } = buildDiagram(items, unitLayoutOrder);
            setNodes(rebuiltNodes);
            setEdges(rebuiltEdges);
        } else {
            // Otherwise merge updated item data into existing nodes so we don't reset positions
            setNodes((prevNodes) => prevNodes.map((n) => {
                const item = items.find(it => String(it.id) === String(n.id));
                if (!item) return n;
                return { ...n, data: { ...n.data, ...item } };
            }));
        }

        // snapshot for next comparison
        prevItemsRef.current = items;

    }, [unitLayoutOrder, items]);

    const itemsMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
    const selectedGroupNode =
        selectedNodes.length === 1 && selectedNodes[0]?.type === 'groupLabel' ? selectedNodes[0] : null;
    const childrenNodesForGroup = selectedGroupNode
        ? nodes.filter(n => {
            if (!n) return false;
            if (Array.isArray(selectedGroupNode.data?.children) && selectedGroupNode.data.children.includes(n.id)) return true;
            if (n.data?.groupId === selectedGroupNode.id) return true;
            if (n.data?.parentId === selectedGroupNode.id) return true;
            return false;
        })
        : [];



    // --- Group detail wiring ---
    const [addingToGroup, setAddingToGroup] = useState(null);


    const startAddItemToGroup = (groupId) => { setAddingToGroup(groupId); };

    const onAddItem = (nodeIdToAdd) => {
        if (!nodeIdToAdd) return;
        setNodes(nds => {
            const existing = nds.find(n => n.id === nodeIdToAdd);
            if (existing) {
                return nds.map(n => n.id === nodeIdToAdd ? { ...n, data: { ...n.data, groupId: selectedGroupNode?.id } } : n);
            }
            const newNode = {
                id: nodeIdToAdd,
                position: { x: 100, y: 100 },
                data: { label: nodeIdToAdd, groupId: selectedGroupNode?.id }
            };
            return [...nds, newNode];
        });
    };

    const onRemoveItem = (childId) => {
        setNodes(nds => nds.map(n => n.id === childId ? { ...n, data: { ...n.data, groupId: undefined } } : n));
    };

    const onDeleteGroup = (groupId) => {
        setNodes(nds => nds.filter(n => n.id !== groupId));
    };

    // inside ProcessDiagram.jsx
    const handleAddItem = (rawItem) => {
        setItems(prevItems => {
            const firstKnownUnit =
                Array.isArray(unitLayoutOrder) && unitLayoutOrder.length && unitLayoutOrder[0].length
                    ? unitLayoutOrder[0][0]
                    : (prevItems[0]?.Unit || 'Unit 1');

            const normalizedItem = {
                id: rawItem.id || `item-${Date.now()}`,
                Name: rawItem.Name || 'New Item',
                Code: rawItem.Code ?? rawItem['Item Code'] ?? `CODE-${Date.now()}`,
                'Item Code': rawItem['Item Code'] ?? rawItem.Code ?? '',
                // <-- default Unit is Unit 1 unless something else is present
                Unit: rawItem.Unit || selectedItem?.Unit || firstKnownUnit || 'Unit 1',
                SubUnit: rawItem.SubUnit ?? rawItem['Sub Unit'] ?? 'Default SubUnit',
                Category: Array.isArray(rawItem['Category Item Type'])
                    ? rawItem['Category Item Type'][0]
                    : (rawItem['Category Item Type'] ?? rawItem.Category ?? 'Equipment'),
                'Category Item Type': Array.isArray(rawItem['Category Item Type'])
                    ? rawItem['Category Item Type'][0]
                    : (rawItem['Category Item Type'] ?? rawItem.Category ?? 'Equipment'),
                Type: Array.isArray(rawItem.Type) ? rawItem.Type[0] : (rawItem.Type || ''),
                Sequence: rawItem.Sequence ?? 0,
                Connections: Array.isArray(rawItem.Connections) ? rawItem.Connections : [],
            };

            const nextItems = [...prevItems, normalizedItem];

            // ensure the unit exists in the layout
            const ensureUnitInLayout = (layout, unit) => {
                if (!Array.isArray(layout) || !layout.length) return [[unit]];
                const flat = new Set(layout.flat());
                if (!flat.has(unit)) {
                    const copy = layout.map(row => [...row]);
                    copy[0].push(unit); // add to first row
                    return copy;
                }
                return layout;
            };

            const currentLayout = (Array.isArray(unitLayoutOrder) && unitLayoutOrder.length) ? unitLayoutOrder : [[]];
            const patchedLayout = ensureUnitInLayout(currentLayout, normalizedItem.Unit);
            if (patchedLayout !== unitLayoutOrder) setUnitLayoutOrder(patchedLayout);

            const { nodes: rebuiltNodes, edges: rebuiltEdges } = buildDiagram(nextItems, patchedLayout);
            setNodes(rebuiltNodes);
            setEdges(rebuiltEdges);

            const addedNode = rebuiltNodes.find(n => n.id === normalizedItem.id);
            if (addedNode) setSelectedNodes([addedNode]);
            setSelectedItem(normalizedItem);

            console.log('handleAddItem added:', normalizedItem, 'rebuiltNodes contains:', !!addedNode);

            return nextItems;
        });
    };



    function getUnitSubunitPosition(unit, subUnit, nodes) {
        const unitNode = nodes.find(n => n.id === `unit-${unit}`);
        const subUnitNode = nodes.find(n => n.id === `sub-${unit}-${subUnit}`);

        if (!subUnitNode) {
            // fallback if SubUnit not found
            return { x: 100, y: 100 };
        }

        // Get all items already in this subUnit
        const siblings = nodes.filter(n =>
            n.data?.item?.Unit === unit && n.data?.item?.SubUnit === subUnit
        );

        const itemWidth = 160;
        const itemGap = 30;

        let x = subUnitNode.position.x + 40 + siblings.length * (itemWidth + itemGap);
        let y = subUnitNode.position.y + 40;

        return { x, y };
    }

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
            {/* LEFT: Diagram */}
            <div style={{ flex: 3, position: "relative", background: "transparent" }}>
                <DiagramCanvas
                    nodes={nodes}
                    edges={edges}
                    setNodes={setNodes}
                    setEdges={setEdges}
                    setItems={setItems}
                    setSelectedItem={setSelectedItem}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypes}
                    onEdgeSelect={handleEdgeSelect}           // <--- add this
                    showInlineEdgeInspector={false}           // <--- hide inline inspector
                    AddItemButton={AddItemButton}             // <--- pass component directly
                    addItem={handleAddItem}                   // <--- pass handler separately
                    aiDescription={aiDescription}
                    setAiDescription={setAiDescription}
                    handleGeneratePNID={handleGeneratePNID}
                    chatMessages={chatMessages}
                    setChatMessages={setChatMessages}
                    selectedNodes={selectedNodes}
                    updateNode={updateNode}
                    deleteNode={deleteNode}
                    ChatBox={ChatBox}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                />

            </div>

            {/* RIGHT: Sidebar */}
            <div
                style={{
                    flex: 1,
                    borderLeft: "1px solid #ccc",
                    display: "flex",
                    flexDirection: "column",
                    background: "transparent",
                }}
            >

                <div>
                    <UnitLayoutConfig
                        availableUnits={availableUnitsForConfig}
                        onChange={setUnitLayoutOrder}
                    />
                </div>
                {/* detail panel */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {selectedGroupNode ? (
                        <GroupDetailCard
                            node={selectedGroupNode}
                            childrenNodes={childrenNodesForGroup}
                            childrenLabels={selectedGroupNode?.data?.children}
                            allItems={itemsMap}
                            startAddItemToGroup={startAddItemToGroup}
                            onAddItem={onAddItem}
                            onRemoveItem={onRemoveItem}
                            onDelete={onDeleteGroup}
                        />
                    ) : selectedItem ? (
                        <ItemDetailCard
                            item={selectedItem}
                            items={items}
                            edges={edges}
                            onChange={handleItemDetailChange} // <-- use wrapper that preserves positions
                            onDeleteEdge={handleDeleteEdge}
                            onUpdateEdge={handleUpdateEdge}
                            onCreateInlineValve={handleCreateInlineValve}
                        />
                    ) : (
                        <div style={{ padding: 20, color: "#888" }}>
                            Select an item or group to see details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

}
