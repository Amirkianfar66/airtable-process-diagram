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
    equipment: ScalableIconNode,
    pipe: ScalableIconNode,
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

const fetchLinkedRecords = async (ids, table) => {
    if (!ids || ids.length === 0) return [];
    const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
    const token = import.meta.env.VITE_AIRTABLE_TOKEN;
    let allRecords = [];
    let offset = null;

    do {
        const filterFormula = ids.map(id => `RECORD_ID()='${id}'`).join(',');
        const url = `https://api.airtable.com/v0/${baseId}/${table}?pageSize=100&filterByFormula=OR(${filterFormula})` + (offset ? `&offset=${offset}` : '');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Linked table fetch failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset;
    } while (offset);

    return allRecords.map(r => ({ id: r.id, ...r.fields }));
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
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Airtable API error: ${res.status} ${res.statusText} - ${errorText}`);
        }
        const data = await res.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset;
    } while (offset);

    const mainRecords = allRecords.map(r => ({ id: r.id, ...r.fields }));

    // Fetch linked records for each record
    for (let rec of mainRecords) {
        rec.linkedData = {};
        for (let [key, val] of Object.entries(rec)) {
            if (Array.isArray(val) && val.every(v => typeof v === 'string' && v.startsWith('rec'))) {
                const linkedTable = import.meta.env[`VITE_AIRTABLE_${key.toUpperCase()}_TABLE`];
                if (linkedTable) {
                    rec.linkedData[key] = await fetchLinkedRecords(val, linkedTable);
                }
            }
        }
    }

    return mainRecords;
};

export default function ProcessDiagram() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);

    const onSelectionChange = useCallback(({ nodes }) => {
        if (nodes.length === 1) {
            const match = items.find(i => i.id === nodes[0].id);
            setSelectedItem(match || null);
        } else setSelectedItem(null);
    }, [items]);

    const onConnect = useCallback(params => {
        setEdges(eds => addEdge({ ...params, type: 'step', animated: true, style: { stroke: 'blue', strokeWidth: 2 } }, eds));
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetchData()
            .then(rows => {
                if (cancelled) return;
                setItems(rows);

                const grouped = {};
                rows.forEach(item => {
                    const unit = item.Unit || 'Unknown Unit';
                    const subUnit = item['Sub Unit'] || item.SubUnit || 'Unknown Sub Unit';
                    if (!grouped[unit]) grouped[unit] = {};
                    if (!grouped[unit][subUnit]) grouped[unit][subUnit] = [];
                    grouped[unit][subUnit].push(item);
                });

                const newNodes = [];
                const newEdges = [];
                let yOffset = 40;
                const unitGap = 220;
                const subUnitGap = 160;
                const itemGapX = 200;

                Object.entries(grouped).forEach(([unit, subUnits], uIdx) => {
                    const unitId = `unit-${uIdx}`;
                    newNodes.push({ id: unitId, position: { x: 20, y: yOffset }, data: { label: unit }, type: 'resizable', sourcePosition: 'right', targetPosition: 'left' });

                    let subY = yOffset + 70;
                    Object.entries(subUnits).forEach(([sub, itemsInSub], sIdx) => {
                        const subId = `${unitId}-sub-${sIdx}`;
                        newNodes.push({ id: subId, position: { x: 260, y: subY }, data: { label: sub }, type: 'resizable', sourcePosition: 'right', targetPosition: 'left' });
                        newEdges.push({ id: `e-${unitId}-${subId}`, source: unitId, target: subId, type: 'step' });

                        let itemX = 520;
                        itemsInSub.slice().sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0)).forEach(it => {
                            const Icon = categoryIcons[it['Category Item Type']] || null;
                            newNodes.push({
                                id: it.id,
                                position: { x: itemX, y: subY + 10 },
                                data: { label: `${it['Item Code'] || ''} - ${it['Name'] || ''}`.trim(), icon: Icon ? <Icon style={{ width: 20, height: 20 }} /> : null, scale: 1, linkedData: it.linkedData || {} },
                                type: 'scalableIcon',
                                sourcePosition: 'right',
                                targetPosition: 'left',
                            });
                            newEdges.push({ id: `e-${subId}-${it.id}`, source: subId, target: it.id, type: 'step' });
                            itemX += itemGapX;
                        });

                        subY += subUnitGap;
                    });

                    yOffset += unitGap;
                });

                setNodes(newNodes);
                setEdges(newEdges);
            })
            .catch(err => console.error(err));

        return () => { cancelled = true; };
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
            <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={onSelectionChange} fitView selectionOnDrag minZoom={0.02} defaultViewport={{ x: 0, y: 0, zoom: 1 }} nodeTypes={nodeTypes}>
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>
            <div style={{ width: 350, borderLeft: '1px solid #ccc', background: '#f9f9f9', overflowY: 'auto' }}>
                {selectedItem ? <ItemDetailCard item={selectedItem} /> : <div style={{ padding: 20, color: '#888' }}>Select an item to see details</div>}
            </div>
        </div>
    );
}
