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
    // No changes to state hooks
    const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);

    // No changes to callbacks
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
                    type: 'step',
                    animated: true,
                    style: { stroke: 'blue', strokeWidth: 2 },
                },
                edges
            );
            setEdges(updatedEdges);
        },
        [edges, setEdges]
    );

    // --- MODIFICATIONS ARE IN THIS useEffect HOOK ---
    useEffect(() => {
        fetchData()
            .then((fetchedItems) => {
                // Set the raw items to state so ItemDetailCard has all the original data
                setItems(fetchedItems);
                const grouped = {};

                fetchedItems.forEach((item) => {
                    // Access fields with spaces using bracket notation
                    const Unit = item['Unit'];
                    const SubUnit = item['Sub Unit'];
                    const categoryArray = item['Category Item Type']; // This is an array, e.g., ['Equipment']

                    // **THE FIX**: Convert the array from the linked field into a simple string
                    const categoryString = (Array.isArray(categoryArray) && categoryArray.length > 0)
                        ? categoryArray[0]
                        : 'Unknown'; // Fallback for empty data

                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];

                    // Push the full original item, but add our new 'Category' property for easy access
                    grouped[Unit][SubUnit].push({ ...item, Category: categoryString });
                });


                const newNodes = [];
                const newEdges = []; // Start with fresh edges on data load
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
                        type: 'groupLabel', // Using a custom type for group labels is good practice
                    });

                    Object.entries(subUnits).forEach(([subUnit, itemsInGroup], index) => {
                        const yOffset = index * subUnitHeight;
                        newNodes.push({
                            id: `sub-${unit}-${subUnit}`,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: { label: subUnit },
                            style: { width: unitWidth - 20, height: subUnitHeight - 20, border: '2px dashed #aaa' },
                            draggable: false,
                            selectable: false,
                            type: 'groupLabel',
                        });

                        itemsInGroup.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        let itemX = unitX + 40;

                        itemsInGroup.forEach((item) => {
                            // Now `item.Category` is a string like "Equipment", so this lookup works
                            const IconComponent = categoryIcons[item.Category];

                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: yOffset + 40 },
                                data: {
                                    label: `${item['Item Code'] || ''} - ${item.Name || ''}`,
                                    icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                },
                                // And this comparison also works correctly now
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
    }, [setEdges, setNodes]); // Include state setters in the dependency array

    // No changes to the JSX
    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            <div style={{ flex: 1, position: 'relative' }}>
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
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>
            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: '#f9f9f9', overflowY: 'auto' }}>
                {selectedItem ? (
                    <ItemDetailCard item={selectedItem} />
                ) : (
                    <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                )}
            </div>
        </div>
    );
}