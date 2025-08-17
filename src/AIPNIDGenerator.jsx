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
    // Return only the first best match
    const match = itemsLibrary.find(item => {
        if (!item) return false;
        const nameMatch = fuzzyMatch(lower, item.Name || '');
        const typeMatch = fuzzyMatch(lower, item.Type || '');
        const categoryMatch = fuzzyMatch(lower, item.Category || '');
        return nameMatch || typeMatch || categoryMatch;
    });

    if (!match) return [];

    return [{
        item: match,
        name: match.Name || '',
        type: match.Type || '',
        category: match.Category || ''
    }];
}

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = []) {
    if (!description || !Array.isArray(itemsLibrary) || itemsLibrary.length === 0) return { nodes: existingNodes, edges: existingEdges };

    const matchedItems = parseDescription(description, itemsLibrary);
    if (matchedItems.length === 0) return { nodes: existingNodes, edges: existingEdges };

    const newNodes = [];
    const newEdges = [];

    const { item, name, type, category } = matchedItems[0]; // take only the first match
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

    return {
        nodes: [...existingNodes, ...newNodes],
        edges: [...existingEdges, ...newEdges]
    };
}