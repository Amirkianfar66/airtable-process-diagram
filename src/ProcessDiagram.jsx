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

// Import all custom node and component types
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableNode from './ScalableNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';

// Import all icon components
import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

// Map node type strings to their respective components
const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    equipment: EquipmentIcon,
    scalable: ScalableNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
};

// Asynchronously fetches all records from the specified Airtable table
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

    // Map the final records to a clean format
    return allRecords.map((rec) => ({ id: rec.id, ...rec.fields }));
};

// Maps category strings to their respective icon components
const categoryIcons = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    'Inline Valve': InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

export default function ProcessDiagram() {
    // State management for React Flow and component data
    const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]); // Stores the raw data for the detail card

    // Handles node selection changes to display details in the sidebar
    const onSelectionChange = useCallback(({ nodes }) => {
        if (nodes.length === 1) {
            // Find the full, original item data to pass to the detail card
            const nodeData = items.find(item => item.id === nodes[0].id);
            setSelectedItem(nodeData || null);
        } else {
            setSelectedItem(null);
        }
    }, [items]);

    // Handles creating new connections (edges) between nodes
    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                {
                    ...params,
                    type: 'step', // Use orthogonal lines for edges
                    animated: true,
                    style: { stroke: 'blue', strokeWidth: 2 },
                },
                edges
            );
            setEdges(updatedEdges);
            // Optional: Save layout changes to local storage
            // localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updatedEdges }));
        },
        [edges, setEdges]
    );

    // Main effect hook to fetch data and build the diagram layout on component mount
    useEffect(() => {
        fetchData()
            .then((fetchedItems) => {
                // Store the original, raw items so the detail card has access to all fields
                setItems(fetchedItems);

                const grouped = {};
                fetchedItems.forEach((item) => {
                    // Destructure fields, renaming the linked record field to 'Category'
                    const { Unit, ['Sub Unit']: SubUnit, ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;

                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];

                    // --- THIS IS THE CRITICAL FIX ---
                    // 'Category' is an array from Airtable (e.g., ['Equipment']).
                    // We extract the string value from it before creating the node data.
                    const categoryString = Array.isArray(Category) ? Category[0] : Category;

                    // Push a simplified object with the corrected category string for node generation.
                    grouped[Unit][SubUnit].push({ Category: categoryString, Sequence, Name, Code, id: item.id });
                });

                const newNodes = [];
                const newEdges = [];
                let unitX = 0;
                const unitWidth = 5000;
                const unitHeight = 3000;
                const subUnitHeight = unitHeight / 9;
                const itemWidth = 160;
                const itemGap = 30;

                // Loop through the grouped data to generate React Flow nodes
                Object.entries(grouped).forEach(([unit, subUnits]) => {
                    // Create large container node for the Unit
                    newNodes.push({
                        id: `unit-${unit}`,
                        position: { x: unitX, y: 0 },
                        data: { label: unit },
                        style: { width: unitWidth, height: unitHeight, border: '4px solid #444' },
                        draggable: false,
                        selectable: false,
                        type: 'groupLabel',
                    });

                    Object.entries(subUnits).forEach(([subUnit, itemsInGroup], index) => {
                        const yOffset = index * subUnitHeight;
                        // Create smaller container node for the SubUnit
                        newNodes.push({
                            id: `sub-${unit}-${subUnit}`,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: { label: subUnit },
                            style: { width: unitWidth - 20, height: subUnitHeight - 20, border: '2px dashed #aaa' },
                            draggable: false,
                            selectable: false,
                            type: 'groupLabel',
                        });

                        // Sort items and create a node for each one
                        itemsInGroup.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        let itemX = unitX + 40;
                        itemsInGroup.forEach((item) => {
                            // Because of the fix above, item.Category is now a string, so this lookup works correctly.
                            const IconComponent = categoryIcons[item.Category];
                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: yOffset + 40 },
                                data: {
                                    label: `${item.Code || ''} - ${item.Name || ''}`,
                                    icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                },
                                // This comparison also works correctly now.
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
    }, [setEdges, setNodes]); // Dependency array ensures this runs once on mount

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            {/* React Flow Diagram Area */}
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

            {/* Sidebar for Item Details */}
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