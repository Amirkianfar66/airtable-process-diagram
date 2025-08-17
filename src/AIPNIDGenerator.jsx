// AIPNIDGenerator.jsx

// This module exports a function that generates PNID nodes and edges based on a text description
// using the existing category and type library from your icon manager.
import { getItemIcon, categoryTypeMap } from './IconManager';

export default async function AIPNIDGenerator(description, itemsLibrary) {
    if (!description) return { nodes: [], edges: [] };

    const lower = description.toLowerCase();
    const nodes = [];
    const edges = [];

    // Loop through the library to find matching items
    itemsLibrary.forEach((item) => {
        const label = `${item.Code || ''} - ${item.Name || ''}`;
        if (lower.includes(item.Name.toLowerCase()) || lower.includes(item.Type.toLowerCase())) {
            nodes.push({
                id: `${item.id}-${Date.now()}`, // unique ID
                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                data: { label, item, icon: getItemIcon(item) },
                type: categoryTypeMap[item.Category] || 'scalableIcon',
            });
        }
    });

    // Create edges between nodes based on simple sequence (optional, can be enhanced)
    for (let i = 1; i < nodes.length; i++) {
        edges.push({
            id: `e${i}-${i + 1}-${Date.now()}`,
            source: nodes[i - 1].id,
            target: nodes[i].id
        });
    }

    return { nodes, edges };
}
