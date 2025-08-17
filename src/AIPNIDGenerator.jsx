// AIPNIDGenerator.jsx

import { getItemIcon, categoryTypeMap } from './IconManager';

// Fuzzy-match helper
function fuzzyMatch(text, keyword) {
    if (!text || !keyword) return false;
    return text.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(text.toLowerCase());
}

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = []) {
    if (!description || !Array.isArray(itemsLibrary) || itemsLibrary.length === 0) return { nodes: existingNodes, edges: existingEdges };

    const lower = description.toLowerCase();
    const newNodes = [];
    const newEdges = [];

    // Loop through the library to find matching items using fuzzy match
    itemsLibrary.forEach((item) => {
        if (!item) return;
        const label = `${item.Code || ''} - ${item.Name || ''}`;
        const name = item.Name || '';
        const type = item.Type || '';

        if (fuzzyMatch(lower, name) || fuzzyMatch(lower, type)) {
            newNodes.push({
                id: `${item.id}-${Date.now()}-${Math.random()}`,
                position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
                data: { label, item, icon: getItemIcon(item) },
                type: categoryTypeMap[item.Category] || 'scalableIcon',
            });
        }
    });

    // Create edges between new nodes if at least 2 nodes are matched
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