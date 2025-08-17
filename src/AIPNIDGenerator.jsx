// AIPNIDGenerator.jsx

import { getItemIcon, categoryTypeMap } from './IconManager';

// Get categories dynamically from IconManager
const CATEGORY_LIST = Object.keys(categoryTypeMap);

// Fuzzy-match helper
function fuzzyMatch(text, keyword) {
    if (!text || !keyword) return false;
    return text.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(text.toLowerCase());
}

// Parse AI description to detect name, type, category from Airtable items
function parseDescription(description, itemsLibrary) {
    const lower = description.toLowerCase();

    // Find the first matching item
    const match = itemsLibrary.find(item => {
        if (!item) return false;

        const nameMatch = item.Name && fuzzyMatch(lower, item.Name);
        const typeMatch = item.Type && fuzzyMatch(lower, item.Type);
        const categoryMatch = item.Category && fuzzyMatch(lower, item.Category);

        return nameMatch || typeMatch || categoryMatch;
    });

    if (!match) return null;

    return {
        item: match,
        name: match.Name || '',
        type: match.Type || '',
        category: match.Category || ''
    };
}

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = [], setSelectedItem) {
    if (!description || !Array.isArray(itemsLibrary) || itemsLibrary.length === 0) return { nodes: existingNodes, edges: existingEdges };

    const matchedItem = parseDescription(description, itemsLibrary);
    if (!matchedItem) return { nodes: existingNodes, edges: existingEdges };

    const { item, name, type, category } = matchedItem;
    const nodeId = `${item.id}-${Date.now()}-${Math.random()}`;
    const label = `${item.Code || ''} - ${name}`;

    const newItem = { ...item, Name: name, Type: type, Category: category };

    const newNode = {
        id: nodeId,
        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
        data: {
            label,
            item: newItem,
            icon: getItemIcon(newItem)
        },
        type: categoryTypeMap[category] || 'scalableIcon',
    };

    // Automatically select the new item so ItemDetailCard shows it
    if (typeof setSelectedItem === 'function') {
        setSelectedItem(newItem);
    }

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges]
    };
}
