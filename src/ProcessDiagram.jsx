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

// Custom components... (same as before)
import ResizableNode from './ResizableNode';
import CustomItemNode from './CustomItemNode';
import PipeItemNode from './PipeItemNode';
import ScalableNode from './ScalableNode';
import ScalableIconNode from './ScalableIconNode';
import GroupLabelNode from './GroupLabelNode';

// Icons... (same as before)
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
    // ... (fetchData function is unchanged and correct)
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

// MODAL: Style for the modal component
const modalStyles = {
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        background: 'white',
        padding: '25px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflowY: 'auto',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'transparent',
        border: 'none',
        fontSize: '1.5rem',
        cursor: 'pointer',
    },
    dataRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        borderBottom: '1px solid #eee',
        padding: '8px 0',
    },
    dataKey: {
        fontWeight: 'bold',
        paddingRight: '10px',
        color: '#333',
    }
};

export default function ProcessDiagram() {
    const [defaultLayout, setDefaultLayout] = useState({ nodes: [], edges: [] });
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);

    // MODAL: State to manage the modal
    const [modalData, setModalData] = useState(null);

    const onSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes(nodes);
    }, []);
    useEffect(() => {
        // ... (keydown listener is unchanged)
    }, [setNodes, setEdges]);

    const itemWidth = 160;
    const itemHeight = 60;
    const itemGap = 30;
    const unitWidth = 5000;
    const unitHeight = 3000;
    const subUnitHeight = unitHeight / 9;

    useEffect(() => {
        fetchData()
            .then((items) => {
                const grouped = {};
                items.forEach((item) => {
                    const { Unit, SubUnit = item['Sub Unit'] } = item;
                    if (!Unit || !SubUnit) return;
                    if (!grouped[Unit]) grouped[Unit] = {};
                    if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                    // ✅ Pushing the full item object
                    grouped[Unit][SubUnit].push(item);
                });

                const newNodes = [];
                const newEdges = [];
                let unitX = 0;

                Object.entries(grouped).forEach(([unit, subUnits]) => {
                    // ... (unit/sub-unit node creation is unchanged)
                    newNodes.push({ id: `unit-${unit}`, position: { x: unitX, y: 0 }, data: { label: unit }, style: { width: unitWidth, height: unitHeight, backgroundColor: 'transparent', border: '4px solid #444', zIndex: 0 }, draggable: false, selectable: false });
                    const subUnitNames = Object.keys(subUnits);
                    subUnitNames.forEach((subUnit, index) => {
                        const yOffset = index * subUnitHeight;
                        newNodes.push({ id: `sub-${unit}-${subUnit}`, position: { x: unitX + 10, y: yOffset + 10 }, data: { label: subUnit }, style: { width: unitWidth - 20, height: subUnitHeight - 20, backgroundColor: 'transparent', border: '2px dashed #aaa', zIndex: 1 }, draggable: false, selectable: false });

                        const items = subUnits[subUnit];
                        items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                        let itemX = unitX + 40;
                        const itemY = yOffset + 40;
                        items.forEach((item) => {
                            const IconComponent = categoryIcons[item['Category Item Type']];
                            newNodes.push({
                                id: item.id,
                                position: { x: itemX, y: itemY },
                                data: {
                                    label: `${item['Item Code'] || ''} - ${item.Name || ''}`,
                                    icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                    scale: 1,
                                    // ✅ Storing the full data object
                                    fullData: item,
                                },
                                type: item['Category Item Type'] === 'Equipment' ? 'equipment' : (item['Category Item Type'] === 'Pipe' ? 'pipe' : 'scalableIcon'),
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
            })
            .catch((err) => console.error(err));
    }, [setNodes, setEdges]);

    // MODAL: Function to handle clicking a node
    const handleNodeClick = useCallback((event, node) => {
        // Only open the modal for item nodes, not for unit/sub-unit containers
        if (node.id.startsWith('item-') || node.id.startsWith('rec')) {
            console.log("Full data for clicked node:", node.data.fullData);
            setModalData(node.data.fullData);
        }
    }, []);

    // ... (onConnect, onNodeDragStop, handleReset, handleSave, and button handlers are unchanged)
    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

    return (
        <> {/* MODAL: Use a Fragment to render the modal alongside the diagram */}
            {/* MODAL: The Modal component itself */}
            {modalData && (
                <div style={modalStyles.backdrop} onClick={() => setModalData(null)}>
                    <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                        <button style={modalStyles.closeButton} onClick={() => setModalData(null)}>&times;</button>
                        <h2>Item Details</h2>
                        {Object.entries(modalData).map(([key, value]) => (
                            <div style={modalStyles.dataRow} key={key}>
                                <div style={modalStyles.dataKey}>{key}</div>
                                <div>{Array.isArray(value) ? value.join(', ') : String(value)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ width: '100vw', height: '100vh' }}>
                {/* ... (Your buttons div is unchanged) ... */}
                <div style={{ position: 'absolute', zIndex: 10, top: 10, left: 10, display: 'flex', gap: 10 }}>
                    {/* All your buttons go here */}
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    // MODAL: Add the onNodeClick handler here
                    onNodeClick={handleNodeClick}
                    fitView
                    selectionOnDrag={true}
                    minZoom={0.02}
                    nodeTypes={nodeTypes}
                // ... (rest of the props are unchanged) ...
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>
        </>
    );
}