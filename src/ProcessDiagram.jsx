import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState, addEdge } from 'reactflow';
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
import DiagramCanvas from './DiagramCanvas';
import AddItemButton from './AddItemButton';
import AIChatPanel from './AIChatPanel';

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
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);

    // ---------------- Selection & connection ----------------
    const updateNode = (id, newData) => {
        setNodes((nds) => nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...newData } } : node)));
    };

    const deleteNode = (id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const onSelectionChange = useCallback(
        ({ nodes: selNodes }) => {
            setSelectedNodes(selNodes);
            if (selNodes.length === 1) {
                const nodeData = items.find((item) => item.id === selNodes[0].id);
                setSelectedItem(nodeData || null);
            } else {
                setSelectedItem(null);
            }
        },
        [items]
    );

    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                { ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } },
                edges
            );
            setEdges(updatedEdges);
        },
        [edges]
    );

    // ---------------- Dragging group nodes ----------------
    const onNodeDrag = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;

        setNodes((nds) =>
            nds.map((n) => {
                if (!n?.data) return n;

                const isChild =
                    (Array.isArray(draggedNode.data?.children) && draggedNode.data.children.includes(n.id)) ||
                    n.data.groupId === draggedNode.id ||
                    n.data.parentId === draggedNode.id;

                if (!isChild) return n;

                const deltaX = draggedNode.position.x - (draggedNode.data.prevX ?? draggedNode.position.x);
                const deltaY = draggedNode.position.y - (draggedNode.data.prevY ?? draggedNode.position.y);

                return { ...n, position: { x: n.position.x + deltaX, y: n.position.y + deltaY } };
            })
        );

        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id
                    ? { ...n, data: { ...n.data, prevX: draggedNode.position.x, prevY: draggedNode.position.y } }
                    : n
            )
        );
    }, []);

    const onNodeDragStop = useCallback((event, draggedNode) => {
        if (!draggedNode || draggedNode.type !== 'groupLabel') return;
        setNodes((nds) =>
            nds.map((n) =>
                n.id === draggedNode.id ? { ...n, data: { ...n.data, prevX: undefined, prevY: undefined } } : n
            )
        );
    }, []);

    // ---------------- Load from Airtable & layout Units/SubUnits/Items ----------------
    useEffect(() => {
        fetchData()
            .then((itemsRaw) => {
                const normalizedItems = itemsRaw.map((item) => ({
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
                    // Unit frame
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

                    // SubUnits and items
                    Object.entries(subUnits).forEach(([subUnit, itemsArr], index) => {
                        const yOffset = index * subUnitHeight;

                        newNodes.push({
                            id: `sub-${unit}-${subUnit}`,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: { label: subUnit },
                            style: {
                                width: unitWidth - 20,
                                height: subUnitHeight - 20,
                                border: '2px dashed #aaa',
                                background: 'transparent',
                                boxShadow: 'none',
                            },
                            draggable: false,
                            selectable: false,
                        });

                        let itemX = unitX + 40;
                        itemsArr.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        itemsArr.forEach((it) => {
                            newNodes.push({
                                id: it.id,
                                position: { x: itemX, y: yOffset + 20 },
                                data: { label: `${it.Code || ''} - ${it.Name || ''}`, item: it, icon: getItemIcon(it) },
                                type: categoryTypeMap[it.Category] || 'scalableIcon',
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
            })
            .catch(console.error);
    }, []);

    // ---------------- Group detail helpers ----------------
    const itemsMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
    const selectedGroupNode =
        selectedNodes && selectedNodes.length === 1 && selectedNodes[0]?.type === 'groupLabel'
            ? selectedNodes[0]
            : null;

    const childrenNodesForGroup = selectedGroupNode
        ? nodes.filter((n) => {
            if (!n) return false;
            if (Array.isArray(selectedGroupNode.data?.children) && selectedGroupNode.data.children.includes(n.id))
                return true;
            if (n.data?.groupId === selectedGroupNode.id) return true;
            if (n.data?.parentId === selectedGroupNode.id) return true;
            return false;
        })
        : [];

    // ---------------- Add item button (manual add) ----------------
    const handleAddItem = (rawItem) => {
        const normalizedItem = {
            id: rawItem.id || `item-${Date.now()}`,
            Name: rawItem.Name || '',
            Code: rawItem.Code ?? rawItem['Item Code'] ?? '',
            'Item Code': rawItem['Item Code'] ?? rawItem.Code ?? '',
            Unit: rawItem.Unit || '',
            SubUnit: rawItem.SubUnit ?? rawItem['Sub Unit'] ?? '',
            Category: Array.isArray(rawItem['Category Item Type'])
                ? rawItem['Category Item Type'][0]
                : rawItem['Category Item Type'] ?? rawItem.Category ?? '',
            Type: Array.isArray(rawItem.Type) ? rawItem.Type[0] : rawItem.Type || '',
            Sequence: rawItem.Sequence ?? 0,
        };

        const newNode = {
            id: normalizedItem.id,
            position: { x: 100, y: 100 },
            data: {
                label: `${normalizedItem.Code || ''} - ${normalizedItem.Name || ''}`,
                item: normalizedItem,
                icon: getItemIcon(normalizedItem),
            },
            type: categoryTypeMap[normalizedItem.Category] || 'scalableIcon',
            sourcePosition: 'right',
            targetPosition: 'left',
            style: { background: 'transparent', boxShadow: 'none' },
        };

        setNodes((nds) => [...nds, newNode]);
        setItems((prev) => [...prev, normalizedItem]);
        setSelectedNodes([newNode]);
        setSelectedItem(normalizedItem);
    };

    // ---------------- Render ----------------
    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
                <DiagramCanvas
                    nodes={nodes}
                    edges={edges}
                    setNodes={setNodes}
                    setEdges={setEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypes}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                    AddItemButton={(props) => <AddItemButton {...props} addItem={handleAddItem} />}
                />
            </div>

            {/* Details sidebar */}
            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: 'transparent' }}>
                <div style={{ height: '100%', overflowY: 'auto' }}>
                    {selectedGroupNode ? (
                        <GroupDetailCard
                            node={selectedGroupNode}
                            childrenNodes={childrenNodesForGroup}
                            childrenLabels={selectedGroupNode?.data?.children}
                            allItems={itemsMap}
                        />
                    ) : selectedItem ? (
                        <ItemDetailCard
                            item={selectedItem}
                            onChange={(updatedItem) => handleItemChangeNode(updatedItem, setItems, setNodes, setSelectedItem)}
                        />
                    ) : (
                        <div style={{ padding: 20, color: '#888' }}>Select an item or group to see details</div>
                    )}
                </div>
            </div>

            {/* AI & chat panel (separate) */}
            <AIChatPanel
                nodes={nodes}
                edges={edges}
                items={items}
                setNodes={setNodes}
                setEdges={setEdges}
                setItems={setItems}
                setSelectedItem={setSelectedItem}
            />
        </div>
    );
}
