// AIPNIDGenerator.jsx

// This module exports a function that generates PNID nodes and edges based on a text description.
// It is not a React component and can be used in your ProcessDiagram directly.

export default async function AIPNIDGenerator(description) {
    // Replace this with your real AI API call
    const aiResult = await mockAiApiCall(description);
    return aiResult;
}

// Mock AI API call: returns example nodes/edges for a description
async function mockAiApiCall(description) {
    if (!description) return { nodes: [], edges: [] };

    const lower = description.toLowerCase();

    const nodes = [];
    const edges = [];

    if (lower.includes('tank')) {
        nodes.push({
            id: 'tank1',
            position: { x: 100, y: 100 },
            data: { label: 'Tank (Open Top)' },
            type: 'scalableIcon'
        });
    }

    if (lower.includes('level')) {
        nodes.push({
            id: 'level1',
            position: { x: 250, y: 100 },
            data: { label: 'Level Instrument' },
            type: 'scalableIcon'
        });
    }

    if (nodes.length > 1) {
        edges.push({ id: 'e1-2', source: nodes[1].id, target: nodes[0].id });
    }

    return { nodes, edges };
}
