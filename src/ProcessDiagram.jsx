// src/ProcessDiagram.jsx
import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';

const airtableApiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
const airtableBaseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
const airtableTableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

export default function ProcessDiagram() {
    const [elements, setElements] = useState([]);

    const fetchData = useCallback(async () => {
        const res = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`, {
            headers: { Authorization: `Bearer ${airtableApiKey}` },
        });
        const data = await res.json();

        const nodes = data.records.map((record, idx) => ({
            id: record.id,
            position: { x: 100 + idx * 150, y: 100 },
            data: { label: record.fields.Name || 'No name' },
        }));

        setElements(nodes);
        localStorage.setItem('diagram-layout', JSON.stringify(nodes));
    }, []);

    useEffect(() => {
        const savedLayout = localStorage.getItem('diagram-layout');
        if (savedLayout) {
            setElements(JSON.parse(savedLayout));
        } else {
            fetchData();
        }
    }, [fetchData]);

    const onNodesChange = useCallback((changes) => {
        setElements((els) => {
            const updated = els.map((el) => {
                const change = changes.find((c) => c.id === el.id);
                return change && change.position ? { ...el, position: change.position } : el;
            });
            localStorage.setItem('diagram-layout', JSON.stringify(updated));
            return updated;
        });
    }, []);

    return (
        <div style={{ width: '100%', height: '100vh' }}>
            <ReactFlow nodes={elements} onNodesChange={onNodesChange} fitView>
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
}
