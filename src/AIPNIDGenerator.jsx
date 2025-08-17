// AIPNIDGenerator.jsx

// This module exports a function that generates PNID nodes and edges based on a text description
// using the existing category and type library from your icon manager.
import { getItemIcon, categoryTypeMap } from './IconManager';

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = []) {
    if (!description || !Array.isArray(itemsLibrary)) return { nodes: [], edges: [] };

    const lower = description.toLowerCase();
    const newNodes = [];
    const newEdges = [];

    // Loop through the library to find matching items
    itemsLibrary.forEach((item) => {
        if (!item) return;
        const label = `${item.Code || ''} - ${item.Name || ''}`;
        const name = item.Name || '';
        const type = item.Type || '';

        if (lower.includes(name.toLowerCase()) || lower.includes(type.toLowerCase())) {
            newNodes.push({
                id: `${item.id}-${Date.now()}-${Math.random()}`, // unique ID
                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                data: { label, item, icon: getItemIcon(item) },
                type: categoryTypeMap[item.Category] || 'scalableIcon',
            });
        }
    });

    // Create edges between new nodes
    for (let i = 1; i < newNodes.length; i++) {
        newEdges.push({
            id: `e${i}-${i + 1}-${Date.now()}-${Math.random()}`,
            source: newNodes[i - 1].id,
            target: newNodes[i].id
        });
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: [...existingEdges, ...newEdges]
    };
}
