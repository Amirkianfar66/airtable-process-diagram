import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = [], setSelectedItem) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // AI-powered parsing
    const parsed = await parseItemText(description);
    if (!parsed) return { nodes: existingNodes, edges: existingEdges };

    const { Name, Category, Type } = parsed;

    // Normalize values to avoid case mismatches
    const normName = (Name || '').trim();
    const normCategory = (Category || '').trim();
    const normType = (Type || '').trim();

    // Check if item exists
    const match = itemsLibrary.find(item =>
        item.Name?.toLowerCase() === normName.toLowerCase() &&
        item.Category?.toLowerCase() === normCategory.toLowerCase() &&
        item.Type?.toLowerCase() === normType.toLowerCase()
    );

    const item = match || {
        Name: normName,
        Category: normCategory,
        Type: normType,
        id: `ai-${Date.now()}-${Math.random()}`
    };

    const label = `${item.Code || ''}${item.Code ? ' - ' : ''}${item.Name || normName}`;

    const newNode = {
        id: item.id,
        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
        data: {
            label,
            item,
            icon: getItemIcon(item),
        },
        type: categoryTypeMap[normCategory] || 'scalableIcon',
    };

    if (typeof setSelectedItem === "function") setSelectedItem(item);

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges],
    };
}
