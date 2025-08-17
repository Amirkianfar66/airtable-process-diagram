// AIPNIDGenerator.jsx
import React, { useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

export default function AIPNIDGenerator() {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [description, setDescription] = useState('');

    const generatePNID = async () => {
        // Call AI API to get structured PNID JSON (nodes and edges)
        const aiResult = await aiApiCall(description);
        setNodes(aiResult.nodes);
        setEdges(aiResult.edges);
    };

    return (
        <div style={{ width: '100%', height: '600px' }}>
            <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your PNID design"
                style={{ width: '300px', marginBottom: 10 }}
            />
            <button onClick={generatePNID}>Generate PNID</button>

            <ReactFlow nodes={nodes} edges={edges} fitView>
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
}

// Mock AI API call (replace with actual AI call)
async function aiApiCall(description) {
    // Example: parse "tank open top with level instrument"
    if (description.toLowerCase().includes('tank')) {
        return {
            nodes: [
                { id: 'tank1', position: { x: 100, y: 100 }, data: { label: 'Tank (Open Top)' }, type: 'scalableIcon' },
                { id: 'level1', position: { x: 250, y: 100 }, data: { label: 'Level Instrument' }, type: 'scalableIcon' },
            ],
            edges: [
                { id: 'e1-2', source: 'level1', target: 'tank1' },
            ],
        };
    }
    return { nodes: [], edges: [] };
}
