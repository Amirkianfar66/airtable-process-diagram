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
import Airtable from 'airtable';

// Custom components
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableNode from './ScalableNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';

// Icons
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

    const onSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes(nodes);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
                setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setNodes, setEdges]);

    const fetchData = async () => {
        const base = new Airtable({ apiKey: import.meta.env.VITE_AIRTABLE_TOKEN }).base(import.meta.env.VITE_AIRTABLE_BASE_ID);
        const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

        const records = await base(table).select({ view: 'Grid view' }).all();
        return records.map(r => ({ id: r.id, ...r.fields }));
    };

    useEffect(() => {
        fetchData().then(items => {
            const grouped = {};
            items.forEach(item => {
                const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
                if (!Unit || !SubUnit) return;
                if (!grouped[Unit]) grouped[Unit] = {};
                if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, fullData: item });
            });

            const newNodes = [];
            const newEdges = [];
            let idCounter = 1;
            let unitX = 0;
            const unitWidth = 5000;
            const unitHeight = 3000;
            const subUnitHeight = unitHeight / 9;

            Object.entries(grouped).forEach(([unit, subUnits]) => {
                // Unit Node
                newNodes.push({
                    id: `unit-${unit}`,
                    position: { x: unitX, y: 0 },
                    data: { label: unit },
                    style: { width: unitWidth, height: unitHeight, backgroundColor: 'transparent', border: '4px solid #444', zIndex: 0 },
                    draggable: false,
                    selectable: false,
                });

                Object.entries(subUnits).forEach(([subUnit, items], index) => {
                    const yOffset = index * subUnitHeight;

                    // SubUnit Node
                    newNodes.push({
                        id: `sub-${unit}-${subUnit}`,
                        position: { x: unitX + 10, y: yOffset + 10 },
                        data: { label: subUnit },
                        style: { width: unitWidth - 20, height: subUnitHeight - 20, backgroundColor: 'transparent', border: '2px dashed #aaa', zIndex: 1 },
                        draggable: false,
                        selectable: false,
                    });

                    items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                    let itemX = unitX + 40;
                    const itemY = yOffset + 20;

                    items.forEach(item => {
                        const id = `item-${idCounter++}`;
                        const IconComponent = categoryIcons[item.Category];
                        newNodes.push({
                            id,
                            position: { x: itemX, y: itemY },
                            data: {
                                label: `${item.Code || ''} - ${item.Name || ''}`,
                                icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                scale: 1,
                                fullData: item.fullData
                            },
                            type: item.Category === 'Equipment' ? 'equipment' : (item.Category === 'Pipe' ? 'pipe' : 'scalableIcon'),
                            sourcePosition: 'right',
                            targetPosition: 'left',
                        });
                        itemX += 160 + 30;
                    });
                });
                unitX += unitWidth + 100;
            });

            setNodes(newNodes);
            setEdges(newEdges);
            setDefaultLayout({ nodes: newNodes, edges: newEdges });
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes: newNodes, edges: newEdges }));
        }).catch(err => console.error(err));
    }, []);

    const onConnect = useCallback(
        (params) => {
            const updated = addEdge({ ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } }, edges);
            setEdges(updated);
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updated }));
        }, [edges, nodes]
    );

    const onNodeDragStop = useCallback(
        (_, updatedNode) => {
            const updatedNodes = nodes.map(n => (n.id === updatedNode.id ? updatedNode : n));
            setNodes(updatedNodes);
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes: updatedNodes, edges }));
        }, [nodes, edges]
    );

    const handleReset = () => {
        setNodes(defaultLayout.nodes);
        setEdges(defaultLayout.edges);
    };

    const handleSave = () => {
        localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges }));
        alert('Layout saved!');
    };

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            {/* Buttons and ReactFlow component here (same as your current code) */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={onNodeDragStop}
                onConnect={onConnect}
                onSelectionChange={onSelectionChange}
                fitView
                selectionOnDrag={true}
                minZoom={0.02}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                nodeTypes={nodeTypes}
                onPaneContextMenu={(event) => {
                    event.preventDefault();
                    setNodes(nds => nds.map(node => ({ ...node, selected: false })));
                    setEdges(eds => eds.map(edge => ({ ...edge, selected: false })));
                }}
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
}
