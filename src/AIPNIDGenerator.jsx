// AIPNIDGenerator.jsx

import { getItemIcon, categoryTypeMap } from './IconManager';

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = []) {
    if (!description || !Array.isArray(itemsLibrary) || itemsLibrary.length === 0) return { nodes: existingNodes, edges: existingEdges };

    const lower = description.toLowerCase();
    const newNodes = [];
    const newEdges = [];

    // Loop through the library to find matching items
    itemsLibrary.forEach((item) => {
        if (!item) return;
        const label = `${item.Code || ''} - ${item.Name || ''}`;
        const name = item.Name || '';
        const type = item.Type || '';

        // Match item only if description contains its name or type
        if (name && lower.includes(name.toLowerCase()) || type && lower.includes(type.toLowerCase())) {
            newNodes.push({
                id: `${item.id}-${Date.now()}-${Math.random()}`,
                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                data: { label, item, icon: getItemIcon(item) },
                type: categoryTypeMap[item.Category] || 'scalableIcon',
            });
        }
    });

    // Create edges between new nodes only if there are at least 2 new nodes
    if (newNodes.length > 1) {
        for (let i = 1; i < newNodes.length; i++) {
            newEdges.push({
                id: `e${i}-${i + 1}-${Date.now()}-${Math.random()}`,
                source: newNodes[i - 1].id,
                target: newNodes[i].id
            });
        }
    }

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: [...existingEdges, ...newEdges]
    };
}
