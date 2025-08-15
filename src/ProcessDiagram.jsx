import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    Background,
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
import ScalableNode from './ScalableNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';

import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    equipment: EquipmentIcon,
    scalable: ScalableNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
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

const categoryIcons = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    'Inline Valve': InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

export default function ProcessDiagram() {
    const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);

    const onSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes(nodes);
        if (nodes.length === 1) {
            const nodeData = items.find(item => item.id === nodes[0].id);
            setSelectedItem(nodeData || null);
        } else {
            setSelectedItem(null);
        }
    }, [items]);
    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                {
                    ...params,
                    type: 'step', // orthogonal edges
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

    useEffect(() => {
        fetchData()
            .then((items) => {
                setItems(items);
                const grouped = {};
                items.forEach((item) => {
                    const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];

                    // --- START OF FIX ---
                    // The 'Category' variable here is an array (e.g., ['Equipment']).
                    // We extract the string value from the array before pushing it.
                    const categoryString = Array.isArray(Category) ? Category[0] : Category;
                    grouped[Unit][SubUnit].push({ Category: categoryString, Sequence, Name, Code, id: item.id });
                    // --- END OF FIX ---
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
                        style: { width: unitWidth, height: unitHeight, border: '4px solid #444' },
                        draggable: false,
                        selectable: false,
                    });

                    Object.entries(subUnits).forEach(([subUnit, items], index) => {
                        const yOffset = index * subUnitHeight;
                        newNodes.push({
                            id: `sub-${unit}-${subUnit}`,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: { label: subUnit },
                            style: { width: unitWidth - 20, height: subUnitHeight - 20, border: '2px dashed #aaa' },
                            draggable: false,
                            selectable: false,
                        });

                        items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        let itemX = unitX + 40;
                        items.forEach((item) => {
                            // Now 'item.Category' is a string, so these lookups will work correctly.
                            const IconComponent = categoryIcons[item.Category];
                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: yOffset + 20 },
                                data: {
                                    label: `${item.Code || ''} - ${item.Name || ''}`,
                                    icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                },
                                type: item.Category === 'Equipment' ? 'equipment' : (item.Category === 'Pipe' ? 'pipe' : 'scalableIcon'),
                                sourcePosition: 'right',
                                targetPosition: 'left',
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
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            <div style={{ flex: 1, position: 'relative', background: 'transparent' }}>

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
                    style={{ background: 'transparent' }} // <-- importan
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>

            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: 'transparent', overflowY: 'auto' }}>
                {selectedItem ? (
                    <ItemDetailCard item={selectedItem} />
                ) : (
                    <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                )}
            </div>
        </div>
    );
}