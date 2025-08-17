// AIPNIDGenerator.jsx

import { getItemIcon, categoryTypeMap } from './IconManager';

// Fuzzy-match helper
function fuzzyMatch(text, keyword) {
    if (!text || !keyword) return false;
    return text.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(text.toLowerCase());
}

// Parse description to detect name, category, and type
function parseDescription(description, itemsLibrary) {
    const lower = description.toLowerCase();
    return itemsLibrary.filter(item => {
        if (!item) return false;
        const nameMatch = fuzzyMatch(lower, item.Name || '');
        const typeMatch = fuzzyMatch(lower, item.Type || '');
        const categoryMatch = fuzzyMatch(lower, item.Category || '');
        return nameMatch || typeMatch || categoryMatch;
    }).map(item => ({
        item,
        name: item.Name || '',
        type: item.Type || '',
        category: item.Category || ''
    }));
}

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = []) {
    if (!description || !Array.isArray(itemsLibrary) || itemsLibrary.length === 0) return { nodes: existingNodes, edges: existingEdges };

    const matchedItems = parseDescription(description, itemsLibrary);
    const newNodes = [];
    const newEdges = [];

    matchedItems.forEach(match => {
        const { item, name, type, category } = match;
        const label = `${item.Code || ''} - ${name}`;
        newNodes.push({
            id: `${item.id}-${Date.now()}-${Math.random()}`,
            position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
            data: {
                label,
                item: { ...item, Name: name, Type: type, Category: category },
                icon: getItemIcon(item)
            },
            type: categoryTypeMap[category] || 'scalableIcon',
        });
    });

    // Create edges between new nodes if multiple nodes matched
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
