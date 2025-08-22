import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard, { GroupDetailCard } from './ItemDetailCard';
import { getItemIcon, AddItemButton, handleItemChangeNode, categoryTypeMap } from './IconManager';

import AIPNIDGenerator, { ChatBox } from './AIPNIDGenerator';
import MainToolbar from './MainToolbar';

const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode, // simple
};



const fetchData = async () => {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
    let allRecords = [];
    let offset = null;
    const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

    do {
        const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
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
    const [nodes, setNodes, _onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [aiDescription, setAiDescription] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [groupSelectionMode, setGroupSelectionMode] = useState(null);


    const createGroupFromSelectedNodes = () => {
        if (selectedNodes.length === 0) {
            alert("Select some nodes first to create a group.");
            return;
        }

        const selectedIds = selectedNodes.map(sn => sn.id);
        // Build human-readable labels for display inside the group
        const childLabels = selectedIds.map(id => {
            const full = nodes.find(n => n.id === id);
            return full?.data?.label ?? id;
        });

        const groupId = `group-${Date.now()}`;
        const newGroupNode = {
            id: groupId,
            type: 'groupLabel',
            position: { x: 100, y: 100 },
            data: {
                label: 'New Group',
                isGroup: true,
                // store both ids and labels so UI components can choose what they need
                childIds: selectedIds,
                children: childLabels,
            },
        };

        // update nodes atomically using setNodes callback (safer)
        setNodes((prevNodes) => {
            const updated = prevNodes.map(n =>
                selectedIds.includes(n.id)
                    ? { ...n, data: { ...n.data, groupId } }
                    : n
            );
            return [...updated, newGroupNode];
        });

        // show group in right panel immediately
        setSelectedGroup({ ...newGroupNode, data: { ...newGroupNode.data } });

        // clear selection
        setSelectedNodes([]);
    };



    const startAddItemToGroup = (groupId) => {
        alert("Click on a node to add it to this group");
        setGroupSelectionMode(groupId);
    };


    const updateNode = (id, newData) => {
        setNodes(nds =>
            nds.map(node => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node))
        );
    };
    // add near other state declarations
    const [selectedGroup, setSelectedGroup] = useState(null);

    /** helper to update group node's label/rect/position */
    const updateGroupNode = (id, update) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id !== id) return n;
                const newPosition = update.position ?? n.position;
                const newData = {
                    ...n.data,
                    rect: update.rect ?? n.data?.rect,
                    label: update.label ?? n.data?.label,
                };
                return { ...n, position: newPosition, data: newData };
            })
        );
    };

    const deleteNode = (id) => {
        setNodes(nds => nds.filter(node => node.id !== id));
        setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
    };
    

    const onSelectionChange = useCallback(
        ({ nodes: rfSelectedNodes }) => {
            // If we're in "add to group" mode, clicking a node should add it to the group.
            if (groupSelectionMode && Array.isArray(rfSelectedNodes) && rfSelectedNodes.length === 1) {
                const targetId = rfSelectedNodes[0].id;
                const groupId = groupSelectionMode;

                // don't add the group node to itself
                if (targetId !== groupId) {
                    setNodes((nds) => {
                        // 1) set groupId on the target node
                        const updated = nds.map(n => n.id === targetId ? { ...n, data: { ...n.data, groupId } } : n);

                        // 2) update the group node's childIds/children
                        const newNodes = updated.map(n => {
                            if (n.id !== groupId) return n;
                            const existingIds = Array.isArray(n.data?.childIds) ? n.data.childIds.slice() : [];
                            const newIds = Array.from(new Set([...existingIds, targetId]));
                            const newLabels = newIds.map(id => updated.find(x => x.id === id)?.data?.label ?? id);
                            return { ...n, data: { ...n.data, childIds: newIds, children: newLabels } };
                        });

                        // 3) set the freshly updated group into the right panel immediately
                        const freshGroup = newNodes.find(n => n.id === groupId);
                        setSelectedGroup(freshGroup ? { ...freshGroup } : null);

                        return newNodes;
                    });
                }

                // exit group-selection mode and clear selection
                setGroupSelectionMode(null);
                setSelectedNodes([]);
                return; // short-circuit normal selection handling
            }

            // Normal selection handling
            setSelectedNodes(rfSelectedNodes || []);

            if (rfSelectedNodes && rfSelectedNodes.length === 1) {
                const sel = rfSelectedNodes[0];
                const fullNode = nodes.find((n) => n.id === sel.id);

                if (!fullNode) {
                    setSelectedItem(null);
                    setSelectedGroup(null);
                    return;
                }

                if (fullNode.type === 'groupLabel' || fullNode.data?.isGroup) {
                    setSelectedGroup(fullNode);
                    setSelectedItem(null);
                } else {
                    const nodeData = items.find((item) => item.id === fullNode.id);
                    setSelectedItem(nodeData || null);
                    setSelectedGroup(null);
                }
            } else {
                setSelectedItem(null);
                setSelectedGroup(null);
            }
        },
        [nodes, items, groupSelectionMode] // note the dependencies
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

    const handleGeneratePNID = async () => {
        if (!aiDescription) return;

        try {
            const { nodes: aiNodes, edges: aiEdges } = await AIPNIDGenerator(
                aiDescription,
                items,
                nodes,
                edges,
                setSelectedItem,
                setChatMessages
            );

            const newItems = aiNodes.map(n => n.data?.item).filter(Boolean);

            setItems(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const filteredNew = newItems.filter(i => !existingIds.has(i.id));
                const updatedItems = [...prev, ...filteredNew];

                if (filteredNew.length > 0) setSelectedItem(filteredNew[0]);

                return updatedItems;
            });

            setNodes(aiNodes);
            setEdges(aiEdges);

        } catch (err) {
            console.error('AI PNID generation failed:', err);
        }
    };
    const onNodesChange = useCallback(
        (changes) => {
            setNodes((nds) => {
                let updatedNodes = nds.map((node) => {
                    // only handle real position updates that include a position object
                    const change = changes.find((c) => c.id === node.id && c.type === 'position' && c.position);

                    if (change && node.data?.groupId) {
                        // find parent group
                        const groupNode = nds.find((n) => n.id === node.data.groupId);

                        if (!groupNode) {
                            // parent not found → leave node unchanged
                            return node;
                        }

                        const { rect = {} } = groupNode.data || {};
                        const { width = 200, height = 200 } = rect;
                        const gPos = groupNode.position ?? { x: 0, y: 0 }; // safe fallback

                        // clamp inside parent using the provided change.position
                        const newX = Math.max(
                            gPos.x + 10,
                            Math.min(change.position.x, gPos.x + width - 40)
                        );
                        const newY = Math.max(
                            gPos.y + 30,
                            Math.min(change.position.y, gPos.y + height - 40)
                        );

                        return { ...node, position: { x: newX, y: newY } };
                    }

                    return node;
                });

                // Handle group resize/style changes → snap children back in
                changes.forEach((change) => {
                    if (change.type === 'dimensions' || change.type === 'style') {
                        const groupNode = updatedNodes.find((n) => n.id === change.id);
                        if (!groupNode) return; // nothing to do if group missing

                        const { rect = {} } = groupNode.data || {};
                        const { width = 200, height = 200 } = rect;
                        const gPos = groupNode.position ?? { x: 0, y: 0 };

                        updatedNodes = updatedNodes.map((n) => {
                            if (n.data?.groupId === groupNode.id) {
                                // guard children positions (they might be undefined)
                                const childX = n.position?.x ?? gPos.x + 10;
                                const childY = n.position?.y ?? gPos.y + 30;

                                const clampedX = Math.max(
                                    gPos.x + 10,
                                    Math.min(childX, gPos.x + width - 40)
                                );
                                const clampedY = Math.max(
                                    gPos.y + 30,
                                    Math.min(childY, gPos.y + height - 40)
                                );

                                return { ...n, position: { x: clampedX, y: clampedY } };
                            }
                            return n;
                        });
                    }
                });

                return updatedNodes;
            });

            // forward to React Flow's internal handler
            _onNodesChange(changes);
        },
        [setNodes, _onNodesChange]
    );


    useEffect(() => {
        fetchData()
            .then((items) => {
                const normalizedItems = items.map((item) => ({
                    ...item,
                    Unit: item.Unit || 'Default Unit',
                    SubUnit: item.SubUnit || item['Sub Unit'] || 'Default SubUnit',
                    Category: Array.isArray(item['Category Item Type'])
                        ? item['Category Item Type'][0]
                        : item['Category Item Type'] || '',
                    Type: Array.isArray(item.Type) ? item.Type[0] : item.Type || '',
                    Code: item['Item Code'] || item.Code || '',
                    Name: item.Name || '',
                    Sequence: item.Sequence || 0,
                }));

                setItems(normalizedItems);

                const grouped = {};
                normalizedItems.forEach((item) => {
                    const { Unit, SubUnit, Category, Sequence, Name, Code, id } = item;
                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                    grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id });
                });

                const newNodes = [];
                const newEdges = [];
                let unitX = 0;
                const unitWidth = 5000;
                const unitHeight = 3000;
                const subUnitHeight = unitHeight / 9;
                const itemWidth = 160;
                const itemGap = 30;

                Object.entries(grouped).forEach(([unit, subUnits]) => {
                    newNodes.push({
                        id: `unit-${unit}`,
                        position: { x: unitX, y: 0 },
                        data: { label: unit },
                        style: {
                            width: unitWidth,
                            height: unitHeight,
                            border: '4px solid #444',
                            background: 'transparent',
                            boxShadow: 'none',
                        },
                        draggable: false,
                        selectable: false,
                    });

                    Object.entries(subUnits).forEach(([subUnit, items], index) => {
                        const yOffset = index * subUnitHeight;

                        newNodes.push({
                            id: `sub-${unit}-${subUnit}`,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: {
                                label: subUnit,
                                rect: { width: unitWidth - 20, height: subUnitHeight - 20 },
                                position: { x: unitX + 10, y: yOffset + 10 },
                                isGroup: false,   // ❌ was true before
                                isContainer: true // ✅ new flag if you want to identify unit/subunit boxes
                            },
                            type: 'subUnitLabel', // <-- use a distinct node type for clarity
                            style: {
                                width: unitWidth - 20,
                                height: subUnitHeight - 20,
                                border: '2px dashed #aaa',
                                background: 'transparent',
                                boxShadow: 'none',
                            },
                            draggable: false,
                            selectable: false, // optional: so user can’t accidentally click-select a subunit
                        });



                        let itemX = unitX + 40;
                        items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        items.forEach((item) => {
                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: yOffset + 20 },
                                data: {
                                    label: `${item.Code || ''} - ${item.Name || ''}`,
                                    item,
                                    icon: getItemIcon(item),
                                },
                                type: categoryTypeMap[item.Category] || 'scalableIcon',
                                sourcePosition: 'right',
                                targetPosition: 'left',
                                style: { background: 'transparent', boxShadow: 'none' },
                            });
                            itemX += itemWidth + itemGap;
                        });
                    });

                    unitX += unitWidth + 100;
                });

                setNodes(newNodes);
                setEdges(newEdges);
                setDefaultLayout({ nodes: newNodes, edges: newEdges });
            })
            .catch(console.error);
    }, []);


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Top panel: AI input + Generate button + Chat */}
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        placeholder="Describe PNID for AI..."
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        style={{ flex: 1, padding: 4 }}
                    />
                    <button onClick={handleGeneratePNID} style={{ padding: '4px 8px' }}>
                        Generate PNID
                    </button>
                </div>

                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <ChatBox messages={chatMessages} />
                </div>
            </div>

            {/* Main content: Canvas + toolbar + detail panel */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                {/* Left side: toolbar + canvas */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <MainToolbar
                        selectedNodes={selectedNodes}
                        setNodes={setNodes}
                        updateNode={updateNode}
                        deleteNode={deleteNode}
                    />
                    <div style={{ flex: 1 }}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onSelectionChange={onSelectionChange}
                            fitView
                            selectionOnDrag
                            minZoom={0.02}
                            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                            nodeTypes={nodeTypes}
                            style={{ width: '100%', height: '100%', background: 'transparent' }}
                        >
                            <Controls />
                        </ReactFlow>
                    </div>
                </div>

                {/* Right side: detail panel */}
                <div
                    style={{
                        width: 350,
                        borderLeft: '1px solid #ccc',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {/* --- inside ProcessDiagram return, right panel --- */}
                        {selectedItem ? (
                            <ItemDetailCard
                                item={selectedItem}
                                onChange={(updatedItem) =>
                                    handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)
                                }
                            />
                        ) : selectedGroup ? (
                            (() => {
                                const groupId = selectedGroup.id;
                                // full node objects that belong to the group
                                    const childrenNodesForGroup = nodes
                                        .filter((n) => n.data?.groupId === groupId)
                                        .map((n) => {
                                            // prefer explicit node label, else use item payload (Code - Name), else fallback to id
                                            const labelFromData = n.data?.label;
                                            const item = n.data?.item;
                                            const codeName = item ? `${item.Code || ''}${item.Code && item.Name ? ' - ' : ''}${item.Name || ''}`.trim() : '';
                                            const displayLabel = labelFromData || codeName || n.data?.item?.Name || n.id;
                                            return { ...n, displayLabel };
                                        });

                                    // debug: inspect what we will render (remove in prod)
                                    console.log('childrenNodesForGroup', groupId, childrenNodesForGroup);

                                // friendly labels for display
                                const childrenLabelsForGroup = childrenNodesForGroup.map((n) => n.data?.label ?? n.id);

                                // helper: add item into group (called by GroupDetailCard)
                                const addItemToGroup = (itemId) => {
                                    setNodes((nds) => {
                                        // 1) mark item with groupId
                                        const updated = nds.map((n) =>
                                            n.id === itemId ? { ...n, data: { ...n.data, groupId } } : n
                                        );

                                        // 2) update the group node's metadata based on updated nodes
                                        const newNodes = updated.map((n) => {
                                            if (n.id !== groupId) return n;
                                            const existingIds = Array.isArray(n.data?.childIds) ? n.data.childIds.slice() : [];
                                            const newIds = Array.from(new Set([...existingIds, itemId]));
                                            const newLabels = newIds.map((id) => updated.find((x) => x.id === id)?.data?.label ?? id);
                                            return { ...n, data: { ...n.data, childIds: newIds, children: newLabels } };
                                        });

                                        // 3) update selectedGroup from freshly-updated nodes (no stale closure)
                                        const freshGroup = newNodes.find((n) => n.id === groupId);
                                        setSelectedGroup(freshGroup ? { ...freshGroup } : null);

                                        return newNodes;
                                    });
                                };

                                // helper: remove item from group
                                const removeItemFromGroup = (itemId) => {
                                    setNodes((nds) => {
                                        // 1) clear groupId from the removed child
                                        const updated = nds.map((n) =>
                                            n.id === itemId ? { ...n, data: { ...n.data, groupId: undefined } } : n
                                        );

                                        // 2) recompute group's child arrays using the updated list
                                        const newNodes = updated.map((n) => {
                                            if (n.id !== groupId) return n;
                                            const childIds = (n.data?.childIds || []).filter((id) => id !== itemId);
                                            const newLabels = childIds.map((id) => updated.find((x) => x.id === id)?.data?.label ?? id);
                                            return { ...n, data: { ...n.data, childIds, children: newLabels } };
                                        });

                                        // 3) refresh selectedGroup from fresh state
                                        const freshGroup = newNodes.find((n) => n.id === groupId);
                                        setSelectedGroup(freshGroup ? { ...freshGroup } : null);

                                        return newNodes;
                                    });
                                };

                                return (
                                    <GroupDetailCard
                                        node={selectedGroup}
                                        childrenNodes={childrenNodesForGroup}
                                        childrenLabels={childrenLabelsForGroup}
                                        startAddItemToGroup={startAddItemToGroup}
                                        onAddItem={addItemToGroup}
                                        onRemoveItem={removeItemFromGroup}
                                        onChange={(id, update) => {
                                            updateGroupNode(id, update);
                                            setSelectedGroup((prev) => ({
                                                ...prev,
                                                position: update.position ?? prev.position,
                                                data: {
                                                    ...prev.data,
                                                    rect: update.rect ?? prev.data?.rect,
                                                    label: update.label ?? prev.data?.label,
                                                },
                                            }));
                                        }}
                                        onDelete={(id) => {
                                            setNodes((nds) =>
                                                nds
                                                    .filter((n) => n.id !== id)
                                                    .map((n) =>
                                                        n.data?.groupId === id ? { ...n, data: { ...n.data, groupId: undefined } } : n
                                                    )
                                            );
                                            setSelectedGroup(null);
                                        }}
                                    />
                                );
                            })()
                        ) : (
                            <div style={{ padding: 20, color: '#888' }}>Select an item or group to see details</div>
                        )}
                    </div>
                </div>

                
                
            </div>
        </div>


    );

}