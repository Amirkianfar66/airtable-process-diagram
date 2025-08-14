import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    Controls,
    Background,
    applyNodeChanges, // Import applyNodeChanges
    useNodesState,     // Import useNodesState
} from 'reactflow';
import 'reactflow/dist/style.css';

// Environment variables for Airtable credentials
const airtableApiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
const airtableBaseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
const airtableTableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

export default function ProcessDiagram() {
    // Use the useNodesState hook to manage nodes
    // This hook provides the nodes array, a setter, and the onNodesChange handler
    const [nodes, setNodes, onNodesChange] = useNodesState([]);

    // Fetches data from Airtable and initializes the nodes
    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`, {
                headers: { Authorization: `Bearer ${airtableApiKey}` },
            });

            if (!response.ok) {
                throw new Error(`Airtable API request failed with status ${response.status}`);
            }

            const data = await response.json();

            const initialNodes = data.records.map((record, idx) => ({
                id: record.id,
                position: { x: 100 + idx * 150, y: 100 },
                data: { label: record.fields.Name || 'No name' },
            }));

            setNodes(initialNodes);
            localStorage.setItem('diagram-layout', JSON.stringify(initialNodes));

        } catch (error) {
            console.error("Error fetching data from Airtable:", error);
        }
    }, [setNodes]); // setNodes is a stable function from the hook

    // Effect to load data from localStorage or fetch from Airtable on initial render
    useEffect(() => {
        const savedLayout = localStorage.getItem('diagram-layout');
        if (savedLayout) {
            try {
                const parsedLayout = JSON.parse(savedLayout);
                setNodes(parsedLayout);
            } catch (error) {
                console.error("Failed to parse saved layout, fetching new data.", error);
                fetchData();
            }
        } else {
            fetchData();
        }
    }, [fetchData, setNodes]); // Dependencies for the initial load

    // Custom onNodesChange handler to also save to localStorage after a change
    const handleNodesChange = useCallback(
        (changes) => {
            // Let the hook handle the state update
            onNodesChange(changes);

            // Apply changes to the current nodes to get the next state for localStorage
            setNodes((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                localStorage.setItem('diagram-layout', JSON.stringify(updatedNodes));
                return updatedNodes;
            });
        },
        [onNodesChange, setNodes]
    );

    return (
        <div style={{ width: '100%', height: '100vh' }}>
            <ReactFlow
                nodes={nodes}
                onNodesChange={handleNodesChange} // Use the custom handler
                fitView
            >
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
}