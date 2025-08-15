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
import ItemDetailCard from './ItemDetailCard';

export default function ProcessDiagram({ table13Records }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);

    const nodeTypes = {
        resizable: ResizableNode,
        equipment: CustomItemNode,
        pipe: PipeItemNode,
        scalableIcon: ResizableNode,
    };

    // ✅ Handles connection between nodes
    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        []
    );

    // ✅ Handles selection for detail card
    const onSelectionChange = useCallback(
        ({ nodes }) => {
            setSelectedNodes(nodes);
            if (nodes.length === 1) {
                const nodeData = table13Records.find(
                    (item) => item.id === nodes[0].id
                );
                setSelectedItem(nodeData || null);
            } else {
                setSelectedItem(null);
            }
        },
        [table13Records]
    );

    // ✅ Build nodes & edges from Airtable data
    useEffect(() => {
        if (!table13Records || !table13Records.length) return;

        const newNodes = [];
        const newEdges = [];

        const grouped = {};
        table13Records.forEach((item) => {
            const unit = item['Unit'] || 'Unknown Unit';
            const subUnit = item['Sub Unit'] || 'Unknown Sub Unit';
            if (!grouped[unit]) grouped[unit] = {};
            if (!grouped[unit][subUnit]) grouped[unit][subUnit] = [];
            grouped[unit][subUnit].push(item);
        });

        let yOffset = 50;
        let nodeIdCounter = 1;

        Object.entries(grouped).forEach(([unit, subUnits]) => {
            const unitId = `unit-${nodeIdCounter++}`;
            newNodes.push({
                id: unitId,
                position: { x: 50, y: yOffset },
                data: { label: unit },
                type: 'resizable',
                sourcePosition: 'right',
                targetPosition: 'left',
            });

            Object.entries(subUnits).forEach(([subUnit, items]) => {
                const subUnitId = `subunit-${nodeIdCounter++}`;
                newNodes.push({
                    id: subUnitId,
                    position: { x: 250, y: yOffset + 50 },
                    data: { label: subUnit },
                    type: 'resizable',
                    sourcePosition: 'right',
                    targetPosition: 'left',
                });

                newEdges.push({ id: `e-${unitId}-${subUnitId}`, source: unitId, target: subUnitId });

                let itemX = 500;
                items.forEach((item) => {
                    const category = (item['Category Item Type'] || '').toLowerCase();
                    let nodeType = 'scalableIcon';
                    if (category === 'equipment') nodeType = 'equipment';
                    if (category === 'pipe') nodeType = 'pipe';

                    newNodes.push({
                        id: item.id,
                        position: { x: itemX, y: yOffset + 80 },
                        data: {
                            label: `${item['Item Code'] || ''} - ${item['Name'] || ''}`,
                            ...item, // ✅ Pass all fields for ItemDetailCard
                        },
                        type: nodeType,
                        sourcePosition: 'right',
                        targetPosition: 'left',
                    });

                    newEdges.push({ id: `e-${subUnitId}-${item.id}`, source: subUnitId, target: item.id });
                    itemX += 200;
                });

                yOffset += Math.max(150, items.length * 120);
            });

            yOffset += 100;
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [table13Records]);

    return (
        <div style={{ display: 'flex', height: '100%' }}>
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
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>

            {/* ✅ Detail Card */}
            <div style={{ width: 350, padding: 16, background: '#f9f9f9', overflowY: 'auto' }}>
                <ItemDetailCard item={selectedItem} />
            </div>
        </div>
    );
}
