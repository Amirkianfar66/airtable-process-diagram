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

// This function is correct. It fetches all data from the Airtable table.
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

    // We return the full record data, including the raw linked field.
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
            // Find the item from the fully processed 'items' state
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
            // Be cautious with saving to localStorage if the diagram becomes very large.
        },
        [edges, setEdges]
    );

    useEffect(() => {
        fetchData()
            .then((fetchedItems) => {
                const grouped = {};

                // --- START OF THE FIX ---

                // 1. Process the items first to create a clean 'Category' field
                const processedItems = fetchedItems.map(item => {
                    // Access the field using bracket notation because of spaces
                    const categoryArray = item['Category Item Type'];

                    // Airtable linked records return an array of strings (the primary field's value).
                    // We safely extract the first string.
                    const categoryValue = (Array.isArray(categoryArray) && categoryArray.length > 0)
                        ? categoryArray[0]
                        : 'Unknown'; // Default value if it's empty or not an array

                    // Return a new object with all original data plus our clean 'Category' field
                    return {
                        ...item,
                        Category: categoryValue,
                    };
                });

                // 2. Set the fully processed items to state. This is important for the detail card.
                setItems(processedItems);

                // 3. Group the processed items for node generation
                processedItems.forEach((item) => {
                    // Now we can safely destructure 'Unit', 'SubUnit', and our new 'Category'
                    const { Unit, Category } = item;
                    const SubUnit = item['Sub Unit']; // Also access this directly for safety

                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];

                    // Push the entire processed item object so all its data is available
                    grouped[Unit][SubUnit].push(item);
                });

                // --- END OF THE FIX ---


                const newNodes = [];
                // const newEdges = []; // Edges are managed by state, no need to reset here
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
                        type: 'groupLabel',
                    });

                    Object.entries(subUnits).forEach(([subUnit, itemsInSubUnit], index) => {
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

                        itemsInSubUnit.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        let itemX = unitX + 40;
                        itemsInSubUnit.forEach((item) => {
                            // Use the clean 'Category' field we created
                            const IconComponent = categoryIcons[item.Category];
                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: yOffset + 40 },
                                data: {
                                    label: `${item['Item Code'] || ''} - ${item.Name || ''}`,
                                    icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                },
                                // Determine node type from our clean 'Category'
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
                // setEdges(newEdges); // Keep existing edges
                setDefaultLayout({ nodes: newNodes, edges: [] });
            })
            .catch(console.error);
    }, [setEdges, setNodes]); // Added state setters to dependency array

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