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

const categoryIcons = {
    Equipment: EquipmentIcon,
    Instrument: InstrumentIcon,
    'Inline Valve': InlineValveIcon,
    Pipe: PipeIcon,
    Electrical: ElectricalIcon,
};

export default function ProcessDiagram() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        Code: '',
        Name: '',
        Category: 'Equipment',
        Unit: '',
        SubUnit: '',
    });

    const onSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes(nodes);
        if (nodes.length === 1) {
            const nodeData = items.find((item) => item.id === nodes[0].id);
            setSelectedItem(nodeData || null);
        } else {
            setSelectedItem(null);
        }
    }, [items]);

    const onConnect = useCallback(
        (params) => {
            const updatedEdges = addEdge(
                { ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } },
                edges
            );
            setEdges(updatedEdges);
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes, edges: updatedEdges }));
        },
        [edges, nodes]
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddItem = () => {
        const newItem = {
            id: `item-${Date.now()}`,
            ...formData,
        };
        setItems((prev) => [...prev, newItem]);
        setNodes((prev) => [
            ...prev,
            {
                id: newItem.id,
                position: { x: 100, y: 100 }, // default position
                data: {
                    label: `${newItem.Code} - ${newItem.Name}`,
                    icon: categoryIcons[newItem.Category]
                        ? React.createElement(categoryIcons[newItem.Category], { style: { width: 20, height: 20 } })
                        : null,
                },
                type: newItem.Category === 'Equipment' ? 'equipment' : newItem.Category === 'Pipe' ? 'pipe' : 'scalableIcon',
                sourcePosition: 'right',
                targetPosition: 'left',
            },
        ]);
        setFormData({ Code: '', Name: '', Category: 'Equipment', Unit: '', SubUnit: '' });
        setShowAddForm(false);
    };

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
                    style={{ background: 'transparent' }}
                >
                    <Controls />
                    <Background />
                </ReactFlow>
            </div>

            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: 'transparent', overflowY: 'auto', padding: 10 }}>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{ padding: '8px 16px', marginBottom: 10, background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                    Add Item
                </button>

                {showAddForm && (
                    <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc', borderRadius: 4 }}>
                        <div>
                            <label>Code:</label>
                            <input name="Code" value={formData.Code} onChange={handleChange} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>Name:</label>
                            <input name="Name" value={formData.Name} onChange={handleChange} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>Category:</label>
                            <select name="Category" value={formData.Category} onChange={handleChange} style={{ width: '100%' }}>
                                <option>Equipment</option>
                                <option>Instrument</option>
                                <option>Inline Valve</option>
                                <option>Pipe</option>
                                <option>Electrical</option>
                            </select>
                        </div>
                        <div>
                            <label>Unit:</label>
                            <input name="Unit" value={formData.Unit} onChange={handleChange} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>SubUnit:</label>
                            <input name="SubUnit" value={formData.SubUnit} onChange={handleChange} style={{ width: '100%' }} />
                        </div>

                        <button onClick={handleAddItem} style={{ marginTop: 10, padding: '5px 10px' }}>
                            Add
                        </button>
                    </div>
                )}

                {selectedItem ? (
                    <ItemDetailCard item={selectedItem} />
                ) : (
                    <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>
                )}
            </div>
        </div>
    );
}
