import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = [], setSelectedItem) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // AI-powered parsing
    const parsed = await parseItemText(description);
    if (!parsed) return { nodes: existingNodes, edges: existingEdges };

    const { Name, Category, Type } = parsed;

    // Check if item exists
    const match = itemsLibrary.find(item =>
        item.Name === Name && item.Category === Category && item.Type === Type
    );

    const item = match || { Name, Category, Type, id: `ai-${Date.now()}-${Math.random()}` };
    const label = `${item.Code || ''} - ${item.Name || Name}`;

    const newNode = {
        id: item.id,
        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
        data: {
            label,
            item,
            icon: getItemIcon(item),
        },
        type: categoryTypeMap[Category] || 'scalableIcon',
    };

    if (typeof setSelectedItem === "function") setSelectedItem(item);

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges],
    };
}
