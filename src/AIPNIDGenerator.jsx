// AIPNIDGenerator.jsx

import { getItemIcon, categoryTypeMap } from './IconManager';
 const CATEGORY_LIST = Object.keys(categoryTypeMap);


// Fuzzy-match helper
function fuzzyMatch(text, keyword) {
    if (!text || !keyword) return false;
    return text.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(text.toLowerCase());
}

// Parse description to detect name, category, and type
function parseDescription(description, itemsLibrary) {
    if (!description) return null;
    const lower = description.toLowerCase();

    // 1. Detect category
    let category = CATEGORY_LIST.find(cat => lower.includes(cat.toLowerCase())) || "";

    // 2. Detect type
    // Detect type dynamically from itemsLibrary
    let type = "";
    if (itemsLibrary.length > 0) {
        const allTypes = Array.from(new Set(itemsLibrary.map(i => i.Type).filter(Boolean)));
        type = allTypes.find(t => lower.includes(t.toLowerCase())) || "";
    }


    // 3. Detect name
    // Remove detected category and type from text to get name
    let name = description;
    if (category) name = name.replace(new RegExp(category, "i"), "").trim();
    if (type) name = name.replace(new RegExp(type, "i"), "").trim();

    // 4. Optional: match existing item if exact match exists
    const match = itemsLibrary.find(item =>
        item.Name.toLowerCase() === name.toLowerCase() &&
        item.Category === category &&
        item.Type === type
    );

    return {
        item: match || { Name: name, Category: category, Type: type },
        name,
        type,
        category
    };
}


export default async function AIPNIDGenerator(
    description,
    itemsLibrary = [],
    existingNodes = [],
    existingEdges = [],
    setSelectedItem
) {
    if (!description || !Array.isArray(itemsLibrary) || itemsLibrary.length === 0)
        return { nodes: existingNodes, edges: existingEdges };

    const matchedItem = parseDescription(description, itemsLibrary);
    if (!matchedItem) return { nodes: existingNodes, edges: existingEdges };

    const { item, name, type, category } = matchedItem;

    const label = `${item.Code || ''} - ${name}`;

    const newItem = { ...item, Name: name, Type: type, Category: category };

    // Use the original item.id as node.id so selection works
    const newNode = {
        id: item.id,
        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
        data: {
            label,
            item: newItem,
            icon: getItemIcon(newItem),
        },
        type: categoryTypeMap[category] || 'scalableIcon',
    };

    // Automatically select the new item so ItemDetailCard shows it
    if (typeof setSelectedItem === 'function') {
        setSelectedItem(newItem);
    }

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges],
    };
}

