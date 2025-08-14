import React, { useEffect, useCallback } from 'react';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';

// --- CORRECT ENVIRONMENT VARIABLE NAMES ---
const airtableToken = import.meta.env.VITE_AIRTABLE_TOKEN; // ✅ Use the correct variable name
const airtableBaseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
const airtableTableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

export default function ProcessDiagram() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const fetchData = useCallback(async () => {
        // Add a console log to confirm the token is loaded
        console.log("Authenticating with token:", airtableToken ? "Token Loaded" : "Token is UNDEFINED");

        try {
            const res = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`, {
                headers: {
                    // ✅ Pass the correct token variable to the header
                    Authorization: `Bearer ${airtableToken}`
                },
            });
            if (!res.ok) {
                throw new Error(`Airtable fetch failed with status: ${res.status}`);
            }
            const data = await res.json();

            const initialNodes = data.records.map((record, idx) => ({
                id: record.id,
                position: { x: 100 + idx * 150, y: 100 },
                data: { label: record.fields.Name || 'No name' },
                // Add any other node properties you need from your old version
            }));

            setNodes(initialNodes);
            setEdges([]); // Initialize edges if you have any
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes: initialNodes, edges: [] }));
        } catch (error) {
            console.error("Failed to fetch data from Airtable:", error);
        }
    }, [setNodes, setEdges]);

    useEffect(() => {
        const savedLayout = localStorage.getItem('diagram-layout');
        if (savedLayout) {
            try {
                const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedLayout);
                setNodes(savedNodes || []);
                setEdges(savedEdges || []);
            } catch (error) {
                console.error("Failed to parse saved layout, fetching new data.", error);
                fetchData();
            }
        } else {
            fetchData();
        }
    }, [fetchData, setNodes, setEdges]);

    // Custom handler to save changes to localStorage
    const handleNodesChange = useCallback((changes) => {
        setNodes((currentNodes) => {
            const updatedNodes = applyNodeChanges(changes, currentNodes);
            // Get current edges to avoid overwriting them
            const currentEdges = JSON.parse(localStorage.getItem('diagram-layout') || '{}').edges || [];
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes: updatedNodes, edges: currentEdges }));
            return updatedNodes;
        });
    }, [setNodes]);


    return (
        <div style={{ width: '100%', height: '100vh' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
}