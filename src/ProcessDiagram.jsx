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

// Custom components
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableNode from './ScalableNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';
import ItemDetailCard from './ItemDetailCard';


// Icons
import EquipmentIcon from './Icons/EquipmentIcon';
import InstrumentIcon from './Icons/InstrumentIcon';
import InlineValveIcon from './Icons/InlineValveIcon';
import PipeIcon from './Icons/PipeIcon';
import ElectricalIcon from './Icons/ElectricalIcon';

// ✅ Register your custom node types
const nodeTypes = {
    resizable: ResizableNode,
    custom: CustomItemNode,
    pipe: PipeItemNode,
    equipment: EquipmentIcon,
    scalable: ScalableNode,
    scalableIcon: ScalableIconNode,
    groupLabel: GroupLabelNode,
};

// --- UPDATED fetchData FUNCTION TO GET ALL ROWS ---
const fetchData = async () => {
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME;
    let allRecords = [];
    let offset = null;
    const initialUrl = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`;

    // Keep fetching pages as long as there's an offset
    do {
        const url = offset ? `${initialUrl}&offset=${offset}` : initialUrl;

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Airtable API error: ${res.status} ${res.statusText} - ${errorText}`);
        }

        const data = await res.json();

        // Add the fetched records to our main array
        allRecords = allRecords.concat(data.records);

        // Get the offset for the next page, if it exists
        offset = data.offset;

    } while (offset);

    // Now return the fields from all the collected records
    console.log(`Fetched a total of ${allRecords.length} records from Airtable.`);
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
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setNodes((nds) =>
                    nds.map((node) => ({ ...node, selected: false }))
                );
                setEdges((eds) =>
                    eds.map((edge) => ({ ...edge, selected: false }))
                );
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [setNodes, setEdges]);
    const itemWidth = 160;
    const itemHeight = 60;
    const itemGap = 30;
    const padding = 30;
    const unitWidth = 5000;
    const unitHeight = 3000;
    const subUnitHeight = unitHeight / 9;

    useEffect(() => {
        fetchData()
            .then((items) => {
                const grouped = {};
                items.forEach((item) => {
                    const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                    grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, id: item.id });
                });

                const newNodes = [];
                const newEdges = [];
                let unitX = 0;

                Object.entries(grouped).forEach(([unit, subUnits]) => {
                    const unitId = `unit-${unit}`;
                    newNodes.push({
                        id: unitId,
                        position: { x: unitX, y: 0 },
                        data: { label: unit },
                        style: {
                            width: unitWidth,
                            height: unitHeight,
                            backgroundColor: 'transparent',
                            border: '4px solid #444',
                            zIndex: 0,
                        },
                        draggable: false,
                        selectable: false,
                    });

                    const subUnitNames = Object.keys(subUnits);
                    subUnitNames.forEach((subUnit, index) => {
                        const subId = `sub-${unit}-${subUnit}`;
                        const yOffset = index * subUnitHeight;
                        newNodes.push({
                            id: subId,
                            position: { x: unitX + 10, y: yOffset + 10 },
                            data: { label: subUnit },
                            style: {
                                width: unitWidth - 20,
                                height: subUnitHeight - 20,
                                backgroundColor: 'transparent',
                                border: '2px dashed #aaa',
                                zIndex: 1,
                            },
                            draggable: false,
                            selectable: false,
                        });

                        const items = subUnits[subUnit];
                        items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        let itemX = unitX + 40;
                        const itemY = yOffset + 20;
                        items.forEach((item) => {
                            const IconComponent = categoryIcons[item.Category];
                            newNodes.push({
                                id: item.id, // Use the real Airtable record ID for the node
                                position: { x: itemX, y: itemY },
                                data: {
                                    label: `${item.Code || ''} - ${item.Name || ''}`,
                                    icon: IconComponent
                                        ? <IconComponent style={{ width: 20, height: 20 }} />
                                        : null,
                                    scale: 1,
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
                localStorage.setItem('diagram-layout', JSON.stringify({ nodes: newNodes, edges: newEdges }));
            })
            .catch((err) => {
                console.error(err);
            });
    }, [setNodes, setEdges]); // Added dependencies to satisfy ESLint

    const onConnect = useCallback(
        (params) => {
            const updated = addEdge(
                {
                    ...params,
                    type: 'step',
                    animated: true,
                    style: { stroke: 'blue', strokeWidth: 2 },
                },
                edges
            );

            setEdges(updated);
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updated }));
        },
        [edges, nodes, setEdges] // Added setEdges dependency
    );


    const onNodeDragStop = useCallback(
        (_, updatedNode) => {
            setNodes((currentNodes) => {
                const updatedNodes = currentNodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));
                localStorage.setItem('diagram-layout', JSON.stringify({ nodes: updatedNodes, edges }));
                return updatedNodes;
            });
        },
        [edges, setNodes] // Added setNodes dependency
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
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            {/* Left: Diagram */}
            <div style={{ flex: 1, position: 'relative' }}>
                <div
                    style={{
                        position: 'absolute',
                        zIndex: 10,
                        top: 10,
                        left: 10,
                        display: 'flex',
                        gap: 10,
                    }}
                >
                    🔁 Reset Layout
                </button>
                <button
                    onClick={handleSave}
                    style={{
                        padding: '6px 12px',
                        background: '#1d8841',
                        color: 'white',
                        border: 'none',
                        borderRadius: 5,
                        cursor: 'pointer',
                    }}
                >
                    📂 Save Layout
                </button>
                <button
                    onClick={() => {
                        if (selectedNodes.length === 0) {
                            alert("Please select nodes to group.");
                            return;
                        }
                        const groupId = `group-${Date.now()}`;
                        const groupName = prompt('Enter group name:', 'My Group') || 'Unnamed Group';

                        const defaultWidth = 300;
                        const defaultHeight = 150;

                        const firstSelected = selectedNodes[0];
                        const labelPosition = firstSelected
                            ? { x: firstSelected.position.x - 20, y: firstSelected.position.y - 40 }
                            : { x: 0, y: 0 };

                        const onGroupResize = (id, newSize) => {
                            setNodes((nds) =>
                                nds.map((node) => {
                                    if (node.id === id) {
                                        return {
                                            ...node,
                                            data: {
                                                ...node.data,
                                                width: newSize.width,
                                                height: newSize.height,
                                            },
                                            style: {
                                                ...node.style,
                                                width: newSize.width,
                                                height: newSize.height,
                                                border: '2px dashed #00bcd4',
                                                backgroundColor: 'rgba(0, 188, 212, 0.05)',
                                            },
                                        };
                                    }
                                    return node;
                                })
                            );
                        };

                        setNodes((nds) => {
                            const selectedIds = selectedNodes.map(node => node.id);
                            const updatedNodes = nds.map((node) =>
                                selectedIds.includes(node.id)
                                    ? {
                                        ...node,
                                        data: { ...node.data, groupId },
                                        style: { ...node.style, border: 'none', backgroundColor: 'transparent' },
                                    }
                                    : node
                            );

                            updatedNodes.push({
                                id: `group-label-${groupId}`,
                                type: 'groupLabel',
                                position: labelPosition,
                                data: {
                                    label: groupName,
                                    width: defaultWidth,
                                    height: defaultHeight,
                                    onResize: onGroupResize,
                                    id: `group-label-${groupId}`,
                                    groupId: groupId,
                                },
                                selectable: true,
                                draggable: true,
                                style: {
                                    border: '2px dashed #00bcd4',
                                    backgroundColor: 'rgba(0, 188, 212, 0.05)',
                                    borderRadius: 6,
                                },
                            });

                            return updatedNodes;
                        });
                    }}
                    style={{
                        padding: '6px 12px',
                        background: '#1976d2',
                        color: 'white',
                        border: 'none',
                        borderRadius: 5,
                        cursor: 'pointer',
                    }}
                >
                    🌀 Group Selected
                </button>
                <button
                    onClick={() => {
                        const selectedGroupLabels = selectedNodes.filter(
                            (node) => node.type === 'groupLabel'
                        );

                        if (selectedGroupLabels.length === 0) {
                            alert('Select a group label to remove its group');
                            return;
                        }

                        setNodes((nds) => {
                            const groupIdsToRemove = selectedGroupLabels.map(
                                (groupLabel) => groupLabel.data.groupId
                            );

                            return nds
                                .filter(node => !(node.type === 'groupLabel' && groupIdsToRemove.includes(node.data.groupId)))
                                .map((node) => {
                                    if (node.data?.groupId && groupIdsToRemove.includes(node.data.groupId)) {
                                        const { groupId, ...restData } = node.data;
                                        return {
                                            ...node,
                                            data: restData,
                                            style: { ...node.style, border: '', backgroundColor: '' },
                                        };
                                    }
                                    return node;
                                });
                        });
                    }}
                    style={{
                        padding: '6px 12px',
                        background: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: 5,
                        cursor: 'pointer',
                    }}
                >
                    ❌ Remove Group
                </button>

            </div>

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
                    setNodes((nds) =>
                        nds.map((node) => ({
                            ...node,
                            selected: false,
                        }))
                    );
                    setEdges((eds) =>
                        eds.map((edge) => ({
                            ...edge,
                            selected: false,
                        }))
                    );
                }}
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
}